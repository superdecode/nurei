-- ============================================
-- 006: CUSTOMERS MODULE
-- Complete CRM for end-customers: profile, addresses,
-- notes, tags, segmentation, marketing consents, stats view
-- ============================================

-- ─── CUSTOMERS TABLE ─────────────────────────
create table if not exists public.customers (
  id                    uuid primary key default gen_random_uuid(),

  -- Link to auth user (optional: some customers may be created manually by admin for phone orders)
  user_id               uuid unique references auth.users(id) on delete set null,

  -- Core identity
  first_name            text,
  last_name             text,
  full_name             text generated always as (
    nullif(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), '')
  ) stored,
  email                 text,
  phone                 text,
  whatsapp              text,
  avatar_url            text,

  -- Company / B2B
  customer_type         text not null default 'individual'
                         check (customer_type in ('individual', 'business')),
  company_name          text,
  tax_id                text, -- RFC MX
  tax_regime            text,
  billing_email         text,

  -- Personal
  birthday              date,
  gender                text check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  preferred_language    text not null default 'es',

  -- Acquisition / source
  source                text not null default 'web'
                         check (source in ('web', 'admin', 'import', 'whatsapp', 'referral', 'social', 'pos', 'marketplace', 'other')),
  referral_code         text,
  referred_by           uuid references public.customers(id) on delete set null,
  utm_source            text,
  utm_medium            text,
  utm_campaign          text,

  -- Segmentation
  segment               text not null default 'new'
                         check (segment in ('new', 'regular', 'vip', 'at_risk', 'lost', 'blacklist')),
  tags                  text[] not null default '{}',

  -- Marketing consents (GDPR / LFPDPPP compliance)
  accepts_marketing         boolean not null default false,
  accepts_email_marketing   boolean not null default false,
  accepts_sms_marketing     boolean not null default false,
  accepts_whatsapp_marketing boolean not null default false,
  consent_updated_at        timestamptz,

  -- Loyalty / balance
  loyalty_points            integer not null default 0 check (loyalty_points >= 0),
  store_credit_cents        integer not null default 0 check (store_credit_cents >= 0),

  -- Admin-level state
  is_active                 boolean not null default true,
  is_verified               boolean not null default false,
  risk_level                text not null default 'normal'
                             check (risk_level in ('normal', 'low', 'medium', 'high')),
  internal_notes            text,

  -- Denormalized stats (kept fresh via triggers below)
  orders_count              integer not null default 0,
  completed_orders_count    integer not null default 0,
  cancelled_orders_count    integer not null default 0,
  total_spent_cents         integer not null default 0,
  avg_order_value_cents     integer not null default 0,
  last_order_at             timestamptz,
  first_order_at            timestamptz,

  -- Timestamps
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Uniqueness: phone or email must be unique when present
  constraint customers_email_unique unique (email),
  constraint customers_phone_unique unique (phone)
);

create index if not exists idx_customers_user on public.customers(user_id);
create index if not exists idx_customers_email on public.customers(lower(email));
create index if not exists idx_customers_phone on public.customers(phone);
create index if not exists idx_customers_segment on public.customers(segment);
create index if not exists idx_customers_type on public.customers(customer_type);
create index if not exists idx_customers_active on public.customers(is_active) where is_active = true;
create index if not exists idx_customers_tags on public.customers using gin(tags);
create index if not exists idx_customers_created on public.customers(created_at desc);
create index if not exists idx_customers_last_order on public.customers(last_order_at desc nulls last);
create index if not exists idx_customers_total_spent on public.customers(total_spent_cents desc);

