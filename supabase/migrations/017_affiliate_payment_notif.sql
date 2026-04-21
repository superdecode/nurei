-- ============================================
-- 017: AFFILIATE PAYMENT INFO + NOTIFICATIONS
-- ============================================

-- Payment information fields
alter table public.affiliate_profiles
  add column if not exists payment_method    text,
  add column if not exists bank_name         text,
  add column if not exists bank_clabe        text,
  add column if not exists bank_account      text,
  add column if not exists bank_holder       text,
  add column if not exists payment_notes     text;

-- Notification preferences
alter table public.affiliate_profiles
  add column if not exists notify_on_sale          boolean not null default false,
  add column if not exists notify_on_payment       boolean not null default false,
  add column if not exists notify_weekly_summary   boolean not null default false;

-- coupon_code denormalized on attributions (populated on insert for fast display)
alter table public.affiliate_attributions
  add column if not exists coupon_code text;
