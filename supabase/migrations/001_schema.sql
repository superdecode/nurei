-- ============================================
-- NUREI: Full database schema
-- ============================================

-- Enable UUID extension


-- ============================================
-- PRODUCTS
-- ============================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category text not null check (category in ('crunchy', 'spicy', 'limited_edition', 'drinks')),
  subcategory text,
  sku text not null unique,
  origin text not null default '',
  spice_level integer not null default 0 check (spice_level between 0 and 5),
  weight_g integer not null default 0,
  price integer not null check (price >= 0), -- centavos MXN
  compare_at_price integer check (compare_at_price is null or compare_at_price >= 0),
  cost_estimate integer check (cost_estimate is null or cost_estimate >= 0),
  availability_score integer not null default 100 check (availability_score between 0 and 100),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_limited boolean not null default false,
  image_url text,
  image_thumbnail_url text,
  views_count integer not null default 0,
  purchases_count integer not null default 0,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_category on public.products(category);
create index idx_products_slug on public.products(slug);
create index idx_products_active on public.products(is_active) where is_active = true;
create index idx_products_featured on public.products(is_featured) where is_featured = true;

-- ============================================
-- CATEGORIES
-- ============================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  emoji text,
  color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================
-- USER PROFILES (extends auth.users)
-- ============================================
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- ORDERS
-- ============================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  short_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text,
  customer_phone text not null,
  customer_email text,
  delivery_address text not null,
  delivery_instructions text,
  items jsonb not null default '[]',
  subtotal integer not null check (subtotal >= 0),
  shipping_fee integer not null default 0,
  coupon_code text,
  coupon_discount integer not null default 0,
  discount integer not null default 0,
  total integer not null check (total >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'failed')),
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at timestamptz,
  cancellation_reason text,
  failure_reason text,
  operator_notes text,
  source text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_user on public.orders(user_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_short_id on public.orders(short_id);
create index idx_orders_created on public.orders(created_at desc);

-- ============================================
-- ORDER UPDATES (audit trail)
-- ============================================
create table if not exists public.order_updates (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  message text,
  updated_by text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_order_updates_order on public.order_updates(order_id);

-- ============================================
-- COUPONS
-- ============================================
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percentage', 'fixed')),
  value integer not null check (value > 0), -- percentage (1-100) or centavos
  min_order_amount integer not null default 0,
  max_uses integer, -- null = unlimited
  used_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_coupons_code on public.coupons(upper(code));

-- ============================================
-- FAVORITES
-- ============================================
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create index idx_favorites_user on public.favorites(user_id);

-- ============================================
-- MEDIA
-- ============================================
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  url text not null,
  thumbnail_url text,
  size_bytes integer not null default 0,
  mime_type text not null,
  alt_text text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================
-- PRODUCT MEDIA (join table)
-- ============================================
create table if not exists public.product_media (
  product_id uuid not null references public.products(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  primary key (product_id, media_id)
);

-- ============================================
-- PRODUCT VIEWS (analytics)
-- ============================================
create table if not exists public.product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  created_at timestamptz not null default now()
);

create index idx_product_views_product on public.product_views(product_id);
create index idx_product_views_created on public.product_views(created_at desc);

-- ============================================
-- NOTIFICATIONS
-- ============================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'general',
  read_at timestamptz,
  data jsonb,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id);
create index idx_notifications_unread on public.notifications(user_id) where read_at is null;

-- ============================================
-- APP CONFIG (key-value store)
-- ============================================
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '{}',
  description text,
  updated_at timestamptz not null default now()
);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_products_updated_at before update on public.products
  for each row execute function public.handle_updated_at();

create trigger set_orders_updated_at before update on public.orders
  for each row execute function public.handle_updated_at();

create trigger set_user_profiles_updated_at before update on public.user_profiles
  for each row execute function public.handle_updated_at();

create trigger set_coupons_updated_at before update on public.coupons
  for each row execute function public.handle_updated_at();

-- ============================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
