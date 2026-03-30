-- Atomic worker seat increment to prevent read-modify-write race condition
CREATE OR REPLACE FUNCTION public.increment_worker_seat(
  p_company_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_limit integer;
BEGIN
  UPDATE public.companies
  SET worker_seat_limit = COALESCE(worker_seat_limit, 0) + 1
  WHERE id = p_company_id
  RETURNING worker_seat_limit INTO v_new_limit;
  
  RETURN v_new_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_worker_seat(uuid) TO authenticated;
