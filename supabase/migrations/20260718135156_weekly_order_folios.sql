-- Folios compactos por semana. El contador comienza en 1001 para que la
-- primera semana sea 11001, la siguiente 21001, etc. Nunca se reinicia dentro
-- de la misma semana: después de 11999 continúa como 12000, 12001…
create table if not exists public.order_weekly_folios (
  week_start date primary key,
  week_number integer not null unique check (week_number > 0),
  last_sequence integer not null default 1000 check (last_sequence >= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  -- Serializa únicamente la reserva del folio; protege el cambio de semana y
  -- las compras simultáneas sin depender de reintentos de la aplicación.
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

  return v_week_number::text || v_sequence::text;
end;
$$;

revoke all on function public.reserve_weekly_order_short_id() from public, anon, authenticated;
grant execute on function public.reserve_weekly_order_short_id() to service_role;
