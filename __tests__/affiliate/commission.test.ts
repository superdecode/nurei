import { describe, it, expect } from 'vitest'
import { calculateCommission, calculateCommissionAdjustment } from '../../lib/affiliate/commission'

describe('calculateCommission', () => {
  it('calculates percentage commission correctly', () => {
    expect(calculateCommission({ orderTotalCents: 10000, commissionPct: 10 })).toBe(1000)
  })

  it('floors fractional centavos', () => {
    expect(calculateCommission({ orderTotalCents: 9999, commissionPct: 10 })).toBe(999)
  })

  it('returns 0 for 0% commission', () => {
    expect(calculateCommission({ orderTotalCents: 50000, commissionPct: 0 })).toBe(0)
  })

  it('returns full amount for 100% commission', () => {
    expect(calculateCommission({ orderTotalCents: 20000, commissionPct: 100 })).toBe(20000)
  })
})

describe('calculateCommissionAdjustment', () => {
  it('claws back the full commission on a full refund', () => {
    const result = calculateCommissionAdjustment({
      commissionAmountCents: 1000,
      commissionBaseCents: 10000,
      refundAmountCents: 10000,
    })
    expect(result).toBe(1000)
  })

  it('claws back a proportional share on a partial refund', () => {
    const result = calculateCommissionAdjustment({
      commissionAmountCents: 1000,
      commissionBaseCents: 10000,
      refundAmountCents: 3000,
    })
    expect(result).toBe(300)
  })

  it('floors fractional centavos', () => {
    const result = calculateCommissionAdjustment({
      commissionAmountCents: 999,
      commissionBaseCents: 10000,
      refundAmountCents: 3333,
    })
    expect(result).toBe(Math.floor(999 * (3333 / 10000)))
  })

  it('uses a minimum base of 1 to avoid divide by zero', () => {
    const result = calculateCommissionAdjustment({
      commissionAmountCents: 1000,
      commissionBaseCents: 0,
      refundAmountCents: 500,
    })
    // base is floored at 1, fraction = 500/1 = 500 (capped at 1),
    // adjustment = floor(1000 * 1) = 1000
    expect(result).toBe(1000)
  })

  it('caps fraction at 1 when refund exceeds commission base', () => {
    // Refund > base (e.g., shipping was also refunded) should not claw back >100% of commission
    const result = calculateCommissionAdjustment({
      commissionAmountCents: 1000,
      commissionBaseCents: 5000,
      refundAmountCents: 8000,
    })
    // base = 5000, fraction = min(1, 8000/5000) = 1, adjustment = floor(1000 * 1) = 1000
    expect(result).toBe(1000)
  })
})
