create table if not exists public.global_counters (
  key text primary key,
  value bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.global_counters (key, value)
values ('gas_cert_ref', 0)
on conflict (key) do nothing;

create or replace function public.get_next_gas_cert_reference(reserve boolean default true)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value bigint;
begin
  if reserve then
    insert into public.global_counters (key, value, updated_at)
    values ('gas_cert_ref', 1, now())
    on conflict (key) do update
      set value = public.global_counters.value + 1,
          updated_at = now()
    returning value into next_value;
  else
    insert into public.global_counters (key, value)
    values ('gas_cert_ref', 0)
    on conflict (key) do nothing;

    select value + 1
    into next_value
    from public.global_counters
    where key = 'gas_cert_ref';
  end if;

  return 'REF-' || lpad(next_value::text, 4, '0');
end;
$$;

grant execute on function public.get_next_gas_cert_reference(boolean) to authenticated;