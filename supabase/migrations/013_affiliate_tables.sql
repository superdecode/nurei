-- ============================================
-- 013: AFFILIATE TABLES
-- ============================================

-- ─── AFFILIATE PROFILES ──────────────────────
create table if not exists public.affiliate_profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  handle                   text not null unique,
  bio                      text,
  commission_coupon_pct    int  not null default 10 check (commission_coupon_pct between 0 and 100),
  commission_cookie_pct    int  not null default 5  check (commission_cookie_pct between 0 and 100),
  total_earned_cents       int  not null default 0,
  pending_payout_cents     int  not null default 0,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger set_affiliate_profiles_updated_at
  before update on public.affiliate_profiles
  for each row execute function public.set_updated_at();

-- ─── REFERRAL LINKS ──────────────────────────
create table if not exists public.referral_links (
  id             uuid primary key default gen_random_uuid(),
  affiliate_id   uuid not null references auth.users(id) on delete cascade,
  slug           text not null unique,
  clicks_count   int  not null default 0,
  created_at     timestamptz not null default now(),
  unique (affiliate_id)
);

create index if not exists idx_referral_links_slug on public.referral_links(slug);
create index if not exists idx_referral_links_affiliate on public.referral_links(affiliate_id);

-- ─── REFERRAL CLICKS ─────────────────────────
create table if not exists public.referral_clicks (
  id                uuid primary key default gen_random_uuid(),
  referral_link_id  uuid not null references public.referral_links(id) on delete cascade,
  session_id        text not null,
  ip_hash           text,
  converted         boolean not null default false,
  order_id          uuid references public.orders(id) on delete set null,
  clicked_at        timestamptz not null default now()
);

create index if not exists idx_referral_clicks_link on public.referral_clicks(referral_link_id);
create index if not exists idx_referral_clicks_session on public.referral_clicks(session_id);

-- Dedup: same session cannot count twice
create unique index if not exists idx_referral_clicks_dedup
  on public.referral_clicks (referral_link_id, session_id)
  where converted = false;

-- ─── AFFILIATE ATTRIBUTIONS ──────────────────
create table if not exists public.affiliate_attributions (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null unique references public.orders(id) on delete cascade,
  affiliate_id            uuid not null references auth.users(id) on delete cascade,
  attribution_type        text not null check (attribution_type in ('coupon', 'cookie')),
  coupon_id               uuid references public.coupons(id) on delete set null,
  commission_pct          int  not null,
  commission_amount_cents int  not null,
  payout_status           text not null default 'pending' check (payout_status in ('pending', 'paid')),
  paid_at                 timestamptz,
  created_at              timestamptz not null default now()
);

create index if not exists idx_attributions_affiliate on public.affiliate_attributions(affiliate_id);
create index if not exists idx_attributions_order on public.affiliate_attributions(order_id);

-- ─── COMMISSION PAYMENTS ─────────────────────
create table if not exists public.commission_payments (
  id               uuid primary key default gen_random_uuid(),
  affiliate_id     uuid not null references auth.users(id) on delete cascade,
  amount_cents     int  not null check (amount_cents > 0),
  period_from      date not null,
  period_to        date not null,
  attribution_ids  uuid[] not null default '{}',
  notes            text,
  paid_by          uuid references auth.users(id) on delete set null,
  paid_at          timestamptz not null default now()
);

create index if not exists idx_commission_payments_affiliate on public.commission_payments(affiliate_id);

-- ─── HELPERS ──────────────────────────────────
create or replace function public.increment_referral_clicks(link_id uuid)
returns void as $$
  update public.referral_links set clicks_count = clicks_count + 1 where id = link_id;
$$ language sql security definer;

create or replace function public.increment_affiliate_pending(affiliate_id uuid, amount int)
returns void as $$
  update public.affiliate_profiles
  set pending_payout_cents = pending_payout_cents + amount,
      updated_at = now()
  where id = affiliate_id;
$$ language sql security definer;
