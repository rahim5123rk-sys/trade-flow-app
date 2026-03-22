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

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (WEBHOOK_SECRET) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let body: { event?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = body.event;
  if (!event) return new Response('Missing event', { status: 400 });

  const eventType = event.type as string;
  const appUserId = event.app_user_id as string | undefined;
  const productId = (event.product_id ?? '') as string;

  if (!appUserId) return new Response('Missing app_user_id', { status: 400 });

  const proEvents = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'];
  const expiredEvents = ['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'];
  const subType = getSubscriptionType(productId);

  // Look up the admin's company so we can sync all members
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', appUserId)
    .single();

  const companyId = adminProfile?.company_id;

  if (proEvents.includes(eventType)) {
    // Lifetime purchases never expire
    const expiresAt = subType === 'lifetime'
      ? null
      : (event.expiration_at_ms
        ? new Date(event.expiration_at_ms as number).toISOString()
        : null);

    // Update the purchasing admin
    await supabase
      .from('profiles')
      .update({
        subscription_tier: 'pro',
        subscription_type: subType,
        subscription_expires_at: expiresAt,
        revenuecat_user_id: appUserId,
      })
      .eq('id', appUserId);

    // Sync all company members to Pro
    if (companyId) {
      await supabase
        .from('profiles')
        .update({ subscription_tier: 'pro' })
        .eq('company_id', companyId)
        .neq('id', appUserId);
    }

  } else if (expiredEvents.includes(eventType)) {
    // Never downgrade a lifetime user on cancellation/expiration events
    if (subType === 'lifetime') {
      return new Response(JSON.stringify({ received: true, skipped: 'lifetime' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Downgrade the admin
    await supabase
      .from('profiles')
      .update({
        subscription_tier: 'starter',
        subscription_type: null,
        subscription_expires_at: null,
      })
      .eq('id', appUserId);

    // Downgrade all company members
    if (companyId) {
      await supabase
        .from('profiles')
        .update({
          subscription_tier: 'starter',
          subscription_type: null,
          subscription_expires_at: null,
        })
        .eq('company_id', companyId)
        .neq('id', appUserId);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
