-- Admin-only RPC to remove a worker from their company.
-- Does NOT delete the worker's auth user or their historical data —
-- it unlinks them (company_id = NULL, subscription_tier = 'starter').
-- The worker can then be re-invited, or sign up with a different company.

CREATE OR REPLACE FUNCTION public.remove_worker_from_company(p_worker_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_company_id uuid;
  caller_role       text;
  target_company_id uuid;
  target_role       text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT company_id, role INTO caller_company_id, caller_role
    FROM public.profiles WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can remove workers' USING ERRCODE = '42501';
  END IF;

  SELECT company_id, role INTO target_company_id, target_role
    FROM public.profiles WHERE id = p_worker_id;

  IF target_company_id IS DISTINCT FROM caller_company_id THEN
    RAISE EXCEPTION 'Worker is not in your company' USING ERRCODE = '42501';
  END IF;

  IF target_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot remove the admin from the company' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET company_id = NULL,
         subscription_tier = 'starter',
         subscription_type = NULL,
         subscription_expires_at = NULL
   WHERE id = p_worker_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_worker_from_company(uuid) TO authenticated;
