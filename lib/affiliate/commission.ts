export function calculateCommission(params: {
  orderTotalCents: number
  commissionPct: number
}): number {
  return Math.floor(params.orderTotalCents * params.commissionPct / 100)
}

export function calculateCommissionAdjustment(params: {
  commissionAmountCents: number
  commissionBaseCents: number
  refundAmountCents: number
}): number {
  // Match the formula in process_order_refund_atomic (053 migration):
  // commissionBase = max(subtotal - coupon_discount, 1) to avoid divide by zero
  // fraction = min(1, refundAmount / commissionBase) to cap at 100%
  // adjustment = floor(commissionAmount * fraction)
  const base = Math.max(params.commissionBaseCents, 1)
  const fraction = Math.min(1, params.refundAmountCents / base)
  return Math.floor(params.commissionAmountCents * fraction)
}
