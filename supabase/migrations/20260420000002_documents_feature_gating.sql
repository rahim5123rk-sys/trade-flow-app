-- Server-side enforcement of Starter/Pro feature gating.
-- Client-side gating can be bypassed by crafting direct RPC calls or using
-- intercepted JWTs. These triggers are the final guardrail.
--
-- Starter tier:
--   * May create CP12 gas safety certs, up to 10 per calendar month
--   * May NOT create other gas forms (service_record, commissioning, etc.)
--   * May NOT create invoices or quotes
--   * May hold up to 10 customers
--
-- Pro tier:
--   * All features unlimited
--
-- Subscription tier is read from the COMPANY ADMIN's profile so that workers
-- inherit correctly even if the RevenueCat webhook hasn't yet synced their
-- individual row.

-- ─────────────────────────────────────────────────────────────
-- Helper: resolve the company's effective subscription tier
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.company_subscription_tier(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT admin_p.subscription_tier
      FROM public.profiles user_p
      JOIN public.profiles admin_p
        ON admin_p.company_id = user_p.company_id
        AND admin_p.role = 'admin'
      WHERE user_p.id = p_user_id
      LIMIT 1
    ),
    (SELECT subscription_tier FROM public.profiles WHERE id = p_user_id),
    'starter'
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- Documents trigger
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_document_subscription_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier         text;
  doc_kind     text;
  monthly_count int;
  period_start timestamptz;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  tier := public.company_subscription_tier(NEW.user_id);

  IF tier = 'pro' THEN
    RETURN NEW;
  END IF;

  -- Resolve document kind: gas forms carry it in payment_info.kind,
  -- invoices/quotes carry it in the `type` column.
  BEGIN
    doc_kind := COALESCE(
      NULLIF((NEW.payment_info::jsonb) ->> 'kind', ''),
      NEW.type
    );
  EXCEPTION WHEN others THEN
    doc_kind := NEW.type;
  END;

  -- Starter is only allowed to create CP12 gas safety certs.
  IF doc_kind IS DISTINCT FROM 'cp12' THEN
    RAISE EXCEPTION 'A Pro subscription is required to create documents of type "%"', doc_kind
      USING ERRCODE = '42501', -- insufficient_privilege
            HINT    = 'Upgrade to Pro in Settings > Subscription.';
  END IF;

  -- Starter: enforce 10 CP12 per calendar month (company-wide).
  period_start := date_trunc('month', now());

  SELECT COUNT(*) INTO monthly_count
  FROM public.documents d
  WHERE d.user_id IN (
          SELECT id FROM public.profiles
          WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = NEW.user_id)
        )
    AND d.created_at >= period_start
    AND (
      COALESCE(NULLIF((d.payment_info::jsonb) ->> 'kind', ''), d.type) = 'cp12'
    );

  IF monthly_count >= 10 THEN
    RAISE EXCEPTION 'Starter plan limit reached: 10 CP12 documents per month. Upgrade to Pro for unlimited.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_document_subscription_limits_trg ON public.documents;
CREATE TRIGGER enforce_document_subscription_limits_trg
  BEFORE INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_document_subscription_limits();

-- ─────────────────────────────────────────────────────────────
-- Customers trigger: 10-customer cap on Starter
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_customer_subscription_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier          text;
  customer_count int;
  owner_id      uuid;
BEGIN
  -- customers table may have user_id or company_id; resolve owner
  owner_id := COALESCE(NEW.user_id, (
    SELECT id FROM public.profiles
    WHERE company_id = NEW.company_id AND role = 'admin'
    LIMIT 1
  ));

  IF owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  tier := public.company_subscription_tier(owner_id);

  IF tier = 'pro' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO customer_count
  FROM public.customers
  WHERE company_id = NEW.company_id;

  IF customer_count >= 10 THEN
    RAISE EXCEPTION 'Starter plan limit reached: 10 customers. Upgrade to Pro for unlimited.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_customer_subscription_limits_trg ON public.customers;
CREATE TRIGGER enforce_customer_subscription_limits_trg
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customer_subscription_limits();
