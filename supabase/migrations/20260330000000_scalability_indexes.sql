-- Scalability indexes for 1000+ user workloads

-- Customer detail page: fetches all jobs and documents for a customer
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id
  ON public.jobs (customer_id);

CREATE INDEX IF NOT EXISTS idx_documents_customer_id
  ON public.documents (customer_id);

-- Worker job list: uses array containment query on assigned_to (uuid[])
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to_gin
  ON public.jobs USING GIN (assigned_to);

-- Document-to-job lookups
CREATE INDEX IF NOT EXISTS idx_documents_job_id
  ON public.documents (job_id)
  WHERE job_id IS NOT NULL;

-- RLS policy support for job_parts
CREATE INDEX IF NOT EXISTS idx_job_parts_company_id
  ON public.job_parts (company_id);

-- Notes: compound index for the common list query pattern
CREATE INDEX IF NOT EXISTS idx_notes_user_company_archived
  ON public.notes (company_id, user_id, is_archived)
  INCLUDE (is_pinned, updated_at);
