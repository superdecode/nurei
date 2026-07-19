-- ============================================
-- FIX: privilege escalation via unrestricted self-UPDATE policies
-- ============================================
-- 002_rls.sql, 015_affiliate_rls.sql and 006_customers.sql each grant users
-- `for update using (id = auth.uid())` (or `user_id = auth.uid()`) without a
-- column-scoped `with check`. Postgres RLS with-check clauses cannot compare
-- NEW vs OLD column-by-column on their own, so this is enforced with a
-- BEFORE UPDATE trigger per table instead: any UPDATE issued by a non
-- service_role session (i.e. through PostgREST with the anon key + a user
-- JWT, bypassing the app entirely) has its sensitive columns silently reset
-- to their previous value. Server-side app code always writes through
-- createServiceClient() (service_role), so legitimate admin/API writes are
-- untouched.

-- ─── user_profiles: freeze role + admin_role_id ──────────────
create or replace function public.protect_user_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  new.role := old.role;
  new.admin_role_id := old.admin_role_id;
  new.is_active := old.is_active;
  return new;
end;
$$;

drop trigger if exists protect_user_profile_columns on public.user_profiles;
create trigger protect_user_profile_columns
  before update on public.user_profiles
  for each row execute function public.protect_user_profile_columns();

-- ─── affiliate_profiles: freeze commission/payout/identity fields ──────────
create or replace function public.protect_affiliate_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  new.handle := old.handle;
  new.commission_coupon_pct := old.commission_coupon_pct;
  new.commission_cookie_pct := old.commission_cookie_pct;
  new.total_earned_cents := old.total_earned_cents;
  new.pending_payout_cents := old.pending_payout_cents;
  new.clawback_debt_cents := old.clawback_debt_cents;
  new.is_active := old.is_active;
  return new;
end;
$$;

drop trigger if exists protect_affiliate_profile_columns on public.affiliate_profiles;
create trigger protect_affiliate_profile_columns
  before update on public.affiliate_profiles
  for each row execute function public.protect_affiliate_profile_columns();

-- ─── customers: freeze balance/segmentation/admin-state fields ────────────
create or replace function public.protect_customer_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  new.user_id := old.user_id;
  new.segment := old.segment;
  new.tags := old.tags;
  new.loyalty_points := old.loyalty_points;
  new.store_credit_cents := old.store_credit_cents;
  new.is_active := old.is_active;
  new.is_verified := old.is_verified;
  new.risk_level := old.risk_level;
  new.internal_notes := old.internal_notes;
  new.customer_type := old.customer_type;
  new.source := old.source;
  new.referral_code := old.referral_code;
  new.referred_by := old.referred_by;
  new.orders_count := old.orders_count;
  new.completed_orders_count := old.completed_orders_count;
  new.cancelled_orders_count := old.cancelled_orders_count;
  new.total_spent_cents := old.total_spent_cents;
  new.avg_order_value_cents := old.avg_order_value_cents;
  new.last_order_at := old.last_order_at;
  new.first_order_at := old.first_order_at;
  return new;
end;
$$;

drop trigger if exists protect_customer_columns on public.customers;
create trigger protect_customer_columns
  before update on public.customers
  for each row execute function public.protect_customer_columns();
