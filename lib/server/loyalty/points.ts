export const TIER_CONFIG = [
  { tier: 'curioso', minPoints: 0, multiplier: 1.0 },
  { tier: 'antojadizo', minPoints: 1000, multiplier: 1.0 },
  { tier: 'fanatico', minPoints: 2500, multiplier: 1.2 },
  { tier: 'snack_lover', minPoints: 6500, multiplier: 1.5 },
  { tier: 'leyenda', minPoints: 17500, multiplier: 1.5 },
] as const

export function tierForLifetimePoints(lifetimePoints: number): string {
  let result = TIER_CONFIG[0].tier as string
  for (const entry of TIER_CONFIG) {
    if (lifetimePoints >= entry.minPoints) {
      result = entry.tier
    }
  }
  return result
}

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
