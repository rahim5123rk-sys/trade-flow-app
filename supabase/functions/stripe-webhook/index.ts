// Stripe webhook — source of truth for company worker seat limits.
//
// Events handled:
//   checkout.session.completed            → first-time subscription bound to company
//   customer.subscription.created         → back-stop for above
//   customer.subscription.updated         → tier upgrade/downgrade, renewal, status change
//   customer.subscription.deleted         → cancellation — revoke seats
//   invoice.payment_failed                → mark past_due (client can prompt user)
//
// All state changes go through the apply_stripe_seat_tier RPC so we never
// update worker_seat_limit from more than one code path.

import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildPriceTierMap, resolveTier as resolveTierFromMap } from './priceTierMap.js';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');

// Map each live Stripe Price ID → our internal tier name. Set these as
// edge function secrets after you create the monthly Prices in Stripe.
const PRICE_TIER_MAP = buildPriceTierMap({
  STRIPE_PRICE_DUO_MONTHLY: Deno.env.get('STRIPE_PRICE_DUO_MONTHLY'),
  STRIPE_PRICE_TEAM_MONTHLY: Deno.env.get('STRIPE_PRICE_TEAM_MONTHLY'),
  STRIPE_PRICE_CREW_MONTHLY: Deno.env.get('STRIPE_PRICE_CREW_MONTHLY'),
  STRIPE_PRICE_FLEET_MONTHLY: Deno.env.get('STRIPE_PRICE_FLEET_MONTHLY'),
});

const stripe = STRIPE_SECRET
  ? new Stripe(STRIPE_SECRET, { apiVersion: '2024-12-18.acacia', httpClient: Stripe.createFetchHttpClient() })
  : null;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function resolveTier(priceId: string | null | undefined): 'duo' | 'team' | 'crew' | 'fleet' | null {
  return resolveTierFromMap(PRICE_TIER_MAP, priceId);
}

async function applyTier(
  companyId: string,
  tier: 'duo' | 'team' | 'crew' | 'fleet' | null,
  status: string,
  customerId: string | null,
  subscriptionId: string | null,
  priceId: string | null,
  periodEndMs: number | null,
) {
  const { error } = await supabase.rpc('apply_stripe_seat_tier', {
    p_company_id: companyId,
    p_tier: tier,
    p_status: status,
    p_customer_id: customerId,
    p_subscription_id: subscriptionId,
    p_price_id: priceId,
    p_period_end: periodEndMs ? new Date(periodEndMs).toISOString() : null,
  });
  if (error) throw new Error(`apply_stripe_seat_tier failed: ${error.message}`);
}

async function findCompanyByCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe webhook misconfigured — missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return new Response('Server misconfigured', { status: 500 });
  }

  const signature = req.headers.get('Stripe-Signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('Stripe signature verification failed:', (err as Error).message);
    return new Response('Invalid signature', { status: 400 });
  }

  // Idempotency: reuse the existing processed_webhook_events table.
  const { error: idempoError } = await supabase
    .from('processed_webhook_events')
    .insert({ event_id: `stripe:${event.id}`, event_type: event.type, app_user_id: null });
  if (idempoError) {
    if (idempoError.code === '23505') return jsonResponse({ received: true, duplicate: true });
    console.error('Idempotency insert failed:', idempoError);
    return new Response('Server error', { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = (session.client_reference_id ?? session.metadata?.company_id) as string | undefined;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;

        if (!companyId || !subscriptionId || !customerId) {
          console.warn('checkout.session.completed missing company_id/customer/subscription');
          break;
        }

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = sub.items.data[0]?.price?.id ?? null;
        const tier = resolveTier(priceId);
        await applyTier(
          companyId,
          tier,
          sub.status,
          customerId,
          subscriptionId,
          priceId,
          (sub.current_period_end ?? 0) * 1000,
        );
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const companyId = (sub.metadata?.company_id as string | undefined) ?? await findCompanyByCustomer(customerId);
        if (!companyId) {
          console.warn(`subscription ${event.type} — no company for customer ${customerId}`);
          break;
        }
        const priceId = sub.items.data[0]?.price?.id ?? null;
        const tier = resolveTier(priceId);
        await applyTier(
          companyId,
          tier,
          sub.status,
          customerId,
          sub.id,
          priceId,
          (sub.current_period_end ?? 0) * 1000,
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const companyId = (sub.metadata?.company_id as string | undefined) ?? await findCompanyByCustomer(customerId);
        if (!companyId) break;
        await applyTier(companyId, null, 'canceled', customerId, null, null, null);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
        if (!customerId) break;
        const companyId = await findCompanyByCustomer(customerId);
        if (!companyId) break;
        // Keep seats alive during grace period; just flag the status so the
        // client can nudge the user to update their card.
        await supabase
          .from('companies')
          .update({ stripe_status: 'past_due' })
          .eq('id', companyId);
        break;
      }

      // All other event types — acknowledged for idempotency, no side effects.
      default:
        break;
    }
  } catch (err) {
    console.error(`Stripe webhook handler error for ${event.type}:`, err);
    return new Response('Handler error', { status: 500 });
  }

  return jsonResponse({ received: true });
});
