-- ============================================
-- Atomic job reference counter
-- Replaces the read-modify-write on companies.settings.nextJobNumber
-- with an atomic counter using the same pattern as gas cert / invoice / quote refs.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_next_job_reference(
  reserve boolean DEFAULT true,
  p_company_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  counter_key text;
  next_value bigint;
BEGIN
  counter_key := 'job_ref:' || COALESCE(p_company_id::text, 'global');

  IF reserve THEN
    INSERT INTO public.global_counters (key, value, updated_at)
    VALUES (counter_key, 1, now())
    ON CONFLICT (key) DO UPDATE
      SET value = global_counters.value + 1,
          updated_at = now()
    RETURNING value INTO next_value;
  ELSE
    INSERT INTO public.global_counters (key, value)
    VALUES (counter_key, 0)
    ON CONFLICT (key) DO NOTHING;

    SELECT value + 1
    INTO next_value
    FROM public.global_counters
    WHERE key = counter_key;
  END IF;

  IF next_value IS NULL THEN
    next_value := 1;
  END IF;

  RETURN 'JOB-' || LPAD(next_value::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_job_reference(boolean, uuid) TO authenticated;
