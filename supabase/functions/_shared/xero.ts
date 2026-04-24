// Shared Xero OAuth 2.0 + API helpers used by xero-* edge functions.
//
// Token lifecycle:
//   - access_token lives 30 min
//   - refresh_token lives 60 days, rotates on each refresh
//   - We refresh ~5 min before expiry to avoid mid-call failures

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export const XERO_CLIENT_ID = Deno.env.get('XERO_CLIENT_ID') ?? '';
export const XERO_CLIENT_SECRET = Deno.env.get('XERO_CLIENT_SECRET') ?? '';
export const XERO_REDIRECT_URI = Deno.env.get('XERO_REDIRECT_URI') ?? '';
export const XERO_SUCCESS_URL = Deno.env.get('XERO_SUCCESS_URL') ?? 'https://gaspilotapp.com/xero-connected';

export const XERO_SCOPES = 'openid profile email accounting.transactions accounting.contacts offline_access';

const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

export async function userFromAuthHeader(req: Request): Promise<{ id: string; email?: string } | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: XERO_REDIRECT_URI,
  });
  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero token exchange failed (${res.status}): ${text}`);
  }
  return await res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero token refresh failed (${res.status}): ${text}`);
  }
  return await res.json();
}

export async function fetchFirstTenant(accessToken: string): Promise<{ tenantId: string; tenantName: string }> {
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Xero /connections failed: ${res.status}`);
  const tenants = await res.json() as Array<{ tenantId: string; tenantName: string }>;
  if (!tenants.length) throw new Error('No Xero organisations authorised.');
  return { tenantId: tenants[0].tenantId, tenantName: tenants[0].tenantName };
}

// Returns a fresh access token for the given company, refreshing if needed.
// Updates the DB row on refresh (rotating refresh_token).
export async function getFreshAccessToken(sb: SupabaseClient, companyId: string): Promise<{ accessToken: string; tenantId: string }> {
  const { data: conn, error } = await sb
    .from('xero_connections')
    .select('access_token, refresh_token, expires_at, tenant_id')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw error;
  if (!conn) throw new Error('Xero not connected for this company.');

  const expiresAt = new Date(conn.expires_at).getTime();
  const nowMs = Date.now();
  if (expiresAt - nowMs > 5 * 60 * 1000) {
    return { accessToken: conn.access_token, tenantId: conn.tenant_id };
  }

  const refreshed = await refreshAccessToken(conn.refresh_token);
  const newExpiresAt = new Date(nowMs + refreshed.expires_in * 1000).toISOString();
  await sb
    .from('xero_connections')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId);

  return { accessToken: refreshed.access_token, tenantId: conn.tenant_id };
}

export async function xeroApi<T = unknown>(
  path: string,
  accessToken: string,
  tenantId: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Xero-Tenant-Id', tenantId);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`https://api.xero.com${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Xero API ${path} failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {} as T;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  id_token?: string;
}

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
