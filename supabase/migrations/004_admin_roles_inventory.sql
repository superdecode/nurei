-- ============================================
-- 004: ADMIN ROLES, PERMISSIONS, INVENTORY, PAYMENT METHODS, STORE SETTINGS
-- ============================================

-- ─── ADMIN ROLES ────────────────────────────
create table if not exists public.admin_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  color       text not null default 'bg-gray-100 text-gray-800',
  permissions jsonb not null default '{}',
  is_system   boolean not null default false, -- prevent deletion of system roles
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Seed default roles
insert into public.admin_roles (name, description, color, permissions, is_system) values
  ('super_admin', 'Acceso total al sistema', 'bg-red-100 text-red-800', '{
    "dashboard": "total",
    "pedidos": "total",
    "productos": "total",
    "categorias": "total",
    "inventario": "total",
    "cupones": "total",
    "multimedia": "total",
    "clientes": "total",
    "usuarios": "total",
    "roles": "total",
    "configuracion": "total",
    "analytics": "total",
    "pagos": "total"
  }', true),
  ('admin', 'Administrador general', 'bg-blue-100 text-blue-800', '{
    "dashboard": "total",
    "pedidos": "total",
    "productos": "total",
    "categorias": "total",
    "inventario": "total",
    "cupones": "total",
    "multimedia": "total",
    "clientes": "lectura",
    "usuarios": "lectura",
    "roles": "lectura",
    "configuracion": "escritura",
    "analytics": "lectura",
    "pagos": "escritura"
  }', true),
  ('operador', 'Operador de pedidos', 'bg-green-100 text-green-800', '{
    "dashboard": "lectura",
    "pedidos": "escritura",
    "productos": "lectura",
    "categorias": "lectura",
    "inventario": "lectura",
    "cupones": "lectura",
    "multimedia": "lectura",
    "clientes": "lectura",
    "usuarios": "sin_acceso",
    "roles": "sin_acceso",
    "configuracion": "sin_acceso",
    "analytics": "lectura",
    "pagos": "lectura"
  }', true),
  ('consulta', 'Solo lectura', 'bg-gray-100 text-gray-800', '{
    "dashboard": "lectura",
    "pedidos": "lectura",
    "productos": "lectura",
    "categorias": "lectura",
    "inventario": "lectura",
    "cupones": "lectura",
    "multimedia": "lectura",
    "clientes": "lectura",
    "usuarios": "sin_acceso",
    "roles": "sin_acceso",
    "configuracion": "sin_acceso",
    "analytics": "lectura",
    "pagos": "lectura"
  }', false);

-- ─── EXTEND USER PROFILES ──────────────────
-- Add admin role reference to user_profiles
alter table public.user_profiles
  add column if not exists admin_role_id uuid references public.admin_roles(id) on delete set null,
  add column if not exists is_active boolean not null default true,
  add column if not exists last_login_at timestamptz;

