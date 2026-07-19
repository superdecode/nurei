-- 037_orders_tracking.sql already added tracking_number and carrier.
-- tracking_url is the missing piece for the bulk shipping-guide import flow
-- (Phase 1: manual CSV/Excel upload in app/admin/pedidos).
alter table public.orders add column if not exists tracking_url text;
