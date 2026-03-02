-- Allow authenticated users to update their own company's settings
-- Root cause: no UPDATE RLS policy existed on companies table,
-- causing app-side company settings updates to be silently blocked.

-- Drop existing UPDATE policy if one was partially created
drop policy if exists "Users can update their own company" on public.companies;

-- Create the correct UPDATE policy:
-- A user can update a company row only if their profile's company_id references that company
create policy "Users can update their own company"
  on public.companies
  for update
  using (
    id = (
      select company_id
      from public.profiles
      where id = auth.uid()
    )
  )
  with check (
    id = (
      select company_id
      from public.profiles
      where id = auth.uid()
    )
  );
