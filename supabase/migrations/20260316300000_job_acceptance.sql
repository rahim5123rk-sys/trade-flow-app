-- supabase/migrations/20260316300000_job_acceptance.sql

-- Enable pg_net for trigger → Edge Function HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- job_acceptance table
CREATE TABLE public.job_acceptance (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, worker_id)
);

-- RLS
ALTER TABLE public.job_acceptance ENABLE ROW LEVEL SECURITY;

-- Workers and admins in same company can read
CREATE POLICY "read_own_company" ON public.job_acceptance
  FOR SELECT USING (
    worker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.company_id = (
          SELECT company_id FROM profiles WHERE id = job_acceptance.worker_id LIMIT 1
        )
    )
  );

-- Workers can only update their own rows; cannot change worker_id
CREATE POLICY "worker_update_own" ON public.job_acceptance
  FOR UPDATE
  USING (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

-- No INSERT policy for authenticated users — service role only (Edge Functions)

-- Trigger function: fires Edge Function on assigned_to change
CREATE OR REPLACE FUNCTION public.notify_job_assigned()
RETURNS TRIGGER AS $$
DECLARE
  old_assigned uuid[] := COALESCE(OLD.assigned_to, '{}');
  new_assigned uuid[] := COALESCE(NEW.assigned_to, '{}');
  payload jsonb;
  edge_url text;
BEGIN
  -- Only fire if assigned_to actually changed
  IF old_assigned = new_assigned THEN
    RETURN NEW;
  END IF;

  edge_url := current_setting('app.supabase_edge_url', true);
  IF edge_url IS NULL THEN
    -- Fallback: read from environment (set via Supabase Dashboard → project settings)
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'jobId',        NEW.id,
    'oldAssignedTo', old_assigned,
    'newAssignedTo', new_assigned
  );

  PERFORM net.http_post(
    url     := edge_url || '/assign-job-workers',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- AFTER UPDATE trigger (assigned_to changed)
DROP TRIGGER IF EXISTS on_job_assigned ON public.jobs;
CREATE TRIGGER on_job_assigned
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_job_assigned();

-- AFTER INSERT trigger (job created with workers already assigned)
CREATE OR REPLACE FUNCTION public.notify_job_created()
RETURNS TRIGGER AS $$
DECLARE
  edge_url text;
  payload  jsonb;
BEGIN
  IF COALESCE(array_length(NEW.assigned_to, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  edge_url := current_setting('app.supabase_edge_url', true);
  IF edge_url IS NULL THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'jobId',         NEW.id,
    'oldAssignedTo', '[]'::jsonb,
    'newAssignedTo', to_jsonb(NEW.assigned_to)
  );

  PERFORM net.http_post(
    url     := edge_url || '/assign-job-workers',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_job_created ON public.jobs;
CREATE TRIGGER on_job_created
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_job_created();
