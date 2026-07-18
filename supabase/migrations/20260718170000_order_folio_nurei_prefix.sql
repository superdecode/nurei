-- Use one public order-folio format everywhere: NUR-11001.
-- Existing numeric folios are migrated so admin, customer views and emails
-- all show the same identifier without requiring client-side special cases.
update public.orders
set short_id = 'NUR-' || short_id
where short_id is not null
  and short_id !~* '^NUR-';

create or replace function public.reserve_weekly_order_short_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date := date_trunc('week', timezone('America/Mexico_City', now()))::date;
  v_week_number integer;
  v_sequence integer;
begin
  perform pg_advisory_xact_lock(hashtext('nurei:weekly-order-folio'));

  insert into public.order_weekly_folios (week_start, week_number)
  values (
    v_week_start,
    coalesce((select max(week_number) from public.order_weekly_folios), 0) + 1
  )
  on conflict (week_start) do nothing;

  update public.order_weekly_folios
  set last_sequence = last_sequence + 1,
      updated_at = now()
  where week_start = v_week_start
  returning week_number, last_sequence into v_week_number, v_sequence;

  return 'NUR-' || v_week_number::text || v_sequence::text;
end;
$$;

revoke all on function public.reserve_weekly_order_short_id() from public, anon, authenticated;
grant execute on function public.reserve_weekly_order_short_id() to service_role;
