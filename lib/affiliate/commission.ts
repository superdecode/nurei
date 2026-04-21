export function calculateCommission(params: {
  orderTotalCents: number
  commissionPct: number
}): number {
  return Math.floor(params.orderTotalCents * params.commissionPct / 100)
}
