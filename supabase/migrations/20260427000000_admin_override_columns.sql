-- 20260427000000_admin_override_columns.sql
--
-- Adds admin override columns to `profiles`. An override lets an internal
-- admin grant Pro entitlement to a user manually (e.g. for support comps),
-- bypassing the RevenueCat / Stripe webhook state. Active overrides protect
-- a row from being downgraded by automated webhook traffic.

alter table public.profiles
  add column if not exists admin_override            boolean      not null default false,
  add column if not exists admin_override_expires_at timestamptz  null,
  add column if not exists admin_override_reason     text         null,
  add column if not exists admin_override_granted_by uuid         null references auth.users(id),
  add column if not exists admin_override_granted_at timestamptz  null;

create index if not exists profiles_admin_override_idx
  on public.profiles (admin_override)
  where admin_override = true;

-- Column-level write protection: existing UPDATE policies on profiles cannot
-- restrict writes per column. Revoke direct UPDATE on these columns from the
-- authenticated and anon roles. The service_role used by Edge Functions
-- retains write access via its bypass-RLS privilege.
revoke update (
  admin_override,
  admin_override_expires_at,
  admin_override_reason,
  admin_override_granted_by,
  admin_override_granted_at
) on public.profiles from authenticated, anon;
