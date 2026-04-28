// POST /admin-refresh-subscription
//   Body: { target_user_id: uuid }
// Re-pulls the user's RC + Stripe state and writes the truth back.
// Respects active overrides: audit fields update, entitlement fields don't.

import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin } from '../_shared/admin-auth.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);
const stripe = Deno.env.get('STRIPE_SECRET_KEY')
  ? new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-12-18.acacia', httpClient: Stripe.createFetchHttpClient() })
  : null;
const RC_KEY = Deno.env.get('REVENUECAT_REST_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ADMIN_DASHBOARD_ORIGIN') ?? 'https://admin.gaspilotapp.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

type ProfileBefore = {
  id: string;
  subscription_tier: string | null;
  subscription_type: string | null;
  subscription_expires_at: string | null;
  revenuecat_user_id: string | null;
  admin_override: boolean;
  admin_override_expires_at: string | null;
  company_id: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try { await requireAdmin(req); }
  catch (resp) { return resp instanceof Response ? resp : json({ error: 'Unauthorized' }, 401); }

  let body: { target_user_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.target_user_id) return json({ error: 'target_user_id required' }, 400);

  const { data: before } = await supabase
    .from('profiles')
    .select('id, subscription_tier, subscription_type, subscription_expires_at, revenuecat_user_id, admin_override, admin_override_expires_at, company_id')
    .eq('id', body.target_user_id)
    .maybeSingle<ProfileBefore>();
  if (!before) return json({ error: 'profile not found' }, 404);

  const overrideActive = before.admin_override && (
    !before.admin_override_expires_at
    || new Date(before.admin_override_expires_at).getTime() > Date.now()
  );

  // 1. Pull RC truth.
  let rcHasPro = false;
  let rcExpiresAt: string | null = null;
  let rcType: string | null = null;
  if (RC_KEY && before.revenuecat_user_id) {
    const resp = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(before.revenuecat_user_id)}`, {
      headers: { Authorization: `Bearer ${RC_KEY}` },
    });
    if (resp.ok) {
      const data = await resp.json();
      const proEnt = data?.subscriber?.entitlements?.pro;
      if (proEnt) {
        const expiresMs = proEnt.expires_date ? Date.parse(proEnt.expires_date) : null;
        rcHasPro = !expiresMs || expiresMs > Date.now();
        rcExpiresAt = proEnt.expires_date ?? null;
        const productId: string = proEnt.product_identifier ?? '';
        rcType = productId.includes('annual') ? 'annual'
               : productId.includes('lifetime') ? 'lifetime'
               : 'monthly';
      }
    }
  }

  // 2. Observe Stripe (read-only — stripe-webhook owns companies.stripe_*).
  let observedStripeStatus: string | null = null;
  let companySnapshot: { id: string; stripe_status: string | null; stripe_seat_tier: string | null; worker_seat_limit: number | null } | null = null;
  if (before.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('id, stripe_customer_id, stripe_status, stripe_seat_tier, worker_seat_limit')
      .eq('id', before.company_id)
      .maybeSingle();
    companySnapshot = company ? {
      id: company.id, stripe_status: company.stripe_status,
      stripe_seat_tier: company.stripe_seat_tier, worker_seat_limit: company.worker_seat_limit,
    } : null;
    if (stripe && company?.stripe_customer_id) {
      const subs = await stripe.subscriptions.list({ customer: company.stripe_customer_id, status: 'all', limit: 5 });
      const active = subs.data.find(s => ['active', 'trialing', 'past_due'].includes(s.status));
      observedStripeStatus = active?.status ?? subs.data[0]?.status ?? null;
    }
  }

  // 3. Write entitlement fields (skip if override active).
  const updates: Record<string, unknown> = {};
  if (!overrideActive) {
    updates.subscription_tier = rcHasPro ? 'pro' : 'starter';
    updates.subscription_type = rcType;
    updates.subscription_expires_at = rcExpiresAt;
  }
  if (Object.keys(updates).length > 0) {
    await supabase.from('profiles').update(updates).eq('id', before.id);
  }

  const { data: after } = await supabase
    .from('profiles')
    .select('id, subscription_tier, subscription_type, subscription_expires_at, revenuecat_user_id, admin_override, admin_override_expires_at, company_id')
    .eq('id', before.id)
    .single();

  return json({
    before: { profile: before, company: companySnapshot },
    after:  { profile: after,  company: companySnapshot, observed_stripe_status: observedStripeStatus },
    override_active: overrideActive,
  });
});
