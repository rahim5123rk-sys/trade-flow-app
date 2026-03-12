-- Notes table for quick engineer notes
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.notes enable row level security;

create policy "Users can manage their own notes"
  on public.notes for all
  using (
    company_id in (select company_id from public.profiles where id = auth.uid())
    and user_id = auth.uid()
  )
  with check (
    company_id in (select company_id from public.profiles where id = auth.uid())
    and user_id = auth.uid()
  );

-- Index for fast lookups
create index idx_notes_user on public.notes(user_id, company_id, is_archived);
