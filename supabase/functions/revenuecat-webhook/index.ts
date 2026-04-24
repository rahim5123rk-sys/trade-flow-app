// RevenueCat webhook — owns profiles.subscription_tier ONLY.
// Worker seat limits (team tiers) are owned exclusively by the Stripe webhook.
// Apple IAP here represents the Solo tier (£20/mo base); any upgrade above
// Solo is sold on the web via Stripe and flows through stripe-webhook.
// If you need to change seat counts, edit apply_stripe_seat_tier — NOT this file.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

function getSubscriptionType(productId: string): string {
  if (productId.includes('annual')) return 'annual';
  if (productId.includes('lifetime')) return 'lifetime';
  return 'monthly';
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  let mismatch = 0;
  for (let i = 0; i < aBytes.length; i++) mismatch |= aBytes[i] ^ bBytes[i];
  return mismatch === 0;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function setCompanyTier(
  appUserId: string,
  companyId: string | null,
  tier: 'pro' | 'starter',
  subType: string | null,
  expiresAt: string | null,
) {
  const payload: Record<string, unknown> = {
    subscription_tier: tier,
    subscription_type: subType,
    subscription_expires_at: expiresAt,
  };
  if (tier === 'pro') payload.revenuecat_user_id = appUserId;

  await supabase.from('profiles').update(payload).eq('id', appUserId);

  if (companyId) {
    await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        subscription_type: subType,
        subscription_expires_at: expiresAt,
      })
      .eq('company_id', companyId)
      .neq('id', appUserId);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!WEBHOOK_SECRET) {
    console.error('REVENUECAT_WEBHOOK_SECRET is not set; refusing all webhooks.');
    return new Response('Server misconfigured', { status: 500 });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const presented = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;
  if (!timingSafeEqual(presented, WEBHOOK_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { event?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = body.event;
  if (!event) return new Response('Missing event', { status: 400 });

  const eventId = event.id as string | undefined;
  const eventType = event.type as string;
  const appUserId = event.app_user_id as string | undefined;
  const transferredToUserId = event.transferred_to as string | undefined;
  const productId = (event.product_id ?? '') as string;

  if (!appUserId) return new Response('Missing app_user_id', { status: 400 });

  // Idempotency: RevenueCat delivers at-least-once. Reserve the event id up
  // front; if it's already there, short-circuit before any side effects.
  if (eventId) {
    const { error: idempoError } = await supabase
      .from('processed_webhook_events')
      .insert({
        event_id: eventId,
        event_type: eventType,
        app_user_id: appUserId,
      });

    if (idempoError) {
      // 23505 = unique_violation → already processed. Any other error is fatal
      // (we must not run side effects without idempotency protection).
      if (idempoError.code === '23505') {
        return jsonResponse({ received: true, duplicate: true });
      }
      console.error('Idempotency insert failed:', idempoError);
      return new Response('Server error', { status: 500 });
    }
  }

  const proEvents = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE'];
  const expiredEvents = ['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE', 'SUBSCRIPTION_PAUSED'];
  const refundEvents = ['REFUND'];
  const subType = getSubscriptionType(productId);

  // Look up the admin's company so we can sync all members
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', appUserId)
    .maybeSingle();

  const companyId = adminProfile?.company_id ?? null;

  if (proEvents.includes(eventType)) {
    const expiresAt = subType === 'lifetime'
      ? null
      : (event.expiration_at_ms
        ? new Date(event.expiration_at_ms as number).toISOString()
        : null);

    await setCompanyTier(appUserId, companyId, 'pro', subType, expiresAt);

  } else if (expiredEvents.includes(eventType)) {
    // Never downgrade a lifetime user on cancellation/expiration events
    if (subType === 'lifetime') {
      return jsonResponse({ received: true, skipped: 'lifetime' });
    }
    await setCompanyTier(appUserId, companyId, 'starter', null, null);

  } else if (refundEvents.includes(eventType)) {
    // Apple-initiated refund: revoke access immediately, regardless of expiry.
    await setCompanyTier(appUserId, companyId, 'starter', null, null);

  } else if (eventType === 'TRANSFER') {
    // Subscription transferred between App Store accounts.
    // `app_user_id` is the SOURCE; `transferred_to` is the new owner.
    // Downgrade the source, upgrade the destination (and their company).
    await setCompanyTier(appUserId, companyId, 'starter', null, null);

    if (transferredToUserId) {
      const { data: destProfile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', transferredToUserId)
        .maybeSingle();
      const destCompanyId = destProfile?.company_id ?? null;
      const expiresAt = event.expiration_at_ms
        ? new Date(event.expiration_at_ms as number).toISOString()
        : null;
      await setCompanyTier(transferredToUserId, destCompanyId, 'pro', subType, expiresAt);
    }
  }
  // Unhandled types (TEST, INVOICE_ISSUANCE, SUBSCRIBER_ALIAS, etc.) are logged
  // as processed above and acknowledged below — no side effects intended.

  return jsonResponse({ received: true });
});
