-- Ensure coupon_snapshot exists on orders (idempotent — fixes DBs missing migration 014).

alter table public.orders
  add column if not exists coupon_snapshot jsonb;
