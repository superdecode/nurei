-- ============================================
-- 012: AFFILIATE ROLE + COUPONS FK
-- ============================================

-- 1) Extend role CHECK to include affiliate
alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('customer', 'admin', 'affiliate'));

-- 2) Add affiliate FK to coupons
alter table public.coupons
  add column if not exists affiliate_id uuid references auth.users(id) on delete set null;

create index if not exists idx_coupons_affiliate on public.coupons(affiliate_id)
  where affiliate_id is not null;
