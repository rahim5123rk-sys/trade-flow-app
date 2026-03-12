-- Job parts / shopping list per job
create table if not exists public.job_parts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  quantity int not null default 1,
  status text not null default 'needed' check (status in ('needed', 'ordered', 'collected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.job_parts enable row level security;

create policy "Users can manage parts for their company jobs"
  on public.job_parts for all
  using (
    company_id in (select company_id from public.profiles where id = auth.uid())
  )
  with check (
    company_id in (select company_id from public.profiles where id = auth.uid())
  );

-- Index for fast lookups
create index idx_job_parts_job on public.job_parts(job_id);
