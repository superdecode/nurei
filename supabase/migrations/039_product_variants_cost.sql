-- MIGRATION 039: Add cost_estimate to product_variants
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS cost_estimate integer;
