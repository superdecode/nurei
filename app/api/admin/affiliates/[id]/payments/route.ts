import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id } = await params
  const sp = req.nextUrl.searchParams
  const page = parseInt(sp.get('page') ?? '1', 10)
  const limit = parseInt(sp.get('limit') ?? '20', 10)
  const offset = (page - 1) * limit

  const supabase = createServiceClient()

  const { data: paymentsData, error, count } = await supabase
    .from('commission_payments')
    .select('id, amount_cents, payment_type, reference_number, notes, paid_at, attribution_ids, period_from, period_to')
    .eq('affiliate_id', id)
    .order('paid_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: 'Error al obtener historial de pagos' }, { status: 500 })
  }

  const total = count ?? 0
  const payments = paymentsData ?? []

  const enriched = await Promise.all(
    payments.map(async (p) => {
      let orders: Array<{ short_id: string; total: number; customer_name: string | null }> = []
      if (p.attribution_ids && p.attribution_ids.length > 0) {
        const { data: attrs } = await supabase
          .from('affiliate_attributions')
          .select('order_id, orders(short_id, total, customer_name)')
          .in('id', p.attribution_ids)
        if (attrs) {
          orders = attrs.map((a) => {
            const orderData = a.orders as Record<string, unknown> | null
            if (!orderData) return { short_id: '', total: 0, customer_name: null }
            const shortId = orderData.short_id as string | undefined
            const total = orderData.total as number | undefined
            const customerName = orderData.customer_name as string | null | undefined
            return { short_id: shortId ?? '', total: total ?? 0, customer_name: customerName ?? null }
          })
        }
      }
      return { ...p, orders }
    })
  )

  return NextResponse.json({
    data: enriched,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  })
}