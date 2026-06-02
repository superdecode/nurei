alter table public.orders
  add column if not exists public_access_token text;

update public.orders
set public_access_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where public_access_token is null;

alter table public.orders
  alter column public_access_token set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

create unique index if not exists idx_orders_public_access_token
  on public.orders(public_access_token);

alter table public.orders
  alter column public_access_token set not null;
