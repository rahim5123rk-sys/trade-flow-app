-- Single-use invite codes.
-- After a worker successfully joins a company, rotate the company's
-- invite_code to a fresh random value so the old one can't be reused.
-- Admin can always view/copy the current code from the app.

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';  -- no I, O
  nums    text := '23456789';                  -- no 0, 1
  result  text := '';
  i int;
BEGIN
  FOR i IN 1..3 LOOP
    result := result || substr(letters, 1 + floor(random() * length(letters))::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..3 LOOP
    result := result || substr(nums, 1 + floor(random() * length(nums))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_invite_code_on_worker_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  tries    int := 0;
BEGIN
  IF NEW.role <> 'worker' OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Generate a code that is not already in use. Collision space is large (36^6)
  -- but we retry a few times just in case.
  LOOP
    new_code := public.generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.companies WHERE invite_code = new_code);
    tries := tries + 1;
    IF tries > 5 THEN EXIT; END IF;
  END LOOP;

  UPDATE public.companies
     SET invite_code = new_code
   WHERE id = NEW.company_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rotate_invite_code_after_worker_join ON public.profiles;
CREATE TRIGGER rotate_invite_code_after_worker_join
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.rotate_invite_code_on_worker_join();
