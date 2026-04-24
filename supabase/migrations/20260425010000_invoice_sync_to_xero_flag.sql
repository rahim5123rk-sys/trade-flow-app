-- Per-invoice opt-in/out flag for Xero sync.
-- New invoices default in the UI based on whether the company is connected,
-- while persisted rows always carry an explicit boolean.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS sync_to_xero boolean NOT NULL DEFAULT false;
