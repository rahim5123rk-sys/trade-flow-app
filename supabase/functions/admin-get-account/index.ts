// POST /admin-get-account
//   Body: { target_user_id: uuid }
// Returns auth-only fields (last_sign_in_at, email) the dashboard cannot
// read with the anon key.

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

  try { await requireAdmin(req); }
  catch (resp) { return resp instanceof Response ? resp : json({ error: 'Unauthorized' }, 401); }

  let body: { target_user_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.target_user_id) return json({ error: 'target_user_id required' }, 400);

  const { data, error } = await supabase.auth.admin.getUserById(body.target_user_id);
  if (error || !data?.user) return json({ error: 'user not found' }, 404);

  return json({
    last_sign_in_at: data.user.last_sign_in_at ?? null,
    email: data.user.email ?? null,
  });
});
