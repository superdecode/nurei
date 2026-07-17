export function calculateCommission(params: {
  orderTotalCents: number
  commissionPct: number
}): number {
  return Math.floor(params.orderTotalCents * params.commissionPct / 100)
}

export function calculateCommissionAdjustment(params: {
  commissionAmountCents: number
  orderTotalCents: number
  refundAmountCents: number
}): number {
  if (params.orderTotalCents <= 0) return 0
  const fraction = params.refundAmountCents / params.orderTotalCents
  return Math.floor(params.commissionAmountCents * fraction)
}