-- ─── CUSTOMER ADDRESSES ──────────────────────
create table if not exists public.customer_addresses (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.customers(id) on delete cascade,
  label                 text not null default 'Casa',
  recipient_name        text not null,
  phone                 text,
  street                text not null,
  exterior_number       text,
  interior_number       text,
  colonia               text,
  city                  text not null,
  state                 text not null,
  country               text not null default 'México',
  zip_code              text not null,
  instructions          text,
  latitude              numeric(10, 7),
  longitude             numeric(10, 7),
  is_default_shipping   boolean not null default false,
  is_default_billing    boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_customer_addresses_customer on public.customer_addresses(customer_id);
create unique index if not exists idx_customer_addresses_default_shipping
  on public.customer_addresses(customer_id) where is_default_shipping = true;
create unique index if not exists idx_customer_addresses_default_billing
  on public.customer_addresses(customer_id) where is_default_billing = true;

-- ─── CUSTOMER NOTES (internal CRM timeline) ──
create table if not exists public.customer_notes (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.customers(id) on delete cascade,
  author_id             uuid references auth.users(id) on delete set null,
  note                  text not null,
  kind                  text not null default 'note'
                         check (kind in ('note', 'call', 'email', 'whatsapp', 'visit', 'complaint', 'compliment', 'system')),
  is_pinned             boolean not null default false,
  created_at            timestamptz not null default now()
);

create index if not exists idx_customer_notes_customer on public.customer_notes(customer_id, created_at desc);

-- ─── CUSTOMER CONTACT EVENTS (audit) ─────────
create table if not exists public.customer_events (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.customers(id) on delete cascade,
  event_type            text not null,
  payload               jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists idx_customer_events_customer on public.customer_events(customer_id, created_at desc);
create index if not exists idx_customer_events_type on public.customer_events(event_type);

-- ─── ORDERS: attach customer_id ──────────────
alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists idx_orders_customer on public.orders(customer_id);

-- ─── STATS ROLL-UP TRIGGER ───────────────────
create or replace function public.sync_customer_stats(p_customer_id uuid)
returns void as $$
declare
  v_orders_count integer := 0;
  v_completed integer := 0;
  v_cancelled integer := 0;
  v_total integer := 0;
  v_avg integer := 0;
  v_first timestamptz;
  v_last timestamptz;
begin
  if p_customer_id is null then
    return;
  end if;

  select
    count(*),
    count(*) filter (where status in ('delivered','paid','shipped')),
    count(*) filter (where status in ('cancelled','refunded','failed')),
    coalesce(sum(total) filter (where payment_status = 'paid'), 0),
    min(created_at),
    max(created_at)
  into v_orders_count, v_completed, v_cancelled, v_total, v_first, v_last
  from public.orders
  where customer_id = p_customer_id;

  if v_completed > 0 then
    v_avg := v_total / v_completed;
  end if;

  update public.customers
    set
      orders_count = v_orders_count,
      completed_orders_count = v_completed,
      cancelled_orders_count = v_cancelled,
      total_spent_cents = v_total,
      avg_order_value_cents = v_avg,
      first_order_at = v_first,
      last_order_at = v_last,
      updated_at = now()
    where id = p_customer_id;
end;
$$ language plpgsql security definer;

create or replace function public.handle_order_customer_change()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_customer_stats(old.customer_id);
    return old;
  end if;

  if tg_op = 'INSERT' then
    perform public.sync_customer_stats(new.customer_id);
    return new;
  end if;

  -- UPDATE
  if new.customer_id is distinct from old.customer_id then
    perform public.sync_customer_stats(old.customer_id);
  end if;
  perform public.sync_customer_stats(new.customer_id);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_sync_customer_stats on public.orders;
create trigger trg_orders_sync_customer_stats
  after insert or update of status, payment_status, total, customer_id or delete
  on public.orders
  for each row execute function public.handle_order_customer_change();

-- ─── LINK EXISTING auth.user → customers ─────
create or replace function public.ensure_customer_from_user()
returns trigger as $$
begin
  insert into public.customers (user_id, email, source)
  values (new.id, new.email, 'web')
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auth_user_to_customer on auth.users;
create trigger trg_auth_user_to_customer
  after insert on auth.users
  for each row execute function public.ensure_customer_from_user();

-- ─── UPDATED_AT TRIGGERS ─────────────────────
drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at before update on public.customers
  for each row execute function public.handle_updated_at();

drop trigger if exists set_customer_addresses_updated_at on public.customer_addresses;
create trigger set_customer_addresses_updated_at before update on public.customer_addresses
  for each row execute function public.handle_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────
alter table public.customers           enable row level security;
alter table public.customer_addresses  enable row level security;
alter table public.customer_notes      enable row level security;
alter table public.customer_events     enable row level security;

-- customers
drop policy if exists "Customers: admin all" on public.customers;
create policy "Customers: admin all" on public.customers
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Customers: self read" on public.customers;
create policy "Customers: self read" on public.customers
  for select using (user_id = auth.uid());

drop policy if exists "Customers: self update" on public.customers;
create policy "Customers: self update" on public.customers
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- customer_addresses
drop policy if exists "CustomerAddresses: admin all" on public.customer_addresses;
create policy "CustomerAddresses: admin all" on public.customer_addresses
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "CustomerAddresses: self read" on public.customer_addresses;
create policy "CustomerAddresses: self read" on public.customer_addresses
  for select using (
    exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid())
  );

drop policy if exists "CustomerAddresses: self write" on public.customer_addresses;
create policy "CustomerAddresses: self write" on public.customer_addresses
  for all using (
    exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.customers c where c.id = customer_id and c.user_id = auth.uid())
  );

