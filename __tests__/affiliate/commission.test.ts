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
      orderTotalCents: 10000,
      refundAmountCents: 10000,
    })
    expect(result).toBe(1000)
  })

  it('claws back a proportional share on a partial refund', () => {
    const result = calculateCommissionAdjustment({
      commissionAmountCents: 1000,
      orderTotalCents: 10000,
      refundAmountCents: 3000,
    })
    expect(result).toBe(300)
  })

  it('floors fractional centavos', () => {
    const result = calculateCommissionAdjustment({
      commissionAmountCents: 999,
      orderTotalCents: 10000,
      refundAmountCents: 3333,
    })
    expect(result).toBe(Math.floor(999 * (3333 / 10000)))
  })

  it('returns 0 when order total is 0', () => {
    const result = calculateCommissionAdjustment({
      commissionAmountCents: 1000,
      orderTotalCents: 0,
      refundAmountCents: 0,
    })
    expect(result).toBe(0)
  })
})
