import { NextRequest, NextResponse } from 'next/server'
import { updateStatusSchema } from '@/lib/validations/order'
import { VALID_STATUS_TRANSITIONS } from '@/lib/utils/constants'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Verify admin token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateStatusSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { status: newStatus, notes } = parsed.data

    // TODO: Replace with Supabase query + update
    // const supabase = createServiceClient()
    // const { data: order } = await supabase.from('orders').select('status').eq('id', id).single()
    //
    // Validate transition
    // const currentStatus = order.status
    // const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || []
    // if (!validTransitions.includes(newStatus)) {
    //   return NextResponse.json({ error: `Transición inválida: ${currentStatus} → ${newStatus}` }, { status: 400 })
    // }
    //
    // const updateData: Record<string, unknown> = { status: newStatus }
    // if (newStatus === 'confirmed') updateData.confirmed_at = new Date().toISOString()
    // if (newStatus === 'picking') updateData.picked_at = new Date().toISOString()
    // if (newStatus === 'in_transit') updateData.dispatched_at = new Date().toISOString()
    // if (newStatus === 'delivered') updateData.delivered_at = new Date().toISOString()
    // if (newStatus === 'cancelled') updateData.cancelled_at = new Date().toISOString()
    // if (notes) updateData.operator_notes = notes
    //
    // const { data: updated } = await supabase.from('orders').update(updateData).eq('id', id).select().single()
    // await supabase.from('order_updates').insert({ order_id: id, status: newStatus, updated_by: 'operator' })

    return NextResponse.json({
      data: {
        order_id: id,
        status: newStatus,
        success: true,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