-- customer_notes (admin only)
drop policy if exists "CustomerNotes: admin all" on public.customer_notes;
create policy "CustomerNotes: admin all" on public.customer_notes
  for all using (public.is_admin()) with check (public.is_admin());

-- customer_events (admin read)
drop policy if exists "CustomerEvents: admin all" on public.customer_events;
create policy "CustomerEvents: admin all" on public.customer_events
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── SEGMENT AUTO-ASSIGN (based on stats) ────
create or replace function public.recompute_customer_segment(p_id uuid)
returns void as $$
declare
  c public.customers%rowtype;
  days_since_last integer;
begin
  select * into c from public.customers where id = p_id;
  if not found then return; end if;
  if c.segment in ('blacklist') then return; end if;

  days_since_last := case
    when c.last_order_at is null then null
    else extract(day from (now() - c.last_order_at))::int
  end;

  if c.completed_orders_count = 0 then
    update public.customers set segment = 'new' where id = p_id and segment <> 'new';
  elsif c.total_spent_cents >= 500000 or c.completed_orders_count >= 10 then
    update public.customers set segment = 'vip' where id = p_id and segment <> 'vip';
  elsif days_since_last is not null and days_since_last > 180 then
    update public.customers set segment = 'lost' where id = p_id and segment <> 'lost';
  elsif days_since_last is not null and days_since_last > 90 then
    update public.customers set segment = 'at_risk' where id = p_id and segment <> 'at_risk';
  else
    update public.customers set segment = 'regular' where id = p_id and segment <> 'regular';
  end if;
end;
$$ language plpgsql security definer;

-- ─── CUSTOMER STATS VIEW ─────────────────────
create or replace view public.customer_stats as
select
  count(*)::int                                                           as total,
  count(*) filter (where is_active)::int                                   as active,
  count(*) filter (where segment = 'vip')::int                             as vip,
  count(*) filter (where segment = 'new')::int                             as new_count,
  count(*) filter (where segment = 'at_risk')::int                         as at_risk,
  count(*) filter (where segment = 'lost')::int                            as lost,
  count(*) filter (where customer_type = 'business')::int                  as business,
  count(*) filter (where accepts_marketing)::int                           as marketable,
  coalesce(sum(total_spent_cents), 0)::bigint                              as gmv_cents,
  coalesce(avg(total_spent_cents) filter (where completed_orders_count > 0), 0)::int as avg_ltv_cents,
  count(*) filter (where created_at > now() - interval '30 days')::int     as new_last_30d
from public.customers;

grant select on public.customer_stats to anon, authenticated;

-- ─── BACKFILL: link existing users to customers ───
insert into public.customers (user_id, email, phone, first_name, source)
select
  u.id,
  u.email,
  up.phone,
  coalesce(split_part(up.full_name, ' ', 1), ''),
  'web'
from auth.users u
left join public.user_profiles up on up.id = u.id
left join public.customers c on c.user_id = u.id
where c.id is null
on conflict do nothing;

-- Backfill last_name from user_profiles
update public.customers c
set last_name = trim(substr(up.full_name, length(split_part(up.full_name, ' ', 1)) + 2))
from public.user_profiles up
where up.id = c.user_id
  and c.last_name is null
  and up.full_name is not null
  and position(' ' in up.full_name) > 0;

-- Backfill orders.customer_id from existing orders (match by user_id, then email, then phone)
update public.orders o
set customer_id = c.id
from public.customers c
where o.customer_id is null
  and (
    (o.user_id is not null and c.user_id = o.user_id)
    or (o.customer_email is not null and lower(c.email) = lower(o.customer_email))
    or (o.customer_phone is not null and c.phone = o.customer_phone)
  );

-- Recompute stats for all customers with orders
do $$
declare
  r record;
begin
  for r in select distinct customer_id from public.orders where customer_id is not null loop
    perform public.sync_customer_stats(r.customer_id);
    perform public.recompute_customer_segment(r.customer_id);
  end loop;
end $$;
