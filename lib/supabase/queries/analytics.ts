import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateRFMScore, forecastRevenue } from '@/lib/analytics/calculations'

export type Granularity = 'day' | 'week' | 'month'

export interface DateRange {
  dateFrom: string
  dateTo: string
}

export interface RevenuePoint {
  date: string
  revenue: number
  orders: number
  aov: number
  prev_revenue?: number
  prev_orders?: number
  prev_aov?: number
}

export interface ProductPerformance {
  product_id: string
  product_name: string
  category: string
  units_sold: number
  revenue: number
  cogs: number
  margin_pct: number
  orders_count: number
  views_count: number
  conversion_rate: number
  stock_turnover_days: number
}

export interface CategoryPerformance {
  category: string
  revenue: number
  units_sold: number
  orders_count: number
  margin_pct: number
  product_count: number
}

export interface CohortRow {
  cohort_month: string
  cohort_size: number
  retention: Record<number, number>
}

export interface CustomerSegment {
  segment: string
  count: number
  avg_ltv: number
  total_revenue: number
}

export interface LTVData {
  buckets: { range: string; count: number }[]
  top_customers: {
    id: string
    name: string
    phone: string
    ltv: number
    orders: number
    last_order_at: string | null
  }[]
  avg_ltv: number
  median_ltv: number
}

export interface AffiliateROI {
  affiliate_id: string
  affiliate_name: string
  orders: number
  revenue: number
  commissions_paid: number
  roi: number
  conversion_rate: number
  clicks: number
}

export interface CouponPerf {
  coupon_id: string
  code: string
  uses: number
  discount_total: number
  revenue_attributed: number
  roi: number
  redemption_rate: number
  max_uses: number | null
}

export interface InventoryHealth {
  product_id: string
  product_name: string
  category: string
  stock_quantity: number
  units_sold_30d: number
  days_of_inventory: number
  velocity: number
  cost_estimate_cents: number
  status: 'ok' | 'low' | 'stockout' | 'overstock' | 'no_sales'
}

export interface FunnelStage {
  stage: string
  count: number
  avg_hours_to_next: number | null
  drop_off_rate: number | null
}

export interface PaymentBreakdown {
  method: string
  count: number
  total: number
  avg_ticket: number
  success_rate: number
}

export interface GeographicPoint {
  postal_code: string
  city: string | null
  state: string | null
  orders: number
  revenue: number
}

export interface RefundsAnalysis {
  total_refunds: number
  total_amount: number
  refund_rate: number
  by_reason: { reason: string; count: number; amount: number }[]
  top_refunded_products: { product_name: string; count: number; amount: number }[]
}

export interface DeliveryPerf {
  avg_hours: number
  on_time_rate: number
  by_zone: { zone: string; avg_hours: number; count: number }[]
  stage_times: { from_status: string; to_status: string; avg_hours: number }[]
}

export interface DashboardSummary {
  revenue: number
  prev_revenue: number
  orders: number
  prev_orders: number
  aov: number
  prev_aov: number
  gross_margin: number
  new_customers: number
  pending_orders: number
  refund_rate: number
  alerts: {
    type: string
    severity: 'high' | 'medium' | 'low'
    message: string
    link?: string
  }[]
}


