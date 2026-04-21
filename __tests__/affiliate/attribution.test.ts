import { describe, it, expect } from 'vitest'
import { resolveAttribution } from '../../lib/affiliate/attribution'

describe('resolveAttribution', () => {
  it('returns null when no coupon and no cookie', () => {
    const result = resolveAttribution({
      couponAffiliateId: null,
      couponId: null,
      cookieAffiliateId: null,
      couponCommissionPct: 10,
      cookieCommissionPct: 5,
    })
    expect(result).toBeNull()
  })

  it('returns cookie attribution when only cookie is present', () => {
    const result = resolveAttribution({
      couponAffiliateId: null,
      couponId: null,
      cookieAffiliateId: 'affiliate-123',
      couponCommissionPct: 10,
      cookieCommissionPct: 5,
    })
    expect(result).toEqual({
      type: 'cookie',
      affiliateId: 'affiliate-123',
      couponId: undefined,
      commissionPct: 5,
    })
  })

  it('returns coupon attribution when coupon is present (priority over cookie)', () => {
    const result = resolveAttribution({
      couponAffiliateId: 'affiliate-abc',
      couponId: 'coupon-xyz',
      cookieAffiliateId: 'affiliate-different',
      couponCommissionPct: 10,
      cookieCommissionPct: 5,
    })
    expect(result).toEqual({
      type: 'coupon',
      affiliateId: 'affiliate-abc',
      couponId: 'coupon-xyz',
      commissionPct: 10,
    })
  })

  it('ignores cookie when coupon belongs to different affiliate', () => {
    const result = resolveAttribution({
      couponAffiliateId: 'affiliate-A',
      couponId: 'coupon-1',
      cookieAffiliateId: 'affiliate-B',
      couponCommissionPct: 12,
      cookieCommissionPct: 6,
    })
    expect(result?.affiliateId).toBe('affiliate-A')
    expect(result?.type).toBe('coupon')
  })
})
