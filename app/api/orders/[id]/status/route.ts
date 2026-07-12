import { NextRequest, NextResponse } from 'next/server'
import { updateStatusSchema } from '@/lib/validations/order'
import { VALID_STATUS_TRANSITIONS } from '@/lib/utils/constants'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const guard = await requireAdmin()
  if (guard.error) return guard.error

  try {
    const body = await request.json()
    const parsed = updateStatusSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { status: newStatus, notes } = parsed.data

    const supabase = createServiceClient()
    const { data: order } = await supabase
      .from('orders')
      .select('status')
      .eq('id', id)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    const validTransitions = VALID_STATUS_TRANSITIONS[order.status as keyof typeof VALID_STATUS_TRANSITIONS] ?? []
    if (!validTransitions.includes(newStatus)) {
      return NextResponse.json(
        { error: `Transición inválida: ${order.status} → ${newStatus}` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const updateData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'confirmed') updateData.confirmed_at = now
    if (newStatus === 'shipped') updateData.dispatched_at = now
    if (newStatus === 'delivered') updateData.delivered_at = now
    if (newStatus === 'cancelled') updateData.cancelled_at = now
    if (notes) updateData.operator_notes = notes

    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select('id, status')
      .single()

    if (updateError) throw updateError

    await supabase.from('order_updates').insert({
      order_id: id,
      status: newStatus,
      updated_by: `admin:${guard.userId}`,
      message: notes ?? `Estado actualizado a ${newStatus}`,
    })

    return NextResponse.json({ data: { order_id: updated.id, status: updated.status, success: true } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
