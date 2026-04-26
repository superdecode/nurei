alter table public.orders
  add column if not exists shipping_method text;
