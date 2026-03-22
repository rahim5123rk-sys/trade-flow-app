-- RPC to check if a company's admin has an active Pro subscription (Security Definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.check_company_pro_status(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
BEGIN
  SELECT subscription_tier INTO v_tier
  FROM public.profiles
  WHERE company_id = p_company_id AND role = 'admin'
  LIMIT 1;

  RETURN COALESCE(v_tier = 'pro', false);
END;
$$;

-- RPC to get the current number of workers in a company (Security Definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_company_worker_count(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.profiles
  WHERE company_id = p_company_id AND role != 'admin';

  RETURN COALESCE(v_count, 0);
END;
$$;