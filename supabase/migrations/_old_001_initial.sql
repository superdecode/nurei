-- ============================================
-- InBreve MVP - Initial Schema
-- ============================================

-- PRODUCTOS
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('cerveza', 'tequila', 'vodka', 'ron', 'whisky', 'vino', 'mezcal', 'otros')),
  subcategory TEXT,
  volume_ml INTEGER,
  units_per_pack INTEGER DEFAULT 1,
  price INTEGER NOT NULL,
  cost_estimate INTEGER,
  availability_score INTEGER DEFAULT 100 CHECK (availability_score BETWEEN 0 AND 100),
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  image_url TEXT,
  image_thumbnail_url TEXT,
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_featured ON products(is_featured);

-- ZONAS OPERATIVAS
CREATE TABLE zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  address_keywords TEXT[] NOT NULL,
  center_lat DECIMAL(10, 8),
  center_lng DECIMAL(11, 8),
  radius_km DECIMAL(5, 2) DEFAULT 1.5,
  is_active BOOLEAN DEFAULT true,
  min_order_amount INTEGER DEFAULT 20000,
  delivery_fee INTEGER DEFAULT 3000,
  estimated_delivery_minutes INTEGER DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_zones_active ON zones(is_active);

-- TIENDAS
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('convenience', 'liquor_store', 'supermarket')),
  address TEXT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  zone_id UUID REFERENCES zones(id),
  phone TEXT,
  whatsapp TEXT,
  hours_open TEXT DEFAULT '24h',
  is_24h BOOLEAN DEFAULT false,
  reliability_score INTEGER DEFAULT 50 CHECK (reliability_score BETWEEN 0 AND 100),
  price_competitiveness INTEGER DEFAULT 50 CHECK (price_competitiveness BETWEEN 0 AND 100),
  speed_score INTEGER DEFAULT 50 CHECK (speed_score BETWEEN 0 AND 100),
  total_orders INTEGER DEFAULT 0,
  successful_orders INTEGER DEFAULT 0,
  avg_product_availability DECIMAL(5, 2),
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stores_location ON stores(lat, lng);
CREATE INDEX idx_stores_zone ON stores(zone_id);
CREATE INDEX idx_stores_active ON stores(is_active);

-- PEDIDOS
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  delivery_address TEXT NOT NULL,
  delivery_instructions TEXT,
  delivery_lat DECIMAL(10, 8),
  delivery_lng DECIMAL(11, 8),
  zone_id UUID REFERENCES zones(id),
  items JSONB NOT NULL,
  subtotal INTEGER NOT NULL,
  delivery_fee INTEGER NOT NULL,
  discount INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  assigned_store_id UUID REFERENCES stores(id),
  assigned_store_name TEXT,
  assigned_store_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'assigned', 'picking', 'in_transit', 'delivered', 'cancelled', 'failed'
  )),
  estimated_delivery_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  picked_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  failure_reason TEXT,
  operator_notes TEXT,
  source TEXT DEFAULT 'web',
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_short_id ON orders(short_id);
CREATE INDEX idx_orders_phone ON orders(customer_phone);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_store ON orders(assigned_store_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);

-- ORDER UPDATES (timeline)
CREATE TABLE order_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  message TEXT,
  updated_by TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_updates_order ON order_updates(order_id);
CREATE INDEX idx_order_updates_created ON order_updates(created_at DESC);

-- STOCK EVENTS
CREATE TABLE stock_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  store_id UUID REFERENCES stores(id),
  product_id UUID REFERENCES products(id),
  was_available BOOLEAN NOT NULL,
  alternative_purchased_id UUID REFERENCES products(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_events_store_product ON stock_events(store_id, product_id);

-- APP CONFIG
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-generate short_id
CREATE OR REPLACE FUNCTION generate_short_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) INTO counter
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;
  new_id := 'INB-' || LPAD((counter + 1)::TEXT, 3, '0');
  NEW.short_id := new_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_short_id
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_short_id();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_timestamp BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_products_timestamp BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_stores_timestamp BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DATA
-- ============================================

-- Zone
INSERT INTO zones (name, slug, address_keywords, center_lat, center_lng, is_active) VALUES
  ('Roma/Condesa', 'roma-condesa',
   ARRAY['roma', 'condesa', 'hipódromo', 'álvaro obregón', 'orizaba', 'tamaulipas', 'michoacán'],
   19.4146, -99.1635, true);

