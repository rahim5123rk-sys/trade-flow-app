-- supabase/migrations/20260316400000_company_reminder_days.sql
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS reminder_days_before integer NOT NULL DEFAULT 30;
