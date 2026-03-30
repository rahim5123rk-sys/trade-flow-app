-- Performance indexes for scaling to 1000+ users

CREATE INDEX IF NOT EXISTS idx_jobs_company_status
  ON public.jobs (company_id, status);

CREATE INDEX IF NOT EXISTS idx_jobs_company_scheduled
  ON public.jobs (company_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_documents_company_type
  ON public.documents (company_id, type);

CREATE INDEX IF NOT EXISTS idx_documents_company_created
  ON public.documents (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_company_expiry
  ON public.documents (company_id, expiry_date);

CREATE INDEX IF NOT EXISTS idx_customers_company_name
  ON public.customers (company_id, name);

CREATE INDEX IF NOT EXISTS idx_notes_user_archived
  ON public.notes (user_id, is_archived);

CREATE INDEX IF NOT EXISTS idx_profiles_company_role
  ON public.profiles (company_id, role);
