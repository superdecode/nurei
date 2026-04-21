import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrderDetail, getAdjacentOrderIds, updateOrderStatus } from '@/lib/supabase/queries/adminOrders'
import { VALID_STATUS_TRANSITIONS } from '@/lib/utils/constants'
import { sendOrderStatusEmail } from '@/lib/email/send-order-emails'
import type { OrderStatus } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    const [order, adjacent] = await Promise.all([
      getOrderDetail(supabase, id),
      getAdjacentOrderIds(supabase, id),
    ])

    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ data: { order, adjacent } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al obtener pedido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = (await req.json()) as { status?: string; note?: string }
    const newStatus = body.status as OrderStatus | undefined

    if (!newStatus) {
      return NextResponse.json({ error: 'Estatus requerido' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: current, error: fetchErr } = await supabase.from('orders').select('status').eq('id', id).single()

    if (fetchErr || !current) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    // Allow transitions from both old DB status values and new logical status values
    const currentStatus = current.status as string
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] ?? []
    // Also check legacy transitions (DB may have 'confirmed' which maps to 'paid' logically)
    const allowedLegacy = VALID_STATUS_TRANSITIONS[currentStatus] ?? []

    if (!allowed.includes(newStatus) && !allowedLegacy.includes(newStatus)) {
      // Lenient: if same db target, allow (e.g. confirmed → shipped)
      const dbTarget = newStatus === 'refunded' ? 'cancelled' :
                       ['paid','preparing','ready_to_ship'].includes(newStatus) ? 'confirmed' :
                       newStatus
      const dbAllowed = VALID_STATUS_TRANSITIONS[currentStatus] ?? []
      if (!dbAllowed.some((s) => s === newStatus || s === dbTarget)) {
        return NextResponse.json(
          { error: `Cambio no permitido: ${currentStatus} → ${newStatus}` },
          { status: 422 }
        )
      }
    }

    await updateOrderStatus(supabase, id, newStatus, body.note, 'admin')

    if (newStatus === 'preparing' || newStatus === 'ready_to_ship' || newStatus === 'shipped') {
      void sendOrderStatusEmail(id, 'preparing')
    } else if (newStatus === 'delivered') {
      void sendOrderStatusEmail(id, 'delivered')
    }

    const order = await getOrderDetail(supabase, id)
    return NextResponse.json({ data: { order } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al actualizar pedido'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
