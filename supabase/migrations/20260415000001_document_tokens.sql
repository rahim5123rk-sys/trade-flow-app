-- Secure tokens for customer actions on documents (e.g. quote accept/decline)
-- Tokens are single-use and expire after 30 days

CREATE TABLE IF NOT EXISTS document_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  action text CHECK (action IN ('accept', 'decline')),
  customer_message text,
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast token lookup (the main query path)
CREATE INDEX idx_document_tokens_token ON document_tokens(token);

-- Index for finding tokens by document
CREATE INDEX idx_document_tokens_document_id ON document_tokens(document_id);

-- RLS policies
ALTER TABLE document_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read tokens for their own company's documents
CREATE POLICY "Users can read own company document tokens"
  ON document_tokens FOR SELECT
  USING (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN profiles p ON p.company_id = d.company_id
      WHERE p.id = auth.uid()
    )
  );

-- Users can insert tokens for their own company's documents
CREATE POLICY "Users can insert own company document tokens"
  ON document_tokens FOR INSERT
  WITH CHECK (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN profiles p ON p.company_id = d.company_id
      WHERE p.id = auth.uid()
    )
  );
