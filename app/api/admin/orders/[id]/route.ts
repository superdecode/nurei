import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrderDetail, getAdjacentOrderIds, updateOrderStatus } from '@/lib/supabase/queries/adminOrders'
import { VALID_STATUS_TRANSITIONS } from '@/lib/utils/constants'
import { sendOrderStatusEmail } from '@/lib/email/send-order-emails'
import { executeAffiliateAttribution } from '@/lib/server/affiliate-attribution'
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

    // When admin confirms an order, assign affiliate commission.
    // 1. Mark payment as received (cash collected, OXXO confirmed, etc.)
    // 2. Create attribution using the referral link stored at order creation time.
    // 3. Approve it so it counts toward the affiliate's payout.
    if (newStatus === 'confirmed' || newStatus === 'paid') {
      void (async () => {
        try {
          // Read stored referral link and coupon from the order.
          const { data: orderSnap } = await supabase
            .from('orders')
            .select('referral_link_id, coupon_code, payment_status')
            .eq('id', id)
            .single()

          // Mark payment as received so the attribution RPC check passes.
          if (orderSnap?.payment_status !== 'paid') {
            await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', id)
          }

          // Create the attribution record (no-op if already exists — ON CONFLICT DO NOTHING).
          const result = await executeAffiliateAttribution({
            orderId: id,
            couponCode: orderSnap?.coupon_code ?? null,
            referralLinkId: orderSnap?.referral_link_id ?? null,
          })
          console.log('[attribution] admin confirm', id, result)

          // Approve so commission is ready for payout.
          const { error } = await supabase.rpc('approve_attribution_for_order', { p_order_id: id })
          if (error) console.error('[attribution] approve failed', id, error.message)
        } catch (e) {
          console.error('[attribution] admin confirm error', id, e)
        }
      })()
    }

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
