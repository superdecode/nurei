-- Brands catalog + optional FK on products
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists brands_name_lower_idx on public.brands (lower(trim(name)));

alter table public.products
  add column if not exists brand_id uuid references public.brands (id) on delete set null;

create index if not exists products_brand_id_idx on public.products (brand_id);

alter table public.brands enable row level security;

-- Public read for storefront / autocomplete (API may use service role too)
create policy "Brands are readable by everyone"
  on public.brands for select
  using (true);

comment on table public.brands is 'Product brand names; products.brand_id links here; legacy products.brand text may still exist for display.';
