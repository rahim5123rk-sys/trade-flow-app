-- ============================================
-- Optimize RLS policies to use current_user_company_id()
-- instead of subqueries on profiles table.
-- The function was created in 20260302103000.
-- ============================================

-- -----------------------------------------------
-- site_addresses: 3 policies (SELECT, INSERT, UPDATE)
-- -----------------------------------------------
DROP POLICY IF EXISTS "Company members can view site addresses" ON public.site_addresses;
CREATE POLICY "Company members can view site addresses"
  ON public.site_addresses
  FOR SELECT
  USING (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "Company members can insert site addresses" ON public.site_addresses;
CREATE POLICY "Company members can insert site addresses"
  ON public.site_addresses
  FOR INSERT
  WITH CHECK (company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "Company members can update site addresses" ON public.site_addresses;
CREATE POLICY "Company members can update site addresses"
  ON public.site_addresses
  FOR UPDATE
  USING (company_id = public.current_user_company_id());

-- -----------------------------------------------
-- notes: 1 policy (ALL) — user_id check remains
-- -----------------------------------------------
DROP POLICY IF EXISTS "Users can manage their own notes" ON public.notes;
CREATE POLICY "Users can manage their own notes"
  ON public.notes FOR ALL
  USING (
    company_id = public.current_user_company_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    company_id = public.current_user_company_id()
    AND user_id = auth.uid()
  );

-- -----------------------------------------------
-- job_parts: 1 policy (ALL)
-- -----------------------------------------------
DROP POLICY IF EXISTS "Users can manage parts for their company jobs" ON public.job_parts;
CREATE POLICY "Users can manage parts for their company jobs"
  ON public.job_parts FOR ALL
  USING (company_id = public.current_user_company_id())
  WITH CHECK (company_id = public.current_user_company_id());

-- -----------------------------------------------
-- job_acceptance: optimise read policy
-- The old policy did a correlated subquery for admin check.
-- New version uses current_user_company_id() for the admin path.
-- -----------------------------------------------
DROP POLICY IF EXISTS "read_own_company" ON public.job_acceptance;
CREATE POLICY "read_own_company" ON public.job_acceptance
  FOR SELECT USING (
    worker_id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
      )
      AND EXISTS (
        SELECT 1 FROM public.profiles pw
        WHERE pw.id = job_acceptance.worker_id
          AND pw.company_id = public.current_user_company_id()
      )
    )
  );
