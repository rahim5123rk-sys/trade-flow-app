-- Allow users to view teammate profiles in the same company.
-- Root cause this addresses:
-- If profiles SELECT policy only allows "id = auth.uid()", admins cannot list workers.

-- Helper function to safely fetch the current user's company without recursive RLS checks.
create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.company_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_user_company_id() from public;
grant execute on function public.current_user_company_id() to authenticated;

-- Replace policy if it exists
drop policy if exists "Users can view profiles in own company" on public.profiles;
drop policy if exists "Users can view teammates in own company" on public.profiles;

create policy "Users can view teammates in own company"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or (
    company_id is not null
    and company_id = public.current_user_company_id()
  )
);
