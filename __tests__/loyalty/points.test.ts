import { describe, it, expect } from 'vitest'
import {
  tierForLifetimePoints,
  pointsEarnedForPurchase,
  redemptionDiscountCents,
  validateRedemptionAmount,
} from '../../lib/server/loyalty/points'

describe('tierForLifetimePoints', () => {
  it('returns curioso at 0', () => {
    expect(tierForLifetimePoints(0)).toBe('curioso')
  })
  it('returns curioso just under the antojadizo boundary', () => {
    expect(tierForLifetimePoints(999)).toBe('curioso')
  })
  it('returns antojadizo exactly at the boundary', () => {
    expect(tierForLifetimePoints(1000)).toBe('antojadizo')
  })
  it('returns fanatico at 2500', () => {
    expect(tierForLifetimePoints(2500)).toBe('fanatico')
  })
  it('returns snack_lover at 6500', () => {
    expect(tierForLifetimePoints(6500)).toBe('snack_lover')
  })
  it('returns leyenda at 17500 and above', () => {
    expect(tierForLifetimePoints(17500)).toBe('leyenda')
    expect(tierForLifetimePoints(999999)).toBe('leyenda')
  })
})

describe('pointsEarnedForPurchase', () => {
  it('awards 10 points per $10 MXN (1000 centavos)', () => {
    expect(pointsEarnedForPurchase(1000)).toBe(10)
  })
  it('floors partial hundreds of centavos', () => {
    expect(pointsEarnedForPurchase(1099)).toBe(10)
  })
  it('returns 0 for 0 or negative amounts', () => {
    expect(pointsEarnedForPurchase(0)).toBe(0)
    expect(pointsEarnedForPurchase(-500)).toBe(0)
  })
})

describe('redemptionDiscountCents', () => {
  it('converts 100 points to 1000 centavos ($10 MXN)', () => {
    expect(redemptionDiscountCents(100)).toBe(1000)
  })
  it('scales linearly', () => {
    expect(redemptionDiscountCents(500)).toBe(5000)
  })
})

describe('validateRedemptionAmount', () => {
  it('rejects amounts below the 100-point minimum', () => {
    const result = validateRedemptionAmount({ points: 50, balance: 1000, subtotal: 50000, couponDiscount: 0 })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/mínimo/i)
  })
  it('rejects amounts not a multiple of 100', () => {
    const result = validateRedemptionAmount({ points: 150, balance: 1000, subtotal: 50000, couponDiscount: 0 })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/múltiplo/i)
  })
  it('rejects amounts exceeding the available balance', () => {
    const result = validateRedemptionAmount({ points: 200, balance: 100, subtotal: 50000, couponDiscount: 0 })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/saldo/i)
  })
  it('rejects a discount that would exceed subtotal minus coupon discount', () => {
    const result = validateRedemptionAmount({ points: 1000, balance: 5000, subtotal: 5000, couponDiscount: 4500 })
    // subtotal(5000) - couponDiscount(4500) = 500 centavos ceiling; 1000 pts = 10000 centavos discount
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/excede/i)
  })
  it('accepts a valid redemption and returns the discount', () => {
    const result = validateRedemptionAmount({ points: 300, balance: 1000, subtotal: 50000, couponDiscount: 0 })
    expect(result.valid).toBe(true)
    expect(result.discountCents).toBe(3000)
  })
})
