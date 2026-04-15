-- ============================================
-- 003: ADDRESSES + USER_COUPONS
-- ============================================

-- ─── ADDRESSES ──────────────────────────────
create table if not exists public.addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text not null default 'Casa',
  recipient_name text not null,
  street       text not null,
  exterior_number text not null,
  interior_number text,
  colonia      text not null,
  city         text not null default 'Ciudad de México',
  state        text not null default 'CDMX',
  zip_code     text not null,
  phone        text not null,
  instructions text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index idx_addresses_user on public.addresses(user_id);

-- Ensure only one default per user via trigger
create or replace function public.ensure_single_default_address()
returns trigger as $$
begin
  if new.is_default = true then
    update public.addresses
    set is_default = false
    where user_id = new.user_id and id <> new.id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger enforce_single_default_address
  after insert or update of is_default on public.addresses
  for each row when (new.is_default = true)
  execute function public.ensure_single_default_address();

-- ─── USER COUPONS ────────────────────────────
create table if not exists public.user_coupons (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  coupon_id   uuid not null references public.coupons(id) on delete cascade,
  received_at timestamptz not null default now(),
  used_at     timestamptz,
  order_id    uuid references public.orders(id) on delete set null,
  unique(user_id, coupon_id)
);

create index idx_user_coupons_user on public.user_coupons(user_id);

-- ─── RLS ─────────────────────────────────────
alter table public.addresses enable row level security;
alter table public.user_coupons enable row level security;

-- Addresses: users manage their own
create policy "Addresses: users read own"
  on public.addresses for select using (user_id = auth.uid());

create policy "Addresses: users insert own"
  on public.addresses for insert with check (user_id = auth.uid());

create policy "Addresses: users update own"
  on public.addresses for update using (user_id = auth.uid());

create policy "Addresses: users delete own"
  on public.addresses for delete using (user_id = auth.uid());

create policy "Addresses: admin read all"
  on public.addresses for select using (public.is_admin());

-- User coupons: users read own, system manages
create policy "User coupons: users read own"
  on public.user_coupons for select using (user_id = auth.uid());

create policy "User coupons: system insert"
  on public.user_coupons for insert with check (true);

create policy "User coupons: users update own"
  on public.user_coupons for update using (user_id = auth.uid());

create policy "User coupons: admin read all"
  on public.user_coupons for select using (public.is_admin());
