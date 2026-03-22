-- Enforce worker seat limits server-side
-- Prevents workers from joining a company if seat limit is reached

CREATE OR REPLACE FUNCTION public.check_worker_seat_limit()
RETURNS TRIGGER AS $$
DECLARE
  seat_limit integer;
  current_workers integer;
  admin_tier text;
BEGIN
  -- Only check for worker role inserts
  IF NEW.role != 'worker' OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check admin has Pro subscription
  SELECT subscription_tier INTO admin_tier
  FROM public.profiles
  WHERE company_id = NEW.company_id AND role = 'admin'
  LIMIT 1;

  IF admin_tier IS NULL OR admin_tier != 'pro' THEN
    RAISE EXCEPTION 'Company does not have an active Pro subscription';
  END IF;

  -- Check seat limit
  SELECT worker_seat_limit INTO seat_limit
  FROM public.companies
  WHERE id = NEW.company_id;

  IF seat_limit IS NULL THEN
    seat_limit := 0;
  END IF;

  -- Count current workers (excluding the one being inserted)
  SELECT COUNT(*) INTO current_workers
  FROM public.profiles
  WHERE company_id = NEW.company_id AND role = 'worker';

  IF current_workers >= seat_limit THEN
    RAISE EXCEPTION 'Worker seat limit reached. Current: %, Limit: %', current_workers, seat_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS enforce_worker_seat_limit ON public.profiles;

CREATE TRIGGER enforce_worker_seat_limit
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_worker_seat_limit();
