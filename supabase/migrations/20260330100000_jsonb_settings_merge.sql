-- Create an RPC that deep-merges partial settings into the existing JSONB
-- instead of overwriting the entire column.
CREATE OR REPLACE FUNCTION public.merge_company_settings(
  p_company_id uuid,
  p_settings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.companies
  SET settings = COALESCE(settings, '{}'::jsonb) || p_settings
  WHERE id = p_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_company_settings(uuid, jsonb) TO authenticated;
