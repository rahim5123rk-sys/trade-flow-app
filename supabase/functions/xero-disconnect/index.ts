// Admin-only. Revokes the Xero refresh token and deletes the connection row.
// After this, any push-invoice call will fail with "not connected".

import { CORS_HEADERS, XERO_CLIENT_ID, XERO_CLIENT_SECRET, serviceClient, userFromAuthHeader } from '../_shared/xero.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const user = await userFromAuthHeader(req);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401, headers: CORS_HEADERS });

  const sb = serviceClient();
  const { data: profile } = await sb.from('profiles').select('company_id, role').eq('id', user.id).maybeSingle();
  if (!profile?.company_id || profile.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403, headers: CORS_HEADERS });
  }

  const { data: conn } = await sb
    .from('xero_connections')
    .select('refresh_token')
    .eq('company_id', profile.company_id)
    .maybeSingle();

  if (conn?.refresh_token) {
    // Best-effort revoke; ignore errors (we still delete the row).
    try {
      await fetch('https://identity.xero.com/connect/revocation', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ token: conn.refresh_token }),
      });
    } catch {
      // swallow
    }
  }

  await sb.from('xero_connections').delete().eq('company_id', profile.company_id);

  return Response.json({ ok: true }, { headers: CORS_HEADERS });
});
