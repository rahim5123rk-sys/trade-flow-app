-- Invite-code validation RPC with brute-force protection.
-- Anonymous (pre-registration) calls cannot be IP-bound from SQL alone, so we
-- defend with two throttles:
--   1. Per-code: 10 failed attempts in 1h locks that code out.
--   2. Global:   max 120 attempts/min across all callers slows enumeration
--      (search space 36^6 ≈ 2B codes → 60+ years at this rate).

CREATE TABLE IF NOT EXISTS public.invite_code_attempts (
  id           bigserial PRIMARY KEY,
  code         text        NOT NULL,
  was_valid    boolean     NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invite_code_attempts_code_time_idx
  ON public.invite_code_attempts (code, attempted_at DESC);
CREATE INDEX IF NOT EXISTS invite_code_attempts_time_idx
  ON public.invite_code_attempts (attempted_at DESC);

-- Table is managed solely by the SECURITY DEFINER RPC below.
ALTER TABLE public.invite_code_attempts ENABLE ROW LEVEL SECURITY;

-- Return jsonb: success → {company_id, company_name, worker_seat_limit, is_pro}
-- Errors     → {error: 'invalid' | 'rate_limited' | 'global_rate_limited'}
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm_code         text;
  per_code_failures int;
  global_attempts   int;
  company_row       record;
BEGIN
  norm_code := UPPER(TRIM(COALESCE(p_code, '')));

  IF norm_code = '' THEN
    RETURN jsonb_build_object('error', 'invalid');
  END IF;

  -- Global throttle: enumeration defense
  SELECT COUNT(*) INTO global_attempts
  FROM public.invite_code_attempts
  WHERE attempted_at > now() - interval '1 minute';

  IF global_attempts >= 120 THEN
    RETURN jsonb_build_object('error', 'global_rate_limited');
  END IF;

  -- Per-code throttle: brute-force defense
  SELECT COUNT(*) INTO per_code_failures
  FROM public.invite_code_attempts
  WHERE code = norm_code
    AND was_valid = false
    AND attempted_at > now() - interval '1 hour';

  IF per_code_failures >= 10 THEN
    INSERT INTO public.invite_code_attempts (code, was_valid)
    VALUES (norm_code, false);
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  -- Look up the company + admin's subscription tier
  SELECT c.id            AS company_id,
         c.name          AS company_name,
         COALESCE(c.worker_seat_limit, 0) AS worker_seat_limit,
         (p.subscription_tier = 'pro')    AS is_pro,
         (SELECT COUNT(*) FROM public.profiles
          WHERE company_id = c.id AND role = 'worker') AS worker_count
  INTO company_row
  FROM public.companies c
  LEFT JOIN public.profiles p
    ON p.company_id = c.id AND p.role = 'admin'
  WHERE c.invite_code = norm_code
  LIMIT 1;

  IF company_row.company_id IS NULL THEN
    INSERT INTO public.invite_code_attempts (code, was_valid)
    VALUES (norm_code, false);
    RETURN jsonb_build_object('error', 'invalid');
  END IF;

  INSERT INTO public.invite_code_attempts (code, was_valid)
  VALUES (norm_code, true);

  RETURN jsonb_build_object(
    'company_id',        company_row.company_id,
    'company_name',      company_row.company_name,
    'worker_seat_limit', company_row.worker_seat_limit,
    'worker_count',      company_row.worker_count,
    'is_pro',            COALESCE(company_row.is_pro, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invite_code(text) TO anon, authenticated;
