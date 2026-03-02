-- Add Gas Safe consent audit columns to profiles table

alter table public.profiles
  add column if not exists accepted_gas_safe_terms boolean not null default false;

alter table public.profiles
  add column if not exists gas_safe_terms_accepted_at timestamptz;

comment on column public.profiles.accepted_gas_safe_terms
  is 'Whether the user accepted the Gas Safe Register Terms of Service and trademark liability disclaimer.';

comment on column public.profiles.gas_safe_terms_accepted_at
  is 'Timestamp when the user accepted the Gas Safe terms. Serves as legal proof of consent.';
