-- ============================================
-- Per-company document reference counters
-- Each company gets its own REF, INV, QTE sequences
-- ============================================

-- Replace the global gas cert reference function with a per-company version
create or replace function public.get_next_gas_cert_reference(
  reserve boolean default true,
  p_company_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value bigint;
  counter_key text;
begin
  -- Build a per-company key; fall back to global if no company_id provided
  if p_company_id is not null then
    counter_key := 'gas_cert_ref:' || p_company_id::text;
  else
    counter_key := 'gas_cert_ref';
  end if;

  if reserve then
    insert into public.global_counters (key, value, updated_at)
    values (counter_key, 1, now())
    on conflict (key) do update
      set value = public.global_counters.value + 1,
          updated_at = now()
    returning value into next_value;
  else
    insert into public.global_counters (key, value)
    values (counter_key, 0)
    on conflict (key) do nothing;

    select value + 1
    into next_value
    from public.global_counters
    where key = counter_key;
  end if;

  return 'REF-' || lpad(next_value::text, 4, '0');
end;
$$;

-- New function for invoice references (per-company)
create or replace function public.get_next_invoice_reference(
  reserve boolean default true,
  p_company_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value bigint;
  counter_key text;
begin
  counter_key := 'invoice_ref:' || coalesce(p_company_id::text, 'global');

  if reserve then
    insert into public.global_counters (key, value, updated_at)
    values (counter_key, 1, now())
    on conflict (key) do update
      set value = public.global_counters.value + 1,
          updated_at = now()
    returning value into next_value;
  else
    insert into public.global_counters (key, value)
    values (counter_key, 0)
    on conflict (key) do nothing;

    select value + 1
    into next_value
    from public.global_counters
    where key = counter_key;
  end if;

  return 'INV-' || lpad(next_value::text, 4, '0');
end;
$$;

-- New function for quote references (per-company)
create or replace function public.get_next_quote_reference(
  reserve boolean default true,
  p_company_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value bigint;
  counter_key text;
begin
  counter_key := 'quote_ref:' || coalesce(p_company_id::text, 'global');

  if reserve then
    insert into public.global_counters (key, value, updated_at)
    values (counter_key, 1, now())
    on conflict (key) do update
      set value = public.global_counters.value + 1,
          updated_at = now()
    returning value into next_value;
  else
    insert into public.global_counters (key, value)
    values (counter_key, 0)
    on conflict (key) do nothing;

    select value + 1
    into next_value
    from public.global_counters
    where key = counter_key;
  end if;

  return 'QTE-' || lpad(next_value::text, 4, '0');
end;
$$;

grant execute on function public.get_next_gas_cert_reference(boolean, uuid) to authenticated;
grant execute on function public.get_next_invoice_reference(boolean, uuid) to authenticated;
grant execute on function public.get_next_quote_reference(boolean, uuid) to authenticated;
