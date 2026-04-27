-- 20260427000001_apply_company_subscription_tier_rpc.sql
--
-- Atomic company-wide subscription tier application that respects active
-- admin overrides. Replaces the per-row read-then-write loop the
-- revenuecat-webhook used to do for company fan-out.

create or replace function public.apply_company_subscription_tier(
  p_admin_id    uuid,
  p_company_id  uuid,
  p_tier        text,
  p_sub_type    text,
  p_expires_at  timestamptz
) returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set subscription_tier        = p_tier,
         subscription_type        = p_sub_type,
         subscription_expires_at  = p_expires_at
   where company_id = p_company_id
     and id <> p_admin_id
     and (
       admin_override = false
       or (admin_override_expires_at is not null
           and admin_override_expires_at <= now())
     );
$$;

revoke all on function public.apply_company_subscription_tier(uuid, uuid, text, text, timestamptz) from public;
grant execute on function public.apply_company_subscription_tier(uuid, uuid, text, text, timestamptz) to service_role;