export async function getRevenueTimeSeries(
  supabase: SupabaseClient,
  { dateFrom, dateTo }: DateRange,
  granularity: Granularity = 'day',
): Promise<RevenuePoint[]> {
  const fromMs = new Date(dateFrom).getTime()
  const toMs = new Date(dateTo).getTime()
  const rangeMs = toMs - fromMs
  const prevFrom = new Date(fromMs - rangeMs).toISOString().slice(0, 10)
  const prevTo = new Date(fromMs - 86400000).toISOString().slice(0, 10)

  const [{ data, error }, { data: prevData }] = await Promise.all([
    supabase
      .from('orders')
      .select('created_at, total')
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59.999Z')
      .in('status', ['pending', 'confirmed', 'shipped', 'delivered'])
      .order('created_at', { ascending: true }),
    supabase
      .from('orders')
      .select('created_at, total')
      .gte('created_at', prevFrom)
      .lte('created_at', prevTo + 'T23:59:59.999Z')
      .in('status', ['pending', 'confirmed', 'shipped', 'delivered'])
      .order('created_at', { ascending: true }),
  ])

  if (error || !data) return []

  type DayBucket = { revenue: number; orders: number }
  const toDay = (iso: string) => iso.slice(0, 10)

  const currentByDay = new Map<string, DayBucket>()
  const prevByDay = new Map<string, DayBucket>()

  for (const o of data) {
    const day = toDay(o.created_at)
    const b = currentByDay.get(day) ?? { revenue: 0, orders: 0 }
    b.revenue += o.total ?? 0
    b.orders++
    currentByDay.set(day, b)
  }

  for (const o of prevData ?? []) {
    const day = toDay(o.created_at)
    const b = prevByDay.get(day) ?? { revenue: 0, orders: 0 }
    b.revenue += o.total ?? 0
    b.orders++
    prevByDay.set(day, b)
  }

  const getBucketKey = (dateStr: string) => {
    const d = new Date(dateStr)
    if (granularity === 'week') {
      const startOfWeek = new Date(d)
      startOfWeek.setDate(d.getDate() - d.getDay())
      return startOfWeek.toISOString().slice(0, 10)
    }
    if (granularity === 'month') {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    }
    return dateStr
  }

  if (granularity === 'day') {
    const days: string[] = []
    let cursor = new Date(dateFrom + 'T00:00:00Z')
    const end = new Date(dateTo + 'T00:00:00Z')
    while (cursor <= end) {
      days.push(cursor.toISOString().slice(0, 10))
      cursor = new Date(cursor.getTime() + 86400000)
    }
    return days.map((day) => {
      const offset = new Date(day + 'T00:00:00Z').getTime() - new Date(dateFrom + 'T00:00:00Z').getTime()
      const prevDay = new Date(new Date(prevFrom + 'T00:00:00Z').getTime() + offset).toISOString().slice(0, 10)
      const curr = currentByDay.get(day) ?? { revenue: 0, orders: 0 }
      const prev = prevByDay.get(prevDay) ?? { revenue: 0, orders: 0 }
      return {
        date: day,
        revenue: curr.revenue,
        orders: curr.orders,
        aov: curr.orders > 0 ? Math.round(curr.revenue / curr.orders) : 0,
        prev_revenue: prev.revenue,
        prev_orders: prev.orders,
        prev_aov: prev.orders > 0 ? Math.round(prev.revenue / prev.orders) : 0,
      }
    })
  }

  type WeekBucket = { revenue: number; orders: number; prev_revenue: number; prev_orders: number }
  const buckets = new Map<string, WeekBucket>()

  for (const [day, b] of currentByDay) {
    const key = getBucketKey(day)
    const existing = buckets.get(key) ?? { revenue: 0, orders: 0, prev_revenue: 0, prev_orders: 0 }
    existing.revenue += b.revenue
    existing.orders += b.orders
    buckets.set(key, existing)
  }

  for (const [day, b] of prevByDay) {
    const key = getBucketKey(day)
    const existing = buckets.get(key) ?? { revenue: 0, orders: 0, prev_revenue: 0, prev_orders: 0 }
    existing.prev_revenue += b.revenue
    existing.prev_orders += b.orders
    buckets.set(key, existing)
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      revenue: b.revenue,
      orders: b.orders,
      aov: b.orders > 0 ? Math.round(b.revenue / b.orders) : 0,
      prev_revenue: b.prev_revenue,
      prev_orders: b.prev_orders,
      prev_aov: b.prev_orders > 0 ? Math.round(b.prev_revenue / b.prev_orders) : 0,
    }))
}

