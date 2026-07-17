import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminPermission } from '@/lib/server/require-admin-permission'
import { processRefund } from '@/lib/server/process-refund'
import { getStripeServer } from '@/lib/stripe/server'
import { getOrderDetail } from '@/lib/supabase/queries/adminOrders'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminPermission('reembolsos', 'escritura')
  if (guard.error) return guard.error

  try {
    const { id } = await params
    const body = (await req.json()) as {
      amountCents?: number
      reason?: string
      referenceNote?: string
    }

    if (!body.amountCents || !body.reason) {
      return NextResponse.json({ error: 'amountCents y reason son requeridos' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const result = await processRefund(supabase, getStripeServer(), {
      orderId: id,
      amountCents: body.amountCents,
      reason: body.reason,
      referenceNote: body.referenceNote ?? null,
      processedBy: guard.userId!,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 })
    }

    const order = await getOrderDetail(supabase, id)
    return NextResponse.json({ data: { order, refundId: result.refundId } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al procesar el reembolso'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
