-- Xero integration: connection + sync tracking tables.

CREATE TABLE IF NOT EXISTS public.xero_connections (
  company_id    uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  tenant_id     text        NOT NULL,
  tenant_name   text,
  access_token  text        NOT NULL,
  refresh_token text        NOT NULL,
  expires_at    timestamptz NOT NULL,
  scope         text,
  connected_by  uuid        REFERENCES public.profiles(id),
  connected_at  timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Short-lived OAuth state tokens (CSRF). Inserted by xero-oauth-start,
-- consumed by xero-oauth-callback. Rows older than 10 min are stale.
CREATE TABLE IF NOT EXISTS public.xero_oauth_states (
  state      text        PRIMARY KEY,
  user_id    uuid        NOT NULL,
  company_id uuid        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Document → Xero invoice mapping. Keyed on document_id so we never
-- double-push the same invoice (upsert on re-send).
CREATE TABLE IF NOT EXISTS public.xero_invoice_sync (
  document_id         uuid        PRIMARY KEY REFERENCES public.documents(id) ON DELETE CASCADE,
  company_id          uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  xero_invoice_id     text        NOT NULL,
  xero_invoice_number text,
  status              text        NOT NULL DEFAULT 'DRAFT',
  synced_at           timestamptz NOT NULL DEFAULT now(),
  last_error          text
);

CREATE INDEX IF NOT EXISTS xero_invoice_sync_company_idx
  ON public.xero_invoice_sync (company_id);

-- Customer → Xero contact mapping.
CREATE TABLE IF NOT EXISTS public.xero_contact_sync (
  customer_id      uuid        PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id       uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  xero_contact_id  text        NOT NULL,
  synced_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS xero_contact_sync_company_idx
  ON public.xero_contact_sync (company_id);

-- RLS: only admins of the owning company can read connection metadata.
-- Tokens are never exposed to clients — edge functions use service role.
ALTER TABLE public.xero_connections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_oauth_states   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_invoice_sync   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_contact_sync   ENABLE ROW LEVEL SECURITY;

-- Admin-only read of their company's connection (no raw token columns).
CREATE POLICY xero_connections_read_admin
  ON public.xero_connections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid()
         AND role = 'admin'
         AND company_id = xero_connections.company_id
    )
  );

CREATE POLICY xero_invoice_sync_read
  ON public.xero_invoice_sync
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid()
         AND company_id = xero_invoice_sync.company_id
    )
  );

CREATE POLICY xero_contact_sync_read
  ON public.xero_contact_sync
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid()
         AND company_id = xero_contact_sync.company_id
    )
  );

-- View that exposes connection status without the tokens. Clients use this
-- to show "Connected to {tenant_name}" without ever seeing secrets.
CREATE OR REPLACE VIEW public.xero_connection_status AS
SELECT
  company_id,
  tenant_name,
  connected_at,
  (expires_at > now()) AS token_valid
FROM public.xero_connections;

GRANT SELECT ON public.xero_connection_status TO authenticated;
