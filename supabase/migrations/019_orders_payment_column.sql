-- Orders: persist payment method chosen at checkout (admin visibility & filters)

alter table public.orders
  add column if not exists payment_method text;