export async function getProductPerformance(
  supabase: SupabaseClient,
  { dateFrom, dateTo }: DateRange,
  sortBy: string = 'revenue',
  limit = 50,
): Promise<ProductPerformance[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('items')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo + 'T23:59:59.999Z')
    .in('status', ['pending', 'confirmed', 'shipped', 'delivered'])

  if (error || !orders) return []

  type OrderItem = { product_id?: string; name?: string; quantity?: number; unit_price?: number; subtotal?: number }
  type Acc = { product_id: string; product_name: string; units: number; revenue: number }
  const map = new Map<string, Acc>()

  for (const order of orders) {
    for (const item of ((order.items ?? []) as OrderItem[])) {
      if (!item.product_id) continue
      const existing = map.get(item.product_id) ?? { product_id: item.product_id, product_name: item.name ?? '', units: 0, revenue: 0 }
      existing.units += item.quantity ?? 0
      existing.revenue += item.subtotal ?? 0
      map.set(item.product_id, existing)
    }
  }

  const productIds = Array.from(map.keys())
  if (productIds.length === 0) return []

  const { data: products } = await supabase
    .from('products')
    .select('id, category, views_count, purchases_count, cost_estimate')
    .in('id', productIds)

  const productMeta = new Map((products ?? []).map((p) => [p.id, p]))

  const results: ProductPerformance[] = Array.from(map.values()).map((p) => {
    const meta = productMeta.get(p.product_id)
    const views = meta?.views_count ?? 0
    const purchases = meta?.purchases_count ?? 0
    const costPerUnit = meta?.cost_estimate ?? 0
    const cogs = costPerUnit * p.units
    const margin_pct = p.revenue > 0 ? ((p.revenue - cogs) / p.revenue) * 100 : 0
    const conversion_rate = views > 0 ? (purchases / views) * 100 : 0
    const stock_turnover_days = p.units > 0 && costPerUnit > 0 ? costPerUnit / p.units : 0
    return {
      product_id: p.product_id,
      product_name: p.product_name,
      category: meta?.category ?? '',
      units_sold: p.units,
      revenue: p.revenue,
      cogs,
      margin_pct: Math.round(margin_pct * 10) / 10,
      orders_count: purchases,
      views_count: views,
      conversion_rate: Math.round(conversion_rate * 10) / 10,
      stock_turnover_days: Math.round(stock_turnover_days * 10) / 10,
    }
  })

  const sortFn = (a: ProductPerformance, b: ProductPerformance): number => {
    const field = sortBy as keyof ProductPerformance
    return ((b[field] as number) ?? 0) - ((a[field] as number) ?? 0)
  }

  return results.sort(sortFn).slice(0, limit)
}

export async function getCategoryPerformance(
  supabase: SupabaseClient,
  { dateFrom, dateTo }: DateRange,
): Promise<CategoryPerformance[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, items')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo + 'T23:59:59.999Z')
    .in('status', ['pending', 'confirmed', 'shipped', 'delivered'])

  if (error || !orders) return []

  type OrderItem = { product_id?: string; quantity?: number; subtotal?: number }

  const productIds = new Set<string>()
  for (const order of orders) {
    for (const item of ((order.items ?? []) as OrderItem[])) {
      if (item.product_id) productIds.add(item.product_id)
    }
  }

  if (productIds.size === 0) return []

  const { data: products } = await supabase
    .from('products')
    .select('id, category, cost_estimate')
    .in('id', Array.from(productIds))

  const productMeta = new Map((products ?? []).map((p) => [p.id, { category: p.category, cost: p.cost_estimate ?? 0 }]))

  type Acc = { revenue: number; units: number; cogs: number; orders: Set<string>; products: Set<string> }
  const cats = new Map<string, Acc>()

  for (const order of orders) {
    for (const item of ((order.items ?? []) as OrderItem[])) {
      if (!item.product_id) continue
      const meta = productMeta.get(item.product_id)
      const cat = meta?.category ?? 'Sin categoría'
      const existing = cats.get(cat) ?? { revenue: 0, units: 0, cogs: 0, orders: new Set(), products: new Set() }
      existing.revenue += item.subtotal ?? 0
      existing.units += item.quantity ?? 0
      existing.cogs += (meta?.cost ?? 0) * (item.quantity ?? 0)
      existing.orders.add(order.id)
      existing.products.add(item.product_id)
      cats.set(cat, existing)
    }
  }

  return Array.from(cats.entries()).map(([cat, acc]) => ({
    category: cat,
    revenue: acc.revenue,
    units_sold: acc.units,
    orders_count: acc.orders.size,
    margin_pct: acc.revenue > 0 ? Math.round(((acc.revenue - acc.cogs) / acc.revenue) * 1000) / 10 : 0,
    product_count: acc.products.size,
  })).sort((a, b) => b.revenue - a.revenue)
}

