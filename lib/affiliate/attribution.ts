export type AttributionType = 'coupon' | 'cookie'

export interface AttributionResult {
  type: AttributionType
  affiliateId: string
  couponId?: string
  commissionPct: number
}

export function resolveAttribution(params: {
  couponAffiliateId: string | null | undefined
  couponId: string | null | undefined
  cookieAffiliateId: string | null | undefined
  couponCommissionPct: number
  cookieCommissionPct: number
}): AttributionResult | null {
  if (params.couponAffiliateId && params.couponId) {
    return {
      type: 'coupon',
      affiliateId: params.couponAffiliateId,
      couponId: params.couponId,
      commissionPct: params.couponCommissionPct,
    }
  }
  if (params.cookieAffiliateId) {
    return {
      type: 'cookie',
      affiliateId: params.cookieAffiliateId,
      commissionPct: params.cookieCommissionPct,
    }
  }
  return null
}
