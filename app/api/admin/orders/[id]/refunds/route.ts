import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('order_refunds')
    .select('id, amount_cents, reason, refund_method, status, notes, processed_by, refunded_at')
    .eq('order_id', id)
    .order('refunded_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Error al obtener reembolsos' }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
