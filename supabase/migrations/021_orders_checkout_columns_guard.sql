-- Ensure orders columns required by checkout / admin (idempotent — fixes DBs missing prior migrations).

alter table public.orders
  add column if not exists payment_method text;

alter table public.orders
  add column if not exists coupon_snapshot jsonb;
