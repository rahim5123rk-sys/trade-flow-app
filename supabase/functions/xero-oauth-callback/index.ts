// Xero redirects here after the user authorises the app.
// Exchanges the code for tokens, stores them, then redirects to the
// web success page so the mobile app's in-app browser can detect completion.

import {
  XERO_SUCCESS_URL,
  exchangeCodeForToken,
  fetchFirstTenant,
  serviceClient,
} from '../_shared/xero.ts';

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req) => {
  const urlObj = new URL(req.url);
  const code = urlObj.searchParams.get('code');
  const state = urlObj.searchParams.get('state');
  const error = urlObj.searchParams.get('error');

  if (error) return redirect(`${XERO_SUCCESS_URL}?ok=0&error=${encodeURIComponent(error)}`);
  if (!code || !state) return redirect(`${XERO_SUCCESS_URL}?ok=0&error=missing_code`);

  const sb = serviceClient();

  // Look up + consume the state row (one-shot; CSRF guard).
  const { data: stateRow, error: sErr } = await sb
    .from('xero_oauth_states')
    .select('user_id, company_id, created_at')
    .eq('state', state)
    .maybeSingle();
  if (sErr || !stateRow) return redirect(`${XERO_SUCCESS_URL}?ok=0&error=invalid_state`);
  await sb.from('xero_oauth_states').delete().eq('state', state);

  // Reject states older than 10 minutes.
  if (Date.now() - new Date(stateRow.created_at).getTime() > 10 * 60 * 1000) {
    return redirect(`${XERO_SUCCESS_URL}?ok=0&error=state_expired`);
  }

  try {
    const token = await exchangeCodeForToken(code);
    const { tenantId, tenantName } = await fetchFirstTenant(token.access_token);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    const { error: upErr } = await sb
      .from('xero_connections')
      .upsert({
        company_id: stateRow.company_id,
        tenant_id: tenantId,
        tenant_name: tenantName,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: expiresAt,
        scope: token.scope ?? null,
        connected_by: stateRow.user_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id' });
    if (upErr) throw upErr;

    return redirect(`${XERO_SUCCESS_URL}?ok=1&tenant=${encodeURIComponent(tenantName)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return redirect(`${XERO_SUCCESS_URL}?ok=0&error=${encodeURIComponent(msg.slice(0, 200))}`);
  }
});
