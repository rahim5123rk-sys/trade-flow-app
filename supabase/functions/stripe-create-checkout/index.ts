// Creates a Stripe Checkout Session for an admin upgrading to a team tier.
// Called from the website (pilotlight) /team page. Requires the caller's
// Supabase JWT so we can map auth → company deterministically.

import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
const ALLOWED_ORIGIN = Deno.env.get('STRIPE_CHECKOUT_ORIGIN') ?? 'https://gaspilotapp.com';
const SUCCESS_PATH = '/team?checkout=success';
const CANCEL_PATH = '/team?checkout=cancel';

const stripe = STRIPE_SECRET
  ? new Stripe(STRIPE_SECRET, { apiVersion: '2024-12-18.acacia', httpClient: Stripe.createFetchHttpClient() })
  : null;

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!stripe) return jsonResponse({ error: 'Server misconfigured' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401);

  // Authenticate the caller via their Supabase JWT.
  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userError } = await userSupabase.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'Unauthorized' }, 401);
  const userId = userData.user.id;

  let payload: { price_id?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  const priceId = payload.price_id;
  if (!priceId) return jsonResponse({ error: 'Missing price_id' }, 400);

  // Look up the admin's company context via SECURITY DEFINER RPC.
  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: ctxRows, error: ctxError } = await adminSupabase
    .rpc('stripe_checkout_context', { p_user_id: userId });
  if (ctxError) return jsonResponse({ error: 'Lookup failed' }, 500);
  const ctx = Array.isArray(ctxRows) ? ctxRows[0] : ctxRows;
  if (!ctx?.company_id) return jsonResponse({ error: 'No company' }, 404);
  if (!ctx.is_admin) return jsonResponse({ error: 'Only admins can manage billing' }, 403);

  // Reuse existing customer if we have one; otherwise let Stripe create one
  // bound to the admin's email and our company_id in metadata.
  let customerId = ctx.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: ctx.admin_email ?? undefined,
      name: ctx.company_name ?? undefined,
      metadata: { company_id: ctx.company_id, admin_user_id: userId },
    });
    customerId = customer.id;
    await adminSupabase
      .from('companies')
      .update({ stripe_customer_id: customerId })
      .eq('id', ctx.company_id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: ctx.company_id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: { company_id: ctx.company_id, admin_user_id: userId },
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    success_url: `${ALLOWED_ORIGIN}${SUCCESS_PATH}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${ALLOWED_ORIGIN}${CANCEL_PATH}`,
  });

  return jsonResponse({ url: session.url });
});