export async function getCustomerCohorts(
  supabase: SupabaseClient,
  { dateFrom, dateTo }: DateRange,
): Promise<CohortRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('customer_phone, paid_at')
    .gte('paid_at', dateFrom)
    .lte('paid_at', dateTo + 'T23:59:59.999Z')
    .eq('payment_status', 'paid')
    .not('paid_at', 'is', null)

  if (error || !data) return []

  const firstOrderByCustomer = new Map<string, string>()
  const allOrders = data as { customer_phone: string; paid_at: string }[]

  const { data: allOrdersData } = await supabase
    .from('orders')
    .select('customer_phone, paid_at')
    .eq('payment_status', 'paid')
    .not('paid_at', 'is', null)

  for (const o of allOrdersData ?? []) {
    const existing = firstOrderByCustomer.get(o.customer_phone)
    if (!existing || o.paid_at < existing) {
      firstOrderByCustomer.set(o.customer_phone, o.paid_at)
    }
  }

  const cohortMonths = new Map<string, Set<string>>()
  for (const [phone, firstOrder] of firstOrderByCustomer.entries()) {
    const month = firstOrder.slice(0, 7) + '-01'
    const existing = cohortMonths.get(month) ?? new Set()
    existing.add(phone)
    cohortMonths.set(month, existing)
  }

  const ordersByCustomer = new Map<string, string[]>()
  for (const o of allOrdersData ?? []) {
    const existing = ordersByCustomer.get(o.customer_phone) ?? []
    existing.push(o.paid_at)
    ordersByCustomer.set(o.customer_phone, existing)
  }

  const rows: CohortRow[] = []
  for (const [cohortMonth, customers] of cohortMonths.entries()) {
    if (customers.size === 0) continue
    const cohortStart = new Date(cohortMonth)
    const retention: Record<number, number> = { 0: 100 }

    for (let m = 1; m <= 12; m++) {
      const targetMonth = new Date(cohortStart)
      targetMonth.setMonth(targetMonth.getMonth() + m)
      const targetYear = targetMonth.getFullYear()
      const targetM = targetMonth.getMonth()

      let active = 0
      for (const phone of customers) {
        const orders = ordersByCustomer.get(phone) ?? []
        const hasOrder = orders.some((d) => {
          const od = new Date(d)
          return od.getFullYear() === targetYear && od.getMonth() === targetM
        })
        if (hasOrder) active++
      }
      retention[m] = Math.round((active / customers.size) * 100)
    }

    rows.push({ cohort_month: cohortMonth, cohort_size: customers.size, retention })
  }

  return rows.sort((a, b) => a.cohort_month.localeCompare(b.cohort_month)).slice(-12)
}

export async function getCustomerSegmentation(
  supabase: SupabaseClient,
): Promise<CustomerSegment[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, lifetime_value_cents, total_orders, last_order_at, first_order_at')
    .eq('is_active', true)

  if (error || !data) return []

  const now = new Date()
  const segCounts = new Map<string, { count: number; ltv_sum: number; revenue_sum: number }>()

  for (const c of data) {
    const recency = c.last_order_at
      ? Math.floor((now.getTime() - new Date(c.last_order_at).getTime()) / 86400000)
      : 999
    const segment = calculateRFMScore(recency, c.total_orders ?? 0, c.lifetime_value_cents ?? 0)
    const existing = segCounts.get(segment) ?? { count: 0, ltv_sum: 0, revenue_sum: 0 }
    existing.count++
    existing.ltv_sum += c.lifetime_value_cents ?? 0
    existing.revenue_sum += c.lifetime_value_cents ?? 0
    segCounts.set(segment, existing)
  }

  return Array.from(segCounts.entries()).map(([segment, acc]) => ({
    segment,
    count: acc.count,
    avg_ltv: acc.count > 0 ? Math.round(acc.ltv_sum / acc.count) : 0,
    total_revenue: acc.revenue_sum,
  }))
}

export async function getCustomerLTV(
  supabase: SupabaseClient,
): Promise<LTVData> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, phone, total_spent_cents, orders_count, last_order_at')
    .eq('is_active', true)
    .order('total_spent_cents', { ascending: false })
    .limit(500)

  if (error || !data) {
    return { buckets: [], top_customers: [], avg_ltv: 0, median_ltv: 0 }
  }

  const values = data.map((c) => c.total_spent_cents ?? 0)
  const avg_ltv = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0
  const sorted = [...values].sort((a, b) => a - b)
  const median_ltv = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0

  const bucketDefs = [
    { label: '$0', min: 0, max: 10000 },
    { label: '$100-$500', min: 10000, max: 50000 },
    { label: '$500-$1k', min: 50000, max: 100000 },
    { label: '$1k-$5k', min: 100000, max: 500000 },
    { label: '$5k+', min: 500000, max: Infinity },
  ]

  const buckets = bucketDefs.map((b) => ({
    range: b.label,
    count: values.filter((v) => v >= b.min && v < b.max).length,
  }))

  const top_customers = data.slice(0, 50).map((c) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.phone,
    phone: c.phone,
    ltv: c.total_spent_cents ?? 0,
    orders: c.orders_count ?? 0,
    last_order_at: c.last_order_at,
  }))

  return { buckets, top_customers, avg_ltv, median_ltv }
}

