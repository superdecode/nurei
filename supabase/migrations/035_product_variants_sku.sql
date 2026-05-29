-- ============================================
-- MIGRATION 035: Add full SKU to product_variants
-- ============================================

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS sku text;

-- Partial unique index: only enforces uniqueness when sku is non-null and non-empty
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_sku
  ON public.product_variants(sku)
  WHERE sku IS NOT NULL AND sku <> '';
