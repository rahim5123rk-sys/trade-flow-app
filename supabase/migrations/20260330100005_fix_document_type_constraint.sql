-- Allow all gas form types in the documents.type column
-- Previously only 'invoice' and 'quote' were allowed, causing gas forms
-- to fall back to 'quote' type silently

-- Drop existing constraint (name may vary depending on how table was created)
DO $$
BEGIN
  -- Try dropping common constraint names
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS check_type;
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_fkey;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add new constraint with all valid document types
ALTER TABLE documents ADD CONSTRAINT documents_type_check
  CHECK (type IN (
    'invoice',
    'quote',
    'cp12',
    'service_record',
    'commissioning',
    'decommissioning',
    'warning_notice',
    'breakdown_report',
    'installation_cert'
  ));

-- Fix existing documents that were incorrectly saved as 'quote'
-- Identify them by checking if payment_info contains a locked payload with a 'kind' field
UPDATE documents
SET type = (payment_info::jsonb->>'kind')
WHERE type = 'quote'
  AND payment_info IS NOT NULL
  AND payment_info::jsonb->>'kind' IS NOT NULL
  AND payment_info::jsonb->>'kind' != 'quote';
