-- Add tenant_title column to site_addresses
ALTER TABLE public.site_addresses ADD COLUMN IF NOT EXISTS tenant_title text;
