import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id } = await params
  const supabase = createServiceClient()

  const { data: attributions, error } = await supabase
    .from('affiliate_attributions')
    .select(`
      id, order_id, commission_pct, commission_amount_cents, payout_status, created_at,
      orders!inner(short_id, total, customer_name, created_at)
    `)
    .eq('affiliate_id', id)
    .in('payout_status', ['pending', 'approved'])
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Error al obtener órdenes pendientes' }, { status: 500 })
  }

  const rows = (attributions ?? []).map((a) => {
    const order = a.orders as unknown as Record<string, unknown> | null
    return {
      attribution_id: a.id,
      order_id: a.order_id,
      short_id: order?.short_id ?? '',
      customer_name: order?.customer_name ?? null,
      order_total: order?.total ?? 0,
      order_date: order?.created_at ?? a.created_at,
      commission_pct: a.commission_pct,
      commission_amount_cents: a.commission_amount_cents,
    }
  })

  return NextResponse.json({ data: rows })
}
