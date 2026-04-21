import { describe, it, expect } from 'vitest'
import { calculateCommission } from '../../lib/affiliate/commission'

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
