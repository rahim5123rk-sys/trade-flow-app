// POST /admin-grant-pro
//   Body (grant):  { target_user_id: uuid, expires_at: ISO|null, reason: string >=5 chars }
//   Body (revoke): { target_user_id: uuid, revoke: true }
// Sets or clears admin_override flags + subscription_tier on the target profile.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin } from '../_shared/admin-auth.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ADMIN_DASHBOARD_ORIGIN') ?? 'https://admin.gaspilotapp.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let callerId: string;
  try { callerId = await requireAdmin(req); }
  catch (resp) { return resp instanceof Response ? resp : json({ error: 'Unauthorized' }, 401); }

  let body: { target_user_id?: string; expires_at?: string | null; reason?: string; revoke?: boolean };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.target_user_id) return json({ error: 'target_user_id required' }, 400);

  if (body.revoke) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        admin_override: false,
        admin_override_expires_at: null,
        admin_override_reason: null,
        admin_override_granted_by: null,
        admin_override_granted_at: null,
      })
      .eq('id', body.target_user_id)
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);
    return json({ profile: data });
  }

  const { expires_at, reason } = body;
  if (typeof reason !== 'string' || reason.trim().length < 5) {
    return json({ error: 'reason must be at least 5 characters' }, 400);
  }
  if (reason.length > 500) return json({ error: 'reason must be at most 500 characters' }, 400);

  const update = {
    admin_override: true,
    admin_override_expires_at: expires_at ?? null,
    admin_override_reason: reason.trim(),
    admin_override_granted_by: callerId,
    admin_override_granted_at: new Date().toISOString(),
    subscription_tier: 'pro' as const,
    subscription_expires_at: expires_at ?? null,
  };

  const { data, error } = await supabase
    .from('profiles').update(update).eq('id', body.target_user_id).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ profile: data });
});
