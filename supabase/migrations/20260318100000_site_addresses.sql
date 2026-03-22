-- ============================================
-- Site Addresses table
-- Stores property addresses + optional tenant details
-- for reuse across gas forms
-- ============================================

CREATE TABLE public.site_addresses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  address_line_1 text NOT NULL,
  address_line_2 text,
  city           text,
  post_code      text NOT NULL,
  tenant_name    text,
  tenant_email   text,
  tenant_phone   text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, address_line_1, post_code)
);

-- Enable RLS
ALTER TABLE public.site_addresses ENABLE ROW LEVEL SECURITY;

-- Company members can read their own company's site addresses
CREATE POLICY "Company members can view site addresses"
  ON public.site_addresses
  FOR SELECT
  USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Company members can insert site addresses for their company
CREATE POLICY "Company members can insert site addresses"
  ON public.site_addresses
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Company members can update their own company's site addresses
CREATE POLICY "Company members can update site addresses"
  ON public.site_addresses
  FOR UPDATE
  USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.handle_site_address_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_site_address_updated_at
  BEFORE UPDATE ON public.site_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_site_address_updated_at();
