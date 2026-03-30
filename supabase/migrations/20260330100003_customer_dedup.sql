-- Add a unique constraint for customer deduplication within a company.
-- First, clean up any existing duplicates by keeping the oldest row per group.

-- Step 1: Remove duplicate customers (same company, same lower name + email)
-- Keep only the first row per group (by ctid, the physical row identifier)
DELETE FROM public.customers c
WHERE c.ctid NOT IN (
  SELECT DISTINCT ON (company_id, lower(name), lower(email)) ctid
  FROM public.customers
  WHERE email IS NOT NULL
  ORDER BY company_id, lower(name), lower(email), created_at ASC
)
AND c.email IS NOT NULL
AND EXISTS (
  SELECT 1 FROM public.customers c2
  WHERE c2.company_id = c.company_id
    AND lower(c2.name) = lower(c.name)
    AND lower(c2.email) = lower(c.email)
    AND c2.ctid != c.ctid
);

-- Step 2: Remove duplicate customers without email (same company, name, address)
DELETE FROM public.customers c
WHERE c.ctid NOT IN (
  SELECT DISTINCT ON (company_id, lower(name), lower(address_line_1)) ctid
  FROM public.customers
  WHERE email IS NULL AND address_line_1 IS NOT NULL
  ORDER BY company_id, lower(name), lower(address_line_1), created_at ASC
)
AND c.email IS NULL
AND c.address_line_1 IS NOT NULL
AND EXISTS (
  SELECT 1 FROM public.customers c2
  WHERE c2.company_id = c.company_id
    AND lower(c2.name) = lower(c.name)
    AND lower(c2.address_line_1) = lower(c.address_line_1)
    AND c2.email IS NULL
    AND c2.ctid != c.ctid
);

-- Step 3: Create unique indexes to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_dedup
  ON public.customers (company_id, lower(name), lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_dedup_no_email
  ON public.customers (company_id, lower(name), lower(address_line_1))
  WHERE email IS NULL AND address_line_1 IS NOT NULL;
