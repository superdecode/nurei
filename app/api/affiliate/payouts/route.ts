import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAffiliate } from '@/lib/server/require-affiliate'

export async function GET() {
  const guard = await requireAffiliate()
  if (guard.error) return guard.error

  const affiliateId = guard.userId!
  const supabase = createServiceClient()

  try {
    const { data: paymentsData, error } = await supabase
      .from('commission_payments')
      .select('id, amount_cents, period_from, period_to, attribution_ids, notes, paid_at', { count: 'exact' })
      .eq('affiliate_id', affiliateId)
      .order('paid_at', { ascending: false })

    if (error) {
      console.error('[payouts API error]', error)
      return NextResponse.json({ error: 'Error al obtener pagos' }, { status: 500 })
    }

    const payments = paymentsData ?? []

    const enriched = await Promise.all(
      payments.map(async (p) => {
        let orders: Array<{ short_id: string; total: number; customer_name: string | null }> = []
        if (p.attribution_ids && p.attribution_ids.length > 0) {
          try {
            const { data: attrs } = await supabase
              .from('affiliate_attributions')
              .select('order_id, orders(short_id, total, customer_name)')
              .in('id', p.attribution_ids)
            if (attrs) {
              orders = attrs.map((a) => {
                const orderData = a.orders as unknown as Record<string, unknown> | null
                if (!orderData) return { short_id: '', total: 0, customer_name: null }
                const shortId = orderData.short_id as string | undefined
                const total = orderData.total as number | undefined
                const customerName = orderData.customer_name as string | null | undefined
                return { short_id: shortId ?? '', total: total ?? 0, customer_name: customerName ?? null }
              })
            }
          } catch (err) {
            console.error('[payouts API] Error fetching orders for payment:', p.id, err)
          }
        }
        return { ...p, orders }
      })
    )

    return NextResponse.json({ data: enriched })
  } catch (err) {
    console.error('[payouts API] Unexpected error:', err)
    return NextResponse.json({ error: 'Error al obtener pagos' }, { status: 500 })
  }
}
