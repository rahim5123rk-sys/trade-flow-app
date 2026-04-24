-- Hybrid billing: Apple IAP (Solo only) + Stripe (team upgrades on web).
-- Apple handles the £20/mo base via existing RevenueCat flow.
-- Stripe owns worker_seat_limit and team-tier pricing on the web portal.
--
-- Company-scoped columns (source of truth is the Stripe webhook):
--   stripe_customer_id          — cus_xxx; set on first Checkout
--   stripe_subscription_id      — sub_xxx; current active sub
--   stripe_price_id             — price_xxx; the Stripe Price object in use
--   stripe_seat_tier            — 'duo' | 'team' | 'crew' | 'fleet' (derived from price)
--   stripe_status               — 'active' | 'past_due' | 'canceled' | 'incomplete' | null
--   stripe_current_period_end   — timestamptz; when access ends if not renewed

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id        text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id    text,
  ADD COLUMN IF NOT EXISTS stripe_price_id           text,
  ADD COLUMN IF NOT EXISTS stripe_seat_tier          text,
  ADD COLUMN IF NOT EXISTS stripe_status             text,
  ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS companies_stripe_customer_id_key
  ON public.companies (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS companies_stripe_subscription_id_idx
  ON public.companies (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- RLS: admins read their own company's stripe fields via existing companies
-- SELECT policy. Writes are SECURITY DEFINER from the webhook only.

-- ─────────────────────────────────────────────────────────────
-- Set seat limit atomically based on Stripe tier. Called from the
-- stripe-webhook edge function with service role. Takes the new tier
-- name and resolves the seat count via a single mapping.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_stripe_seat_tier(
  p_company_id    uuid,
  p_tier          text,       -- 'duo' | 'team' | 'crew' | 'fleet' | null
  p_status        text,
  p_customer_id   text,
  p_subscription_id text,
  p_price_id      text,
  p_period_end    timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seat_count int;
BEGIN
  seat_count := CASE p_tier
    WHEN 'duo'   THEN 1
    WHEN 'team'  THEN 3
    WHEN 'crew'  THEN 5
    WHEN 'fleet' THEN 10
    ELSE 0
  END;

  UPDATE public.companies
  SET
    worker_seat_limit         = seat_count,
    stripe_customer_id        = COALESCE(p_customer_id, stripe_customer_id),
    stripe_subscription_id    = p_subscription_id,
    stripe_price_id           = p_price_id,
    stripe_seat_tier          = p_tier,
    stripe_status             = p_status,
    stripe_current_period_end = p_period_end
  WHERE id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_seat_tier(uuid,text,text,text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
-- service_role always has bypass; no explicit grant needed.

-- ─────────────────────────────────────────────────────────────
-- Resolver for the Stripe Checkout flow: given an authenticated admin,
-- return their company_id and any existing stripe_customer_id so the
-- edge function can create (or reuse) the customer.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stripe_checkout_context(p_user_id uuid)
RETURNS TABLE (
  company_id         uuid,
  company_name       text,
  stripe_customer_id text,
  admin_email        text,
  is_admin           boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.stripe_customer_id,
    p.email,
    (p.role = 'admin')::boolean
  FROM public.profiles p
  LEFT JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = p_user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.stripe_checkout_context(uuid) TO authenticated;
