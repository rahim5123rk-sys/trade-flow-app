-- Idempotency table for RevenueCat webhooks.
-- RevenueCat sends events at-least-once; this prevents duplicate side effects
-- (e.g. repeated profile updates, stale log noise, retry amplification).

CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  event_id     text PRIMARY KEY,
  event_type   text,
  app_user_id  text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS processed_webhook_events_processed_at_idx
  ON public.processed_webhook_events (processed_at DESC);

-- Table is managed solely by the service role from edge functions.
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies => no access from anon/authenticated roles.
