-- Email delivery tracking table
-- Stores Resend message IDs and webhook-delivered status updates

CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  resend_message_id text,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'delivered', 'opened', 'bounced', 'complained')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookup by document
CREATE INDEX idx_email_events_document_id ON email_events(document_id);

-- Index for webhook lookups by resend message id
CREATE INDEX idx_email_events_resend_message_id ON email_events(resend_message_id);

-- RLS policies
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Users can read email events for their own company's documents
CREATE POLICY "Users can read own company email events"
  ON email_events FOR SELECT
  USING (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN profiles p ON p.company_id = d.company_id
      WHERE p.id = auth.uid()
    )
  );

-- Users can insert email events for their own company's documents
CREATE POLICY "Users can insert own company email events"
  ON email_events FOR INSERT
  WITH CHECK (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN profiles p ON p.company_id = d.company_id
      WHERE p.id = auth.uid()
    )
  );
