-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.orders enable row level security;
alter table public.order_updates enable row level security;
alter table public.coupons enable row level security;
alter table public.favorites enable row level security;
alter table public.media enable row level security;
alter table public.product_media enable row level security;
alter table public.product_views enable row level security;
alter table public.notifications enable row level security;
alter table public.user_profiles enable row level security;
alter table public.app_config enable row level security;

-- Helper: check if user is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- ============================================
-- PRODUCTS: public read, admin write
-- ============================================
create policy "Products: public read active" on public.products
  for select using (is_active = true);

create policy "Products: admin read all" on public.products
  for select using (public.is_admin());

create policy "Products: admin insert" on public.products
  for insert with check (public.is_admin());

create policy "Products: admin update" on public.products
  for update using (public.is_admin());

create policy "Products: admin delete" on public.products
  for delete using (public.is_admin());

-- ============================================
-- CATEGORIES: public read, admin write
-- ============================================
create policy "Categories: public read" on public.categories
  for select using (true);

create policy "Categories: admin insert" on public.categories
  for insert with check (public.is_admin());

create policy "Categories: admin update" on public.categories
  for update using (public.is_admin());

create policy "Categories: admin delete" on public.categories
  for delete using (public.is_admin());

-- ============================================
-- ORDERS: users read own, admin read all
-- ============================================
create policy "Orders: users read own" on public.orders
  for select using (user_id = auth.uid());

create policy "Orders: read by id (guest tracking)" on public.orders
  for select using (true);

create policy "Orders: anyone can create" on public.orders
  for insert with check (true);

create policy "Orders: admin update" on public.orders
  for update using (public.is_admin());

-- ============================================
-- ORDER UPDATES: admin read all, linked to orders
-- ============================================
create policy "Order updates: admin read" on public.order_updates
  for select using (public.is_admin());

create policy "Order updates: admin insert" on public.order_updates
  for insert with check (public.is_admin());

-- ============================================
-- COUPONS: public read active, admin write
-- ============================================
create policy "Coupons: public read active" on public.coupons
  for select using (is_active = true and (expires_at is null or expires_at > now()));

create policy "Coupons: admin read all" on public.coupons
  for select using (public.is_admin());

create policy "Coupons: admin insert" on public.coupons
  for insert with check (public.is_admin());

create policy "Coupons: admin update" on public.coupons
  for update using (public.is_admin());

create policy "Coupons: admin delete" on public.coupons
  for delete using (public.is_admin());

-- ============================================
-- FAVORITES: users CRUD own
-- ============================================
create policy "Favorites: users read own" on public.favorites
  for select using (user_id = auth.uid());

create policy "Favorites: users insert own" on public.favorites
  for insert with check (user_id = auth.uid());

create policy "Favorites: users delete own" on public.favorites
  for delete using (user_id = auth.uid());

-- ============================================
-- MEDIA: public read, admin write
-- ============================================
create policy "Media: public read" on public.media
  for select using (true);

create policy "Media: admin insert" on public.media
  for insert with check (public.is_admin());

create policy "Media: admin delete" on public.media
  for delete using (public.is_admin());

-- ============================================
-- PRODUCT MEDIA: public read, admin write
-- ============================================
create policy "Product media: public read" on public.product_media
  for select using (true);

create policy "Product media: admin insert" on public.product_media
  for insert with check (public.is_admin());

create policy "Product media: admin update" on public.product_media
  for update using (public.is_admin());

create policy "Product media: admin delete" on public.product_media
  for delete using (public.is_admin());

-- ============================================
-- PRODUCT VIEWS: anyone insert, admin read
-- ============================================
create policy "Product views: anyone insert" on public.product_views
  for insert with check (true);

create policy "Product views: admin read" on public.product_views
  for select using (public.is_admin());

-- ============================================
-- NOTIFICATIONS: users read/update own
-- ============================================
create policy "Notifications: users read own" on public.notifications
  for select using (user_id = auth.uid());

create policy "Notifications: users update own" on public.notifications
  for update using (user_id = auth.uid());

create policy "Notifications: system insert" on public.notifications
  for insert with check (true);

-- ============================================
-- USER PROFILES: users read/update own, admin read all
-- ============================================
create policy "Profiles: users read own" on public.user_profiles
  for select using (id = auth.uid());

create policy "Profiles: admin read all" on public.user_profiles
  for select using (public.is_admin());

create policy "Profiles: users update own" on public.user_profiles
  for update using (id = auth.uid());

-- ============================================
-- APP CONFIG: public read, admin write
-- ============================================
create policy "App config: public read" on public.app_config
  for select using (true);

create policy "App config: admin update" on public.app_config
  for update using (public.is_admin());
