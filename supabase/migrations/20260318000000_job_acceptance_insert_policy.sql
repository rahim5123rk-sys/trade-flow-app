-- Allow workers to insert their own acceptance row (fallback when Edge Function
-- hasn't created one). Restricted to their own worker_id and pending status only.
CREATE POLICY "worker_insert_own" ON public.job_acceptance
  FOR INSERT
  WITH CHECK (
    worker_id = auth.uid()
    AND status = 'pending'
  );
