-- ============================================================
-- Migration: Server-side atomic account deletion (GDPR)
-- Creates a SECURITY DEFINER function that atomically deletes
-- all user data and the auth.users row in one transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_company_id uuid;
  v_role     text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Look up the caller's profile
  SELECT company_id, role
    INTO v_company_id, v_role
    FROM profiles
   WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- If the caller is the company admin, cascade-delete all company data
  IF v_role = 'admin' AND v_company_id IS NOT NULL THEN
    -- Activity logs
    DELETE FROM job_activity WHERE company_id = v_company_id;

    -- Documents (invoices / quotes)
    DELETE FROM documents WHERE company_id = v_company_id;

    -- Jobs
    DELETE FROM jobs WHERE company_id = v_company_id;

    -- Customers
    DELETE FROM customers WHERE company_id = v_company_id;

    -- Remove other team members' profiles (workers) so they aren't orphaned
    DELETE FROM profiles WHERE company_id = v_company_id AND id != v_user_id;

    -- Delete the company itself
    DELETE FROM companies WHERE id = v_company_id;
  END IF;

  -- Delete the caller's own profile
  DELETE FROM profiles WHERE id = v_user_id;

  -- Delete the auth.users row (GDPR: full erasure)
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

-- Only authenticated users can call this function
REVOKE ALL ON FUNCTION public.delete_user_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