export async function getAffiliateROI(
  supabase: SupabaseClient,
  { dateFrom, dateTo }: DateRange,
): Promise<AffiliateROI[]> {
  // affiliate_attributions.affiliate_id → auth.users, not affiliate_profiles,
  // so we can only embed orders (direct FK). Profiles fetched separately.
  const { data: attributions, error } = await supabase
    .from('affiliate_attributions')
    .select('affiliate_id, order_id, orders!inner(total, status)')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo + 'T23:59:59.999Z')

  if (error || !attributions) return []

  const affiliateIds = [...new Set(attributions.map((a) => a.affiliate_id))]

  // Fetch names — affiliate_profiles has first_name + last_name (no full_name column)
  const { data: profiles } = affiliateIds.length > 0
    ? await supabase
        .from('affiliate_profiles')
        .select('id, first_name, last_name, handle')
        .in('id', affiliateIds)
    : { data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; handle: string }> }

  const namesMap = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      [p.first_name, p.last_name].filter(Boolean).join(' ') || p.handle,
    ])
  )

  // Clicks are tracked on referral_links.clicks_count (total per affiliate)
  const { data: links } = affiliateIds.length > 0
    ? await supabase
        .from('referral_links')
        .select('affiliate_id, clicks_count')
        .in('affiliate_id', affiliateIds)
    : { data: [] as Array<{ affiliate_id: string; clicks_count: number }> }

  const clicksMap = new Map<string, number>()
  for (const link of links ?? []) {
    clicksMap.set(link.affiliate_id, (clicksMap.get(link.affiliate_id) ?? 0) + (link.clicks_count ?? 0))
  }

  // commission_payments has no status column — all rows represent paid commissions
  const { data: commissions } = await supabase
    .from('commission_payments')
    .select('affiliate_id, amount_cents')
    .gte('paid_at', dateFrom)
    .lte('paid_at', dateTo + 'T23:59:59.999Z')

  const commissionsMap = new Map<string, number>()
  for (const c of commissions ?? []) {
    commissionsMap.set(c.affiliate_id, (commissionsMap.get(c.affiliate_id) ?? 0) + (c.amount_cents ?? 0))
  }

  type Acc = { orders: Set<string>; revenue: number }
  const map = new Map<string, Acc>()

  for (const attr of attributions) {
    const id = attr.affiliate_id
    const orderRow = (attr.orders as unknown) as { status: string; total: number } | null
    const existing = map.get(id) ?? { orders: new Set<string>(), revenue: 0 }
    if (attr.order_id && orderRow?.status !== 'cancelled' && orderRow?.status !== 'failed') {
      existing.orders.add(attr.order_id)
      existing.revenue += orderRow?.total ?? 0
    }
    map.set(id, existing)
  }

  return Array.from(map.entries()).map(([id, acc]) => {
    const commissions_paid = commissionsMap.get(id) ?? 0
    const clicks = clicksMap.get(id) ?? 0
    const roi = commissions_paid > 0 ? (acc.revenue / commissions_paid) * 100 - 100 : 0
    const conversion_rate = clicks > 0 ? (acc.orders.size / clicks) * 100 : 0
    return {
      affiliate_id: id,
      affiliate_name: namesMap.get(id) ?? id,
      orders: acc.orders.size,
      revenue: acc.revenue,
      commissions_paid,
      roi: Math.round(roi * 10) / 10,
      conversion_rate: Math.round(conversion_rate * 10) / 10,
      clicks,
    }
  }).sort((a, b) => b.revenue - a.revenue)
}

