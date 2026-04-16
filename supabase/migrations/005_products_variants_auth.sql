-- ============================================
-- MIGRATION 005: Products overhaul + variants + auth cleanup
-- ============================================

-- ─── Drop old category CHECK constraint ────────────────────────────────
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;

-- ─── Add new columns to products ───────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS origin_country text,
  ADD COLUMN IF NOT EXISTS unit_of_measure text NOT NULL DEFAULT 'units'
    CHECK (unit_of_measure IN ('ml','g','kg','L','oz','units','box','pack')),
  ADD COLUMN IF NOT EXISTS base_price integer,
  ADD COLUMN IF NOT EXISTS weight_g_logistics integer,
  ADD COLUMN IF NOT EXISTS dimensions_cm jsonb,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS has_variants boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_spice_level boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','archived')),
  ADD COLUMN IF NOT EXISTS campaign text,
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS primary_image_index integer NOT NULL DEFAULT 0;

-- Migrate: copy price → base_price, set status from is_active
UPDATE public.products SET base_price = price WHERE base_price IS NULL;
UPDATE public.products SET status = CASE WHEN is_active THEN 'active' ELSE 'archived' END;
UPDATE public.products SET origin_country = origin WHERE origin_country IS NULL;

-- ─── Product Variants ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku_suffix text,
  price integer NOT NULL CHECK (price >= 0),
  compare_at_price integer CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  stock integer NOT NULL DEFAULT 0,
  attributes jsonb NOT NULL DEFAULT '{}',
  image text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);

-- Trigger for updated_at
CREATE TRIGGER set_product_variants_updated_at BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── RLS for product_variants ──────────────────────────────────────────
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Variants: public read active" ON public.product_variants
  FOR SELECT USING (status = 'active');

CREATE POLICY "Variants: admin read all" ON public.product_variants
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Variants: admin insert" ON public.product_variants
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Variants: admin update" ON public.product_variants
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Variants: admin delete" ON public.product_variants
  FOR DELETE USING (public.is_admin());

-- ─── Index for tags search ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
