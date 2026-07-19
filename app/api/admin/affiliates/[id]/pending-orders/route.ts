import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminPermission } from '@/lib/server/require-admin-permission'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireAdminPermission('afiliados', 'lectura')
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
      // 'pending' means the order hasn't been confirmed yet (or, historically,
      // came through a path that never approved it) — process_affiliate_payout_atomic
      // only pays 'approved' rows, so the UI needs this to keep admins from
      // selecting a row that can never actually be paid.
      payout_status: a.payout_status as 'pending' | 'approved',
    }
  })

  return NextResponse.json({ data: rows })
}