export async function getCouponPerformance(
  supabase: SupabaseClient,
  { dateFrom, dateTo }: DateRange,
): Promise<CouponPerf[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('coupon_code, coupon_discount, total, status')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo + 'T23:59:59.999Z')
    .not('coupon_code', 'is', null)

  if (error || !orders) return []

  const { data: coupons } = await supabase
    .from('coupons')
    .select('id, code, max_uses, used_count')

  const couponMeta = new Map((coupons ?? []).map((c) => [c.code, c]))

  type Acc = { uses: number; discount: number; revenue: number }
  const map = new Map<string, Acc>()

  for (const o of orders) {
    if (!o.coupon_code) continue
    const existing = map.get(o.coupon_code) ?? { uses: 0, discount: 0, revenue: 0 }
    existing.uses++
    existing.discount += o.coupon_discount ?? 0
    if (o.status !== 'cancelled') existing.revenue += o.total ?? 0
    map.set(o.coupon_code, existing)
  }

  return Array.from(map.entries()).map(([code, acc]) => {
    const meta = couponMeta.get(code)
    const roi = acc.discount > 0 ? ((acc.revenue - acc.discount) / acc.discount) * 100 : 0
    const redemption_rate = meta?.max_uses ? (acc.uses / meta.max_uses) * 100 : 0
    return {
      coupon_id: meta?.id ?? code,
      code,
      uses: acc.uses,
      discount_total: acc.discount,
      revenue_attributed: acc.revenue,
      roi: Math.round(roi * 10) / 10,
      redemption_rate: Math.round(redemption_rate * 10) / 10,
      max_uses: meta?.max_uses ?? null,
    }
  }).sort((a, b) => b.revenue_attributed - a.revenue_attributed)
}

export async function getInventoryHealth(
  supabase: SupabaseClient,
): Promise<InventoryHealth[]> {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, category, stock_quantity, cost_estimate')
    .eq('is_active', true)

  if (error || !products) return []

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentOrders } = await supabase
    .from('orders')
    .select('items')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .in('status', ['pending', 'confirmed', 'shipped', 'delivered'])

  type OrderItem = { product_id?: string; quantity?: number }
  const salesMap = new Map<string, number>()
  for (const order of recentOrders ?? []) {
    for (const item of ((order.items ?? []) as OrderItem[])) {
      if (!item.product_id) continue
      salesMap.set(item.product_id, (salesMap.get(item.product_id) ?? 0) + (item.quantity ?? 0))
    }
  }

  return products.map((p) => {
    const units_sold_30d = salesMap.get(p.id) ?? 0
    const daily_velocity = units_sold_30d / 30
    const stock = p.stock_quantity ?? 0
    const days_of_inventory = daily_velocity > 0 ? Math.round(stock / daily_velocity) : Infinity

    let status: InventoryHealth['status'] = 'ok'
    if (stock === 0) status = 'stockout'
    else if (units_sold_30d === 0) status = 'no_sales'
    else if (days_of_inventory < 7) status = 'low'
    else if (days_of_inventory > 180) status = 'overstock'

    return {
      product_id: p.id,
      product_name: p.name,
      category: p.category ?? '',
      stock_quantity: stock,
      units_sold_30d,
      days_of_inventory: isFinite(days_of_inventory) ? days_of_inventory : 9999,
      velocity: Math.round(daily_velocity * 100) / 100,
      cost_estimate_cents: p.cost_estimate ?? 0,
      status,
    }
  }).sort((a, b) => {
    const order = { stockout: 0, low: 1, overstock: 2, no_sales: 3, ok: 4 }
    return order[a.status] - order[b.status]
  })
}

export async function getOrderFunnel(
  supabase: SupabaseClient,
  { dateFrom, dateTo }: DateRange,
): Promise<FunnelStage[]> {
  const stages = ['pending_payment', 'paid', 'preparing', 'shipped', 'delivered']

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, created_at, paid_at, updated_at')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo + 'T23:59:59.999Z')

  if (error || !orders) return []

  const countByStatus = new Map<string, number>()
  for (const o of orders) {
    countByStatus.set(o.status, (countByStatus.get(o.status) ?? 0) + 1)
  }

  const total = orders.length
  const result: FunnelStage[] = []

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const count = countByStatus.get(stage) ?? 0
    const prevCount = i > 0 ? (countByStatus.get(stages[i - 1]) ?? 0) : total
    const drop_off_rate = prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 1000) / 10 : null

    result.push({
      stage,
      count,
      avg_hours_to_next: null,
      drop_off_rate,
    })
  }

  return result
}

export async function getPaymentMethodBreakdown(
  supabase: SupabaseClient,
  { dateFrom, dateTo }: DateRange,
): Promise<PaymentBreakdown[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('payment_method, payment_status, total')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo + 'T23:59:59.999Z')

  if (error || !data) return []

  type Acc = { total_count: number; paid_count: number; revenue: number }
  const map = new Map<string, Acc>()

  for (const o of data) {
    const method = o.payment_method ?? 'unknown'
    const existing = map.get(method) ?? { total_count: 0, paid_count: 0, revenue: 0 }
    existing.total_count++
    if (o.payment_status === 'paid') {
      existing.paid_count++
      existing.revenue += o.total ?? 0
    }
    map.set(method, existing)
  }

  return Array.from(map.entries()).map(([method, acc]) => ({
    method,
    count: acc.total_count,
    total: acc.revenue,
    avg_ticket: acc.paid_count > 0 ? Math.round(acc.revenue / acc.paid_count) : 0,
    success_rate: acc.total_count > 0 ? Math.round((acc.paid_count / acc.total_count) * 1000) / 10 : 0,
  })).sort((a, b) => b.total - a.total)
}

