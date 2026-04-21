-- Robust coupon engine extension (backward compatible)

alter table public.coupons
  add column if not exists discount_type text check (discount_type in ('percentage', 'fixed', 'conditional')),
  add column if not exists conditional_type text check (conditional_type in ('percentage', 'fixed')),
  add column if not exists conditional_threshold integer,
  add column if not exists scope_type text not null default 'global' check (scope_type in ('global', 'categories', 'products')),
  add column if not exists scope_category_slugs text[] not null default '{}',
  add column if not exists scope_product_ids uuid[] not null default '{}',
  add column if not exists customer_tags text[] not null default '{}',
  add column if not exists starts_at timestamptz,
  add column if not exists max_uses_per_customer integer,
  add column if not exists is_paused boolean not null default false;

alter table public.orders
  add column if not exists coupon_snapshot jsonb;

create table if not exists public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_email text,
  customer_phone text,
  discount_amount integer not null default 0,
  applied_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_coupon_usages_coupon_id on public.coupon_usages(coupon_id);
create index if not exists idx_coupon_usages_customer_email on public.coupon_usages(customer_email);
create index if not exists idx_coupon_usages_customer_phone on public.coupon_usages(customer_phone);
create index if not exists idx_coupon_usages_created_at on public.coupon_usages(created_at desc);

alter table public.coupon_usages enable row level security;

drop policy if exists "coupon_usages_service_only" on public.coupon_usages;
create policy "coupon_usages_service_only"
  on public.coupon_usages
  using (false);

update public.coupons
set discount_type = type
where discount_type is null;

create or replace function public.coupon_status(
  p_is_active boolean,
  p_is_paused boolean,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_used_count integer,
  p_max_uses integer
)
returns text
language plpgsql
as $$
begin
  if not p_is_active or p_is_paused then
    return 'paused';
  end if;
  if p_starts_at is not null and now() < p_starts_at then
    return 'paused';
  end if;
  if p_expires_at is not null and now() > p_expires_at then
    return 'expired';
  end if;
  if p_max_uses is not null and p_used_count >= p_max_uses then
    return 'exhausted';
  end if;
  return 'active';
end;
$$;

create or replace function public.increment_coupon_use(p_code text)
returns void
language plpgsql
as $$
begin
  update public.coupons
  set used_count = coalesce(used_count, 0) + 1
  where upper(code) = upper(p_code);
end;
$$;
