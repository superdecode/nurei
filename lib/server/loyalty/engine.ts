import { createServiceClient } from '@/lib/supabase/server'
import { pointsEarnedForPurchase } from './points'

/**
 * Awards purchase points once an order is confirmed paid. Mirrors
 * claimCouponForPaidOrder's read-then-act shape (lib/server/coupons/engine.ts).
 * Idempotent against webhook retries via the partial unique index on
 * loyalty_ledger(order_id) where reason='purchase'.
 */
export async function awardPointsForPaidOrder(orderId: string): Promise<void> {
  if (!orderId) return
  const supabase = createServiceClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, user_id, subtotal, coupon_discount, points_discount, payment_status')
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    console.error('[loyalty] awardPointsForPaidOrder load order', error.message)
    return
  }
  if (!order || !order.user_id) return
  if (order.payment_status !== 'paid') return

  const chargeableCents = Math.max(
    0,
    (order.subtotal ?? 0) - (order.coupon_discount ?? 0) - (order.points_discount ?? 0)
  )
  const basePoints = pointsEarnedForPurchase(chargeableCents)
  if (basePoints <= 0) return

  const { error: rpcError } = await supabase.rpc('award_points_atomic', {
    p_user_id: order.user_id,
    p_base_delta: basePoints,
    p_reason: 'purchase',
    p_order_id: orderId,
  })

  if (rpcError) {
    console.error('[loyalty] award_points_atomic error', rpcError.message)
  }
}

/**
 * Deducts previously-redeemed points once an order is confirmed paid. Mirrors
 * claimCouponForPaidOrder exactly: the discount is displayed at checkout but
 * only realized against the user's balance at payment confirmation.
 */
export async function claimRedeemedPointsForPaidOrder(orderId: string): Promise<void> {
  if (!orderId) return
  const supabase = createServiceClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, points_redeemed, payment_status')
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    console.error('[loyalty] claimRedeemedPointsForPaidOrder load order', error.message)
    return
  }
  if (!order || !order.points_redeemed) return
  if (order.payment_status !== 'paid') return

  const { data: result, error: rpcError } = await supabase.rpc('claim_redeemed_points_atomic', {
    p_order_id: orderId,
  })

  if (rpcError) {
    console.error('[loyalty] claim_redeemed_points_atomic error', rpcError.message)
    return
  }

  if (result !== 'ok' && result !== 'already_claimed' && result !== 'nothing_to_claim' && result !== 'insufficient_balance_skipped') {
    console.warn('[loyalty] claim_redeemed_points_atomic unexpected result', { orderId, result })
  }
}
