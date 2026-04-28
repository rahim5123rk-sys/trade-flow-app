// Shared admin authentication for dashboard-callable Edge Functions.
//
//   const userId = await requireAdmin(req);
//
// Verifies the bearer token via supabase.auth.getUser() and checks the
// resolved user id against ALLOWED_ADMIN_IDS (CSV env var). Throws a
// Response on failure so handlers can `try/catch` and return it directly.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseAllowlist, isAllowed } from './admin-auth-parse.ts';

export { parseAllowlist, isAllowed };

export async function requireAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const allowlist = parseAllowlist(Deno.env.get('ALLOWED_ADMIN_IDS'));
  if (!isAllowed(allowlist, data.user.id)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  return data.user.id;
}
