import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveAttribution } from '@/lib/affiliate/attribution'
import { calculateCommission } from '@/lib/affiliate/commission'
import { getReferralLinkIdFromHeader } from '@/lib/affiliate/cookie'

interface AttributionPayload {
  orderId: string
  orderTotalCents: number
  couponCode?: string | null
  cookieHeader?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body: AttributionPayload = await request.json()
    const { orderId, orderTotalCents, couponCode, cookieHeader } = body

    if (!orderId || typeof orderTotalCents !== 'number') {
      return NextResponse.json({ error: 'orderId y orderTotalCents requeridos' }, { status: 400 })
    }

    const supabase = createServiceClient()

    let couponAffiliateId: string | null = null
    let couponId: string | null = null
    let couponCommissionPct = 0

    if (couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('id, affiliate_id')
        .ilike('code', couponCode)
        .single()

      if (coupon?.affiliate_id) {
        couponAffiliateId = coupon.affiliate_id
        couponId = coupon.id

        const { data: profile } = await supabase
          .from('affiliate_profiles')
          .select('commission_coupon_pct')
          .eq('id', coupon.affiliate_id)
          .single()

        couponCommissionPct = profile?.commission_coupon_pct ?? 0
      }
    }

    let cookieAffiliateId: string | null = null
    let cookieCommissionPct = 0

    const referralLinkId = getReferralLinkIdFromHeader(cookieHeader ?? null)
    if (referralLinkId) {
      const { data: link } = await supabase
        .from('referral_links')
        .select('affiliate_id')
        .eq('id', referralLinkId)
        .single()

      if (link?.affiliate_id) {
        cookieAffiliateId = link.affiliate_id

        const { data: profile } = await supabase
          .from('affiliate_profiles')
          .select('commission_cookie_pct')
          .eq('id', link.affiliate_id)
          .single()

        cookieCommissionPct = profile?.commission_cookie_pct ?? 0
      }
    }

    const attribution = resolveAttribution({
      couponAffiliateId,
      couponId,
      cookieAffiliateId,
      couponCommissionPct,
      cookieCommissionPct,
    })

    if (!attribution) {
      return NextResponse.json({ ok: true, attributed: false })
    }

    const commissionAmountCents = calculateCommission({
      orderTotalCents,
      commissionPct: attribution.commissionPct,
    })

    const { error: attrError } = await supabase
      .from('affiliate_attributions')
      .insert({
        order_id: orderId,
        affiliate_id: attribution.affiliateId,
        attribution_type: attribution.type,
        coupon_id: attribution.couponId ?? null,
        commission_pct: attribution.commissionPct,
        commission_amount_cents: commissionAmountCents,
      })

    if (attrError && !attrError.message.includes('unique')) {
      return NextResponse.json({ error: 'Error al registrar atribución' }, { status: 500 })
    }

    if (!attrError) {
      await supabase.rpc('increment_affiliate_pending', {
        affiliate_id: attribution.affiliateId,
        amount: commissionAmountCents,
      })

      if (referralLinkId) {
        await supabase
          .from('referral_clicks')
          .update({ converted: true, order_id: orderId })
          .eq('referral_link_id', referralLinkId)
          .eq('converted', false)
      }
    }

    return NextResponse.json({
      ok: true,
      attributed: true,
      type: attribution.type,
      commissionAmountCents,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
