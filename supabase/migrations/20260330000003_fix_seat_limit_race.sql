-- ============================================
-- Fix worker seat limit race condition
-- Uses FOR UPDATE locking on the company row
-- to prevent concurrent worker registrations from
-- exceeding the seat limit.
-- ============================================

CREATE OR REPLACE FUNCTION public.check_worker_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  seat_limit integer;
  current_workers integer;
  company_tier text;
BEGIN
  -- Only check for worker role
  IF NEW.role != 'worker' OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lock the company row to prevent concurrent registrations
  SELECT c.worker_seat_limit, p.subscription_tier
  INTO seat_limit, company_tier
  FROM public.companies c
  JOIN public.profiles p ON p.company_id = c.id AND p.role = 'admin'
  WHERE c.id = NEW.company_id
  FOR UPDATE OF c;

  -- Allow if company is not pro (handled by other checks)
  IF company_tier IS NULL OR company_tier != 'pro' THEN
    RETURN NEW;
  END IF;

  -- Default seat limit
  IF seat_limit IS NULL THEN
    seat_limit := 1;
  END IF;

  -- Count current workers (excluding the one being inserted)
  SELECT COUNT(*) INTO current_workers
  FROM public.profiles
  WHERE company_id = NEW.company_id AND role = 'worker';

  IF current_workers >= seat_limit THEN
    RAISE EXCEPTION 'Worker seat limit reached (% of % seats)', current_workers, seat_limit;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists from 20260316000000 — no need to recreate
