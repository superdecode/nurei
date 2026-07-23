export { TIER_CONFIG, tierForLifetimePoints } from '@/lib/loyalty/tiers'

/** Base points before any tier/wheel multiplier — award_points_atomic applies those server-side. */
export function pointsEarnedForPurchase(chargeableCents: number): number {
  if (chargeableCents <= 0) return 0
  return Math.floor(chargeableCents / 100)
}

export function redemptionDiscountCents(points: number): number {
  return points * 10
}

export function validateRedemptionAmount(params: {
  points: number
  balance: number
  subtotal: number
  couponDiscount: number
}): { valid: boolean; discountCents: number; error?: string } {
  const { points, balance, subtotal, couponDiscount } = params

  if (points < 100) {
    return { valid: false, discountCents: 0, error: 'El canje mínimo es de 100 puntos' }
  }
  if (points % 100 !== 0) {
    return { valid: false, discountCents: 0, error: 'Los puntos deben canjearse en múltiplos de 100' }
  }
  if (points > balance) {
    return { valid: false, discountCents: 0, error: 'No tienes saldo de puntos suficiente' }
  }

  const discountCents = redemptionDiscountCents(points)
  const ceiling = Math.max(0, subtotal - couponDiscount)
  if (discountCents > ceiling) {
    return { valid: false, discountCents: 0, error: 'El descuento de puntos excede el subtotal disponible' }
  }

  return { valid: true, discountCents }
}
