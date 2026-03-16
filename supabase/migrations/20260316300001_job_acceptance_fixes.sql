-- Fix: constrain on_job_assigned trigger to only fire on assigned_to changes
DROP TRIGGER IF EXISTS on_job_assigned ON public.jobs;
CREATE TRIGGER on_job_assigned
  AFTER UPDATE OF assigned_to ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_job_assigned();

-- Add index for worker_id queries (e.g. "show my pending jobs")
CREATE INDEX IF NOT EXISTS idx_job_acceptance_worker_id ON public.job_acceptance(worker_id);