export async function getGeographicDistribution(
  supabase: SupabaseClient,
  { dateFrom, dateTo }: DateRange,
): Promise<GeographicPoint[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('delivery_address, total, status')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo + 'T23:59:59.999Z')
    .neq('status', 'cancelled')

  if (error || !data) return []

  type Acc = { orders: number; revenue: number; city: string | null; state: string | null }
  const map = new Map<string, Acc>()

  for (const o of data) {
    const addr = o.delivery_address as Record<string, string> | null
    const postal = addr?.postal_code ?? addr?.zip ?? 'N/A'
    const city = addr?.city ?? addr?.ciudad ?? null
    const state = addr?.state ?? addr?.estado ?? null

    const existing = map.get(postal) ?? { orders: 0, revenue: 0, city, state }
    existing.orders++
    existing.revenue += o.total ?? 0
    map.set(postal, existing)
  }

  return Array.from(map.entries()).map(([postal_code, acc]) => ({
    postal_code,
    city: acc.city,
    state: acc.state,
    orders: acc.orders,
    revenue: acc.revenue,
  })).sort((a, b) => b.revenue - a.revenue).slice(0, 100)
}

export async function getRefundsAnalysis(
  supabase: SupabaseClient,
  { dateFrom, dateTo }: DateRange,
): Promise<RefundsAnalysis> {
  const { data: refunds, error } = await supabase
    .from('order_refunds')
    .select('order_id, amount_cents, reason, refunded_at, orders!inner(total, items)')
    .gte('refunded_at', dateFrom)
    .lte('refunded_at', dateTo + 'T23:59:59.999Z')

  if (error || !refunds) {
    return { total_refunds: 0, total_amount: 0, refund_rate: 0, by_reason: [], top_refunded_products: [] }
  }

  const { data: totalOrders } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo + 'T23:59:59.999Z')

  const total_amount = refunds.reduce((sum, r) => sum + (r.amount_cents ?? 0), 0)
  const total_orders_count = (totalOrders as unknown as { count: number } | null)?.count ?? 1
  const refund_rate = Math.round((refunds.length / total_orders_count) * 1000) / 10

  const reasonMap = new Map<string, { count: number; amount: number }>()
  for (const r of refunds) {
    const reason = r.reason ?? 'Sin motivo'
    const existing = reasonMap.get(reason) ?? { count: 0, amount: 0 }
    existing.count++
    existing.amount += r.amount_cents ?? 0
    reasonMap.set(reason, existing)
  }

  const productMap = new Map<string, { count: number; amount: number }>()
  for (const r of refunds) {
    const orderData = (r.orders as unknown) as { items: { name: string }[] } | null
    const items = orderData?.items ?? []
    for (const item of items) {
      const existing = productMap.get(item.name) ?? { count: 0, amount: 0 }
      existing.count++
      existing.amount += r.amount_cents ?? 0
      productMap.set(item.name, existing)
    }
  }

  return {
    total_refunds: refunds.length,
    total_amount,
    refund_rate,
    by_reason: Array.from(reasonMap.entries())
      .map(([reason, acc]) => ({ reason, ...acc }))
      .sort((a, b) => b.count - a.count),
    top_refunded_products: Array.from(productMap.entries())
      .map(([product_name, acc]) => ({ product_name, ...acc }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  }
}

export async function getRevenueForecast(
  supabase: SupabaseClient,
  historicalDays = 90,
  forecastDays = 30,
) {
  const from = new Date()
  from.setDate(from.getDate() - historicalDays)

  const { data, error } = await supabase
    .from('mv_daily_revenue')
    .select('date, gross_revenue')
    .gte('date', from.toISOString().slice(0, 10))
    .order('date', { ascending: true })

  if (error || !data) return { historical: [], forecast: [] }

  const historical = data.map((r) => ({ date: r.date, revenue: r.gross_revenue ?? 0 }))
  const forecast = forecastRevenue(historical, forecastDays)

  return { historical, forecast }
}

export async function getDeliveryPerformance(
  supabase: SupabaseClient,
  { dateFrom, dateTo }: DateRange,
): Promise<DeliveryPerf> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, created_at, paid_at, updated_at, status, delivery_address')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo + 'T23:59:59.999Z')
    .eq('status', 'delivered')

  if (error || !orders || orders.length === 0) {
    return { avg_hours: 0, on_time_rate: 0, by_zone: [], stage_times: [] }
  }

  const times: number[] = []
  for (const o of orders) {
    const start = new Date(o.created_at).getTime()
    const end = new Date(o.updated_at).getTime()
    const hours = (end - start) / 3600000
    if (hours > 0 && hours < 720) times.push(hours)
  }

  const avg_hours = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
  const on_time = times.filter((h) => h <= 48).length
  const on_time_rate = times.length > 0 ? Math.round((on_time / times.length) * 1000) / 10 : 0

  return {
    avg_hours,
    on_time_rate,
    by_zone: [],
    stage_times: [],
  }
}

