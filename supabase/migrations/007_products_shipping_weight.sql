-- Optional shipping weight to estimate shipping calculations
alter table if exists public.products
  add column if not exists shipping_weight_g integer;

