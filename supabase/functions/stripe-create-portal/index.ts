// Returns a Stripe Customer Portal URL for an authenticated admin. Lets them
// upgrade/downgrade/cancel without us building a billing UI.

import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
const ALLOWED_ORIGIN = Deno.env.get('STRIPE_CHECKOUT_ORIGIN') ?? 'https://gaspilotapp.com';

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

  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userError } = await userSupabase.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'Unauthorized' }, 401);
  const userId = userData.user.id;

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: ctxRows } = await adminSupabase
    .rpc('stripe_checkout_context', { p_user_id: userId });
  const ctx = Array.isArray(ctxRows) ? ctxRows[0] : ctxRows;
  if (!ctx?.company_id) return jsonResponse({ error: 'No company' }, 404);
  if (!ctx.is_admin) return jsonResponse({ error: 'Only admins can manage billing' }, 403);
  if (!ctx.stripe_customer_id) return jsonResponse({ error: 'No billing account yet' }, 404);

  const session = await stripe.billingPortal.sessions.create({
    customer: ctx.stripe_customer_id,
    return_url: `${ALLOWED_ORIGIN}/team`,
  });

  return jsonResponse({ url: session.url });
});