export async function getDashboardSummary(
  supabase: SupabaseClient,
  { dateFrom, dateTo }: DateRange,
): Promise<DashboardSummary> {
  const rangeMs = new Date(dateTo).getTime() - new Date(dateFrom).getTime()
  const prevFrom = new Date(new Date(dateFrom).getTime() - rangeMs - 86400000).toISOString().slice(0, 10)
  const prevTo = new Date(new Date(dateFrom).getTime() - 86400000).toISOString().slice(0, 10)

  const [currentRevData, prevRevData, pendingData, refundData, newCustData] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total')
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59.999Z')
      .in('status', ['pending', 'confirmed', 'shipped', 'delivered']),
    supabase
      .from('orders')
      .select('id, total')
      .gte('created_at', prevFrom)
      .lte('created_at', prevTo + 'T23:59:59.999Z')
      .in('status', ['pending', 'confirmed', 'shipped', 'delivered']),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('order_refunds')
      .select('amount_cents')
      .gte('refunded_at', dateFrom)
      .lte('refunded_at', dateTo + 'T23:59:59.999Z'),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .gte('first_order_at', dateFrom)
      .lte('first_order_at', dateTo + 'T23:59:59.999Z'),
  ])

  const current = currentRevData.data ?? []
  const prev = prevRevData.data ?? []

  const revenue = current.reduce((s, r) => s + (r.total ?? 0), 0)
  const orders = current.length
  const aov = orders > 0 ? Math.round(revenue / orders) : 0
  const gross_margin = 0

  const prev_revenue = prev.reduce((s, r) => s + (r.total ?? 0), 0)
  const prev_orders = prev.length
  const prev_aov = prev_orders > 0 ? Math.round(prev_revenue / prev_orders) : 0

  const refunds = refundData.data ?? []
  const total_refund_amount = refunds.reduce((s, r) => s + (r.amount_cents ?? 0), 0)
  const refund_rate = revenue > 0 ? Math.round((total_refund_amount / revenue) * 1000) / 10 : 0

  const new_customers = (newCustData as unknown as { count: number } | null)?.count ?? 0
  const pending_orders = (pendingData as unknown as { count: number } | null)?.count ?? 0

  const alerts: DashboardSummary['alerts'] = []

  const { data: lowStock } = await supabase
    .from('products')
    .select('id, name, stock_quantity')
    .eq('is_active', true)
    .lte('stock_quantity', 5)
    .gt('stock_quantity', 0)
    .limit(5)

  for (const p of lowStock ?? []) {
    alerts.push({
      type: 'low_stock',
      severity: 'high',
      message: `Stock bajo: ${p.name} (${p.stock_quantity} unidades)`,
      link: `/admin/inventario`,
    })
  }

  const { data: expiringSoon } = await supabase
    .from('coupons')
    .select('id, code, used_count, expires_at')
    .eq('is_active', true)
    .gte('used_count', 5)
    .lte('expires_at', new Date(Date.now() + 3 * 86400000).toISOString())
    .gte('expires_at', new Date().toISOString())

  for (const c of expiringSoon ?? []) {
    alerts.push({
      type: 'coupon_expiring',
      severity: 'medium',
      message: `Cupón ${c.code} expira pronto (${c.used_count} usos)`,
      link: `/admin/cupones`,
    })
  }

  return {
    revenue,
    prev_revenue,
    orders,
    prev_orders,
    aov,
    prev_aov,
    gross_margin,
    new_customers,
    pending_orders,
    refund_rate,
    alerts,
  }
}