-- Stores
INSERT INTO stores (name, type, address, lat, lng, zone_id, is_24h, notes) VALUES
  ('7-Eleven Álvaro Obregón', 'convenience', 'Álvaro Obregón 132, Roma Norte', 19.4146, -99.1635, (SELECT id FROM zones WHERE slug = 'roma-condesa'), true, 'Ubicación central, siempre abierto'),
  ('Oxxo Tamaulipas', 'convenience', 'Tamaulipas 152, Condesa', 19.4096, -99.1697, (SELECT id FROM zones WHERE slug = 'roma-condesa'), true, 'Buena ubicación Condesa'),
  ('Licorera Don José', 'liquor_store', 'Orizaba 45, Roma Norte', 19.4156, -99.1645, (SELECT id FROM zones WHERE slug = 'roma-condesa'), false, 'Cierra 11pm, buenos precios'),
  ('7-Eleven Michoacán', 'convenience', 'Michoacán 38, Condesa', 19.4108, -99.1712, (SELECT id FROM zones WHERE slug = 'roma-condesa'), true, NULL),
  ('Depósito Santa María', 'liquor_store', 'Insurgentes Sur 219, Roma Sur', 19.4089, -99.1629, (SELECT id FROM zones WHERE slug = 'roma-condesa'), false, 'Cierra 10pm, amplio surtido');

-- Products: Cerveza
INSERT INTO products (name, slug, category, volume_ml, units_per_pack, price, cost_estimate, availability_score, is_active, is_featured) VALUES
  ('Cerveza Victoria 12-pack', 'cerveza-victoria-12-pack', 'cerveza', 355, 12, 21000, 18000, 95, true, true),
  ('Cerveza Corona 12-pack', 'cerveza-corona-12-pack', 'cerveza', 355, 12, 24000, 21000, 90, true, true),
  ('Cerveza Modelo Especial 12-pack', 'cerveza-modelo-especial-12-pack', 'cerveza', 355, 12, 23000, 20000, 90, true, false),
  ('Cerveza Heineken 6-pack', 'cerveza-heineken-6-pack', 'cerveza', 355, 6, 15000, 13000, 85, true, false);

-- Products: Tequila
INSERT INTO products (name, slug, category, subcategory, volume_ml, units_per_pack, price, cost_estimate, availability_score, is_active, is_featured) VALUES
  ('Tequila Jimador Blanco 700ml', 'tequila-jimador-blanco-700ml', 'tequila', 'blanco', 700, 1, 35000, 32000, 90, true, true),
  ('Tequila Herradura Reposado 700ml', 'tequila-herradura-reposado-700ml', 'tequila', 'reposado', 700, 1, 52000, 48000, 80, true, false),
  ('Tequila Don Julio Blanco 700ml', 'tequila-don-julio-blanco-700ml', 'tequila', 'blanco', 700, 1, 75000, 68000, 75, true, true);

-- Products: Vodka
INSERT INTO products (name, slug, category, volume_ml, units_per_pack, price, cost_estimate, availability_score, is_active, is_featured) VALUES
  ('Vodka Absolut 750ml', 'vodka-absolut-750ml', 'vodka', 750, 1, 38000, 35000, 85, true, false),
  ('Vodka Smirnoff 750ml', 'vodka-smirnoff-750ml', 'vodka', 750, 1, 31000, 28000, 90, true, false);

-- Products: Ron
INSERT INTO products (name, slug, category, volume_ml, units_per_pack, price, cost_estimate, availability_score, is_active, is_featured) VALUES
  ('Ron Bacardí Blanco 750ml', 'ron-bacardi-blanco-750ml', 'ron', 750, 1, 31000, 28000, 85, true, false),
  ('Ron Havana Club 3 Años 700ml', 'ron-havana-club-3-anos-700ml', 'ron', 700, 1, 35000, 32000, 75, true, false);

-- Products: Whisky
INSERT INTO products (name, slug, category, volume_ml, units_per_pack, price, cost_estimate, availability_score, is_active, is_featured) VALUES
  ('Whisky Johnnie Walker Red 750ml', 'whisky-johnnie-walker-red-750ml', 'whisky', 750, 1, 46000, 42000, 85, true, false),
  ('Whisky Buchanans 12 Años 750ml', 'whisky-buchanans-12-anos-750ml', 'whisky', 750, 1, 92000, 85000, 70, true, true);

-- Products: Vino
INSERT INTO products (name, slug, category, subcategory, volume_ml, units_per_pack, price, cost_estimate, availability_score, is_active, is_featured) VALUES
  ('Vino L.A. Cetto Tinto 750ml', 'vino-la-cetto-tinto-750ml', 'vino', 'tinto', 750, 1, 21000, 18000, 80, true, false),
  ('Vino Casa Madero Blanco 750ml', 'vino-casa-madero-blanco-750ml', 'vino', 'blanco', 750, 1, 24000, 21000, 75, true, false);

-- App Config
INSERT INTO app_config (key, value, description) VALUES
  ('operational_hours', '{"start": "17:00", "end": "02:00"}', 'Horario operación'),
  ('min_order_amount', '20000', 'Pedido mínimo en centavos'),
  ('default_delivery_fee', '3000', 'Fee entrega default'),
  ('maintenance_mode', 'false', 'Modo mantenimiento');
