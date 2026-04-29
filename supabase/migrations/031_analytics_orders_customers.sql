-- ============================================
-- 031: ANALYTICS - ORDERS & CUSTOMERS ENHANCEMENTS
-- ============================================
/Users/quiron/CascadeProjects/nurei/supabase/migrations/032_analytics_order_refunds.sql
-- ============================================
-- ORDERS: Add missing columns for analytics
-- ============================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tax_amount_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_cost_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acquisition_source text CHECK (acquisition_source IN ('organic', 'affiliate', 'direct', 'paid', 'referral', 'other')),
  ADD COLUMN IF NOT EXISTS acquisition_campaign text;

CREATE INDEX IF NOT EXISTS idx_orders_acquisition_source ON public.orders(acquisition_source);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON public.orders(paid_at DESC);

-- ============================================
-- CUSTOMERS: Add missing columns for analytics
-- ============================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS acquired_via_affiliate_id uuid REFERENCES public.affiliate_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_order_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_order_at timestamptz,
  ADD COLUMN IF NOT EXISTS lifetime_value_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_orders int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_customers_affiliate ON public.customers(acquired_via_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_customers_lifetime_value ON public.customers(lifetime_value_cents DESC);
CREATE INDEX IF NOT EXISTS idx_customers_first_order ON public.customers(first_order_at DESC);

-- ============================================
-- BACKFILL: Populate customer stats from existing orders
-- ============================================

-- Backfill lifetime_value_cents and total_orders
UPDATE public.customers c
SET
  lifetime_value_cents = COALESCE(order_stats.total_spent, 0),
  total_orders = COALESCE(order_stats.order_count, 0),
  first_order_at = order_stats.first_order,
  last_order_at = order_stats.last_order
FROM (
  SELECT
    o.customer_phone as phone,
    SUM(o.total) as total_spent,
    COUNT(o.id) as order_count,
    MIN(o.paid_at) as first_order,
    MAX(o.paid_at) as last_order
  FROM public.orders o
  WHERE o.paid_at IS NOT NULL
    AND o.status != 'cancelled'
  GROUP BY o.customer_phone
) order_stats
WHERE c.phone = order_stats.phone;

-- ============================================
-- BACKFILL: Populate orders acquisition_source from existing data
-- ============================================

UPDATE public.orders o
SET acquisition_source = 
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.affiliate_attributions aa
      WHERE aa.order_id = o.id
    ) THEN 'affiliate'
    WHEN o.source = 'web' THEN 'organic'
    ELSE 'direct'
  END
WHERE acquisition_source IS NULL;
