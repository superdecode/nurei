-- 017: Affiliate enhancements — payment info, coupon code tracking on attributions, unique clicks

alter table public.affiliate_profiles
  add column if not exists payment_method   text,
  add column if not exists bank_name        text,
  add column if not exists bank_clabe       text,
  add column if not exists bank_account     text,
  add column if not exists bank_holder      text,
  add column if not exists payment_notes    text;

alter table public.affiliate_attributions
  add column if not exists coupon_code text;

-- backfill coupon codes for existing rows
update public.affiliate_attributions aa
set coupon_code = c.code
from public.coupons c
where aa.coupon_id = c.id
  and aa.coupon_code is null;

-- unique clicks (per link) derived view helper — not a table
-- (clicks_count on referral_links already tracks totals; referral_clicks tracks per-session)

-- index for fast affiliate coupon lookups
create index if not exists idx_coupons_affiliate_id on public.coupons(affiliate_id)
  where affiliate_id is not null;

-- index for fast attribution lookups with date range
create index if not exists idx_attributions_affiliate_created
  on public.affiliate_attributions(affiliate_id, created_at desc);
