-- ============================================
-- 033: ANALYTICS - MATERIALIZED VIEWS
-- ============================================

-- ============================================
-- MATERIALIZED VIEW: Daily Revenue
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_daily_revenue AS
SELECT
  DATE(o.created_at) as date,
  SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END) as gross_revenue,
  SUM(CASE WHEN o.status = 'cancelled' THEN -o.total ELSE 0 END) as refunds,
  SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END) +
  SUM(CASE WHEN o.status = 'cancelled' THEN -o.total ELSE 0 END) as net_revenue,
  COUNT(o.id) as orders_count,
  COALESCE(SUM(oi.quantity), 0) as items_sold,
  COALESCE(SUM(oi.cost_estimate_cents * oi.quantity), 0) as cogs,
  CASE
    WHEN SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END) > 0
    THEN ((SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END) -
           COALESCE(SUM(oi.cost_estimate_cents * oi.quantity), 0))::float /
           NULLIF(SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END), 0)) * 100
    ELSE 0
  END as gross_margin,
  CASE
    WHEN COUNT(o.id) > 0 AND o.status != 'cancelled'
    THEN SUM(o.total) / NULLIF(COUNT(o.id), 0)
    ELSE 0
  END as avg_ticket,
  COUNT(DISTINCT o.customer_phone) as unique_customers,
  COUNT(DISTINCT CASE
    WHEN o.created_at >= DATE_TRUNC('month', o.created_at)
    THEN o.customer_phone
    ELSE NULL
  END) as new_customers,
  COUNT(DISTINCT CASE
    WHEN o.created_at < DATE_TRUNC('month', o.created_at)
    THEN o.customer_phone
    ELSE NULL
  END) as returning_customers
FROM public.orders o
LEFT JOIN public.order_items oi ON o.id = oi.order_id
WHERE o.created_at IS NOT NULL
GROUP BY DATE(o.created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_revenue_date ON public.mv_daily_revenue(date);
CREATE INDEX IF NOT EXISTS idx_mv_daily_revenue_date_desc ON public.mv_daily_revenue(date DESC);

-- ============================================
-- FUNCTION: Refresh mv_daily_revenue
-- ============================================

CREATE OR REPLACE FUNCTION public.refresh_daily_revenue()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_revenue;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MATERIALIZED VIEW: Product Performance
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_product_performance AS
SELECT
  p.id as product_id,
  p.name as product_name,
  p.category,
  DATE_TRUNC('month', NOW()) as period_start,
  COALESCE(SUM(oi.quantity), 0) as units_sold,
  COALESCE(SUM(oi.total_cents), 0) as revenue,
  COALESCE(SUM(oi.cost_estimate_cents * oi.quantity), 0) as cogs,
  CASE
    WHEN COALESCE(SUM(oi.total_cents), 0) > 0
    THEN ((COALESCE(SUM(oi.total_cents), 0) -
           COALESCE(SUM(oi.cost_estimate_cents * oi.quantity), 0))::float /
           NULLIF(COALESCE(SUM(oi.total_cents), 0), 0)) * 100
    ELSE 0
  END as margin_pct,
  p.views_count,
  COALESCE(p.purchases_count, 0) as orders_count,
  CASE
    WHEN p.views_count > 0
    THEN (COALESCE(p.purchases_count, 0)::float / p.views_count) * 100
    ELSE 0
  END as conversion_rate,
  CASE
    WHEN COALESCE(SUM(oi.quantity), 0) > 0 AND p.cost_estimate_cents > 0
    THEN (p.cost_estimate_cents / NULLIF(COALESCE(SUM(oi.quantity), 0), 0.0))::numeric
    ELSE 0
  END as stock_turnover_days
FROM public.products p
LEFT JOIN public.order_items oi ON p.id = oi.product_id
  AND oi.created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '30 days'
GROUP BY p.id, p.name, p.category, p.views_count, p.purchases_count, p.cost_estimate_cents;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_performance_product ON public.mv_product_performance(product_id);
CREATE INDEX IF NOT EXISTS idx_mv_product_performance_revenue ON public.mv_product_performance(revenue DESC);
CREATE INDEX IF NOT EXISTS idx_mv_product_performance_category ON public.mv_product_performance(category);

-- ============================================
-- FUNCTION: Refresh mv_product_performance
-- ============================================

CREATE OR REPLACE FUNCTION public.refresh_product_performance()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_product_performance;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Refresh all analytics materialized views
-- ============================================

CREATE OR REPLACE FUNCTION public.refresh_all_analytics_views()
RETURNS void AS $$
BEGIN
  PERFORM public.refresh_daily_revenue();
  PERFORM public.refresh_product_performance();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SCHEDULE REFRESH via pg_cron (if available)
-- ============================================

-- Uncomment if pg_cron extension is available:
-- SELECT cron.schedule('refresh-analytics', '0 * * * *', 'SELECT public.refresh_all_analytics_views();');
