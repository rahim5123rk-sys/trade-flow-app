// Starts the Xero OAuth 2.0 flow.
// Admin-only. Returns an auth URL the client opens in a browser.

import {
  CORS_HEADERS,
  XERO_CLIENT_ID,
  XERO_REDIRECT_URI,
  XERO_SCOPES,
  serviceClient,
  userFromAuthHeader,
} from '../_shared/xero.ts';

const AUTH_URL = 'https://login.xero.com/identity/connect/authorize';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const user = await userFromAuthHeader(req);
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401, headers: CORS_HEADERS });
  }

  const sb = serviceClient();

  const { data: profile, error: pErr } = await sb
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (pErr) return Response.json({ error: pErr.message }, { status: 500, headers: CORS_HEADERS });
  if (!profile?.company_id) return Response.json({ error: 'No company' }, { status: 400, headers: CORS_HEADERS });
  if (profile.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403, headers: CORS_HEADERS });

  // CSRF state token. Stored server-side, looked up on callback.
  const state = crypto.randomUUID();
  const { error: sErr } = await sb.from('xero_oauth_states').insert({
    state,
    user_id: user.id,
    company_id: profile.company_id,
  });
  if (sErr) return Response.json({ error: sErr.message }, { status: 500, headers: CORS_HEADERS });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: XERO_CLIENT_ID,
    redirect_uri: XERO_REDIRECT_URI,
    scope: XERO_SCOPES,
    state,
  });

  return Response.json(
    { url: `${AUTH_URL}?${params.toString()}` },
    { headers: CORS_HEADERS },
  );
});