-- ─── INVENTORY MOVEMENTS ───────────────────
create table if not exists public.inventory_movements (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  type        text not null check (type in ('entrada', 'salida', 'ajuste', 'venta', 'devolucion')),
  quantity    integer not null, -- positive for entrada, negative for salida
  reason      text,
  reference   text, -- e.g. order_id, manual note
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index idx_inventory_movements_product on public.inventory_movements(product_id);
create index idx_inventory_movements_created on public.inventory_movements(created_at desc);

-- Add stock fields to products
alter table public.products
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists low_stock_threshold integer not null default 5,
  add column if not exists track_inventory boolean not null default true,
  add column if not exists allow_backorder boolean not null default false;

-- ─── PAYMENT METHODS ───────────────────────
create table if not exists public.payment_methods (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  icon          text, -- lucide icon name
  is_active     boolean not null default true,
  config        jsonb not null default '{}', -- method-specific config
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Seed default payment methods
insert into public.payment_methods (name, slug, description, icon, is_active, config, sort_order) values
  ('Tarjeta de crédito/débito', 'stripe_card', 'Pago seguro con tarjeta vía Stripe', 'CreditCard', true, '{"provider": "stripe"}', 1),
  ('Efectivo', 'cash', 'Pago en efectivo al momento de la entrega', 'Banknote', true, '{}', 2),
  ('Transferencia bancaria', 'bank_transfer', 'Transferencia SPEI o depósito bancario', 'Building', false, '{"clabe": "", "bank_name": "", "beneficiary": ""}', 3),
  ('PayPal', 'paypal', 'Pago con cuenta PayPal', 'Wallet', false, '{"client_id": ""}', 4),
  ('Mercado Pago', 'mercado_pago', 'Pago con Mercado Pago', 'Smartphone', false, '{"access_token": ""}', 5);

-- ─── STORE SETTINGS (extend app_config) ────
-- Insert default e-commerce settings
insert into public.app_config (key, value, description) values
  ('store_info', '{"name": "Nurei - Premium Asian Snacks", "phone": "+52 55 1234 5678", "whatsapp": "+52 55 1234 5678", "email": "hola@nurei.mx", "address": "Col. Roma Norte, Cuauhtémoc, CDMX", "description": "Snacks asiáticos premium importados. De Tokyo a tu puerta en CDMX."}', 'Información general de la tienda'),
  ('shipping', '{"fee_cents": 2900, "free_shipping_min_cents": 50000, "estimated_time": "2-4 días hábiles", "enabled": true, "zones": ["CDMX", "Área Metropolitana"]}', 'Configuración de envío'),
  ('checkout', '{"require_account": false, "guest_checkout": true, "min_order_cents": 10000, "max_items_per_order": 50}', 'Configuración del checkout'),
  ('notifications', '{"email_admin": "admin@nurei.mx", "email_on_new_order": true, "email_on_payment": true, "whatsapp_customer": false, "sound_alerts": true}', 'Configuración de notificaciones'),
  ('appearance', '{"primary_color": "#00E5FF", "logo_url": null, "favicon_url": null, "social_links": {"instagram": "", "facebook": "", "tiktok": ""}}', 'Apariencia de la tienda'),
  ('seo', '{"meta_title": "Nurei - Premium Asian Snacks", "meta_description": "Los mejores snacks asiáticos importados directo a tu puerta en CDMX", "og_image": null}', 'Configuración SEO'),
  ('legal', '{"terms_url": "", "privacy_url": "", "return_policy": "Aceptamos devoluciones dentro de los 7 días posteriores a la entrega.", "tax_rate": 16}', 'Legal y políticas')
on conflict (key) do nothing;

-- ─── RLS ───────────────────────────────────
alter table public.admin_roles enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.payment_methods enable row level security;

-- Admin roles: admin read/write
create policy "Admin roles: admin read" on public.admin_roles
  for select using (public.is_admin());
create policy "Admin roles: admin insert" on public.admin_roles
  for insert with check (public.is_admin());
create policy "Admin roles: admin update" on public.admin_roles
  for update using (public.is_admin());
create policy "Admin roles: admin delete" on public.admin_roles
  for delete using (public.is_admin() and is_system = false);

-- Inventory movements: admin only
create policy "Inventory: admin read" on public.inventory_movements
  for select using (public.is_admin());
create policy "Inventory: admin insert" on public.inventory_movements
  for insert with check (public.is_admin());

-- Payment methods: public read active, admin write
create policy "Payment methods: public read active" on public.payment_methods
  for select using (is_active = true);
create policy "Payment methods: admin read all" on public.payment_methods
  for select using (public.is_admin());
create policy "Payment methods: admin insert" on public.payment_methods
  for insert with check (public.is_admin());
create policy "Payment methods: admin update" on public.payment_methods
  for update using (public.is_admin());
create policy "Payment methods: admin delete" on public.payment_methods
  for delete using (public.is_admin());

-- App config: admin insert
create policy "App config: admin insert" on public.app_config
  for insert with check (public.is_admin());

-- ─── TRIGGERS ──────────────────────────────
create trigger set_admin_roles_updated_at before update on public.admin_roles
  for each row execute function public.handle_updated_at();

create trigger set_payment_methods_updated_at before update on public.payment_methods
  for each row execute function public.handle_updated_at();

-- ─── SUPABASE STORAGE BUCKET ───────────────
-- Create media bucket for file uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
)
on conflict (id) do nothing;

-- Storage policies
create policy "Media: public read" on storage.objects
  for select using (bucket_id = 'media');

create policy "Media: admin upload" on storage.objects
  for insert with check (bucket_id = 'media' and public.is_admin());

create policy "Media: admin delete" on storage.objects
  for delete using (bucket_id = 'media' and public.is_admin());
