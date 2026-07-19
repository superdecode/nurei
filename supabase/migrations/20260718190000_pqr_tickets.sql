-- ============================================
-- PQR (Peticiones, Quejas, Reclamos, Sugerencias) system
-- ============================================
-- Follows the same shape as 046_crm_module.sql: gen_random_uuid() PK,
-- handle_updated_at() trigger, enums via check(), RLS via is_admin(), and a
-- permission-seed backfill mirroring 20260718181000_seed_afiliados_permission.sql
-- so the new 'pqr' AdminModule key isn't silently 'sin_acceso' for existing roles.

create table if not exists public.pqr_tickets (
  id            uuid primary key default gen_random_uuid(),
  ticket_number text unique,
  tipo          text not null default 'peticion'
                check (tipo in ('peticion', 'queja', 'reclamo', 'sugerencia')),
  estado        text not null default 'abierto'
                check (estado in ('abierto', 'en_proceso', 'resuelto', 'cerrado')),
  prioridad     text not null default 'media'
                check (prioridad in ('baja', 'media', 'alta', 'urgente')),
  asunto        text not null,
  mensaje       text not null,

  -- Requester identity: logged-in customer OR guest by email
  user_id       uuid references auth.users(id) on delete set null,
  customer_id   uuid references public.customers(id) on delete set null,
  cliente_email text not null,
  cliente_nombre text,

  -- Optional link to an existing order
  order_id      uuid references public.orders(id) on delete set null,

  -- Admin handling
  assigned_to   uuid references auth.users(id) on delete set null,
  respuesta     text,
  resuelto_at   timestamptz,

  -- SLA / reporting
  sla_due_at        timestamptz,
  first_response_at timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_pqr_estado    on public.pqr_tickets(estado);
create index if not exists idx_pqr_prioridad on public.pqr_tickets(prioridad);
create index if not exists idx_pqr_user      on public.pqr_tickets(user_id);
create index if not exists idx_pqr_order     on public.pqr_tickets(order_id);
create index if not exists idx_pqr_created   on public.pqr_tickets(created_at desc);
create index if not exists idx_pqr_sla       on public.pqr_tickets(sla_due_at)
  where estado in ('abierto', 'en_proceso');

drop trigger if exists set_pqr_updated_at on public.pqr_tickets;
create trigger set_pqr_updated_at before update on public.pqr_tickets
  for each row execute function public.handle_updated_at();

-- ─── Ticket folio: PQR-000001, PQR-000002, ... ──────────────────────────────
create sequence if not exists public.pqr_ticket_number_seq;

create or replace function public.set_pqr_ticket_number()
returns trigger
language plpgsql
as $$
begin
  if new.ticket_number is null then
    new.ticket_number := 'PQR-' || lpad(nextval('public.pqr_ticket_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists set_pqr_ticket_number_trigger on public.pqr_tickets;
create trigger set_pqr_ticket_number_trigger before insert on public.pqr_tickets
  for each row execute function public.set_pqr_ticket_number();

-- ─── SLA due date by priority, set once on insert ───────────────────────────
create or replace function public.set_pqr_sla_due_at()
returns trigger
language plpgsql
as $$
begin
  if new.sla_due_at is null then
    new.sla_due_at := new.created_at + case new.prioridad
      when 'urgente' then interval '4 hours'
      when 'alta'    then interval '24 hours'
      when 'media'   then interval '72 hours'
      else                interval '5 days'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists set_pqr_sla_due_at_trigger on public.pqr_tickets;
create trigger set_pqr_sla_due_at_trigger before insert on public.pqr_tickets
  for each row execute function public.set_pqr_sla_due_at();

-- ─── Sync resuelto_at / first_response_at on update ─────────────────────────
create or replace function public.sync_pqr_ticket_state()
returns trigger
language plpgsql
as $$
begin
  if new.estado in ('resuelto', 'cerrado') and old.estado not in ('resuelto', 'cerrado') then
    new.resuelto_at := coalesce(new.resuelto_at, now());
  elsif new.estado not in ('resuelto', 'cerrado') and old.estado in ('resuelto', 'cerrado') then
    new.resuelto_at := null;
  end if;

  if new.respuesta is not null and old.respuesta is null then
    new.first_response_at := coalesce(new.first_response_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists sync_pqr_ticket_state_trigger on public.pqr_tickets;
create trigger sync_pqr_ticket_state_trigger before update on public.pqr_tickets
  for each row execute function public.sync_pqr_ticket_state();

-- ─── RLS ─────────────────────────────────────────────────────────────────
alter table public.pqr_tickets enable row level security;

create policy "PQR: users read own" on public.pqr_tickets
  for select using (user_id = auth.uid());

create policy "PQR: users create own" on public.pqr_tickets
  for insert with check (user_id = auth.uid() or user_id is null);

create policy "PQR: admin all" on public.pqr_tickets
  for all using (public.is_admin()) with check (public.is_admin());

-- Guests (no user_id) can't be granted row access by RLS alone — they're
-- created and read via the service-role client through app/api/pqr/*
-- routes, the same pattern orders already uses for guest checkout.

-- ─── Seed 'pqr' admin permission (mirrors 20260718181000) ───────────────────
update public.admin_roles
set permissions = permissions || '{"pqr": "total"}'::jsonb
where lower(replace(name, ' ', '_')) = 'super_admin'
  and not (permissions ? 'pqr');

update public.admin_roles
set permissions = permissions || '{"pqr": "escritura"}'::jsonb
where lower(replace(name, ' ', '_')) = 'admin'
  and not (permissions ? 'pqr');

update public.admin_roles
set permissions = permissions || '{"pqr": "lectura"}'::jsonb
where lower(replace(name, ' ', '_')) in ('operador', 'consulta')
  and not (permissions ? 'pqr');

update public.admin_roles
set permissions = permissions || '{"pqr": "sin_acceso"}'::jsonb
where not (permissions ? 'pqr');
