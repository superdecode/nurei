import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAffiliate } from '@/lib/server/require-affiliate'

export async function GET(request: NextRequest) {
  const guard = await requireAffiliate()
  if (guard.error) return guard.error

  const affiliateId = guard.userId!
  const sp = request.nextUrl.searchParams
  const from = sp.get('from')
  const to = sp.get('to')

  const supabase = createServiceClient()

  const [profileRes, linkRes, attributionsRes, totalOrdersRes] = await Promise.all([
    supabase
      .from('affiliate_profiles')
      .select('total_earned_cents, pending_payout_cents')
      .eq('id', affiliateId)
      .single(),
    supabase
      .from('referral_links')
      .select('id, clicks_count')
      .eq('affiliate_id', affiliateId)
      .maybeSingle(),
    (() => {
      // Only fetch attributions whose orders have been confirmed by admin
      // (payout_status 'approved' or 'paid' — 'pending' means order not yet confirmed)
      let q = supabase
        .from('affiliate_attributions')
        .select('id, commission_amount_cents, created_at, order_id, attribution_type, payout_status')
        .eq('affiliate_id', affiliateId)
        .in('payout_status', ['approved', 'paid'])
        .order('created_at', { ascending: false })
      if (from) q = q.gte('created_at', `${from}T00:00:00.000Z`)
      if (to) q = q.lte('created_at', `${to}T23:59:59.999Z`)
      return q
    })(),
    // Count ALL attributions regardless of payout_status for the order counter
    (() => {
      let q = supabase
        .from('affiliate_attributions')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_id', affiliateId)
      if (from) q = q.gte('created_at', `${from}T00:00:00.000Z`)
      if (to) q = q.lte('created_at', `${to}T23:59:59.999Z`)
      return q
    })(),
  ])

  const profile = profileRes.data
  const totalClicks = linkRes.data?.clicks_count ?? 0
  const attributions = attributionsRes.data ?? []

  // Unique clicks from referral_clicks table
  let uniqueClicks = 0
  if (linkRes.data?.id) {
    let cq = supabase
      .from('referral_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('referral_link_id', linkRes.data.id)
    if (from) cq = cq.gte('clicked_at', `${from}T00:00:00.000Z`)
    if (to) cq = cq.lte('clicked_at', `${to}T23:59:59.999Z`)
    const { count } = await cq
    uniqueClicks = count ?? 0
  }

  const totalOrders = totalOrdersRes.count ?? attributions.length
  const conversionRate = uniqueClicks > 0 ? Math.round((totalOrders / uniqueClicks) * 100 * 10) / 10 : 0
  const totalCommission = attributions.reduce((s, a) => s + (a.commission_amount_cents ?? 0), 0)
  // Only 'approved' attributions are ready for payout (order confirmed by admin)
  const pendingCommission = attributions
    .filter((a) => a.payout_status === 'approved')
    .reduce((s, a) => s + (a.commission_amount_cents ?? 0), 0)

  // Chart: 8 weekly buckets aligned to the requested period (falls back to last 8 weeks)
  const chartEnd = to ? new Date(`${to}T23:59:59.999Z`) : new Date()
  const chartStart = from
    ? new Date(`${from}T00:00:00.000Z`)
    : (() => { const d = new Date(chartEnd); d.setDate(d.getDate() - 56); return d })()
  const spanMs = chartEnd.getTime() - chartStart.getTime()
  const bucketMs = spanMs / 8

  const chartData = Array.from({ length: 8 }, (_, i) => {
    const bucketStart = new Date(chartStart.getTime() + bucketMs * i)
    const bucketEnd = new Date(chartStart.getTime() + bucketMs * (i + 1))
    const bucket = attributions.filter((a) => {
      const d = new Date(a.created_at)
      return d >= bucketStart && d < bucketEnd
    })
    return {
      label: bucketStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
      sales: bucket.reduce((s, a) => s + (a.commission_amount_cents ?? 0), 0),
      orders: bucket.length,
    }
  })

  /** Shape expected by `/affiliate/overview` (Recharts BarChart uses week + amount_cents). */
  const weekly_sales = chartData.map((c) => ({
    week: c.label,
    amount_cents: c.sales,
    orders: c.orders,
  }))

  return NextResponse.json({
    data: {
      total_earned_cents: profile?.total_earned_cents ?? 0,
      pending_payout_cents: profile?.pending_payout_cents ?? 0,
      total_commission_period: totalCommission,
      pending_commission_period: pendingCommission,
      total_orders: totalOrders,
      total_clicks: totalClicks,
      unique_clicks: uniqueClicks,
      conversion_rate: conversionRate,
      chartData,
      weekly_sales,
      top_products: [] as { product_name: string; units: number }[],
    },
  })
}
