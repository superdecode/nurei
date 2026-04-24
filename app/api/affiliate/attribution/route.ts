import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveAttribution } from '@/lib/affiliate/attribution'
import { calculateCommission } from '@/lib/affiliate/commission'
import { getReferralLinkIdFromHeader } from '@/lib/affiliate/cookie'

interface AttributionPayload {
  orderId: string
  couponCode?: string | null
  cookieHeader?: string | null
}

function verifySecret(request: NextRequest): boolean {
  const secret = process.env.AFFILIATE_ATTRIBUTION_SECRET
  if (!secret) return false // fail-secure: no secret configured = reject all
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body: AttributionPayload = await request.json()
    const { orderId, couponCode, cookieHeader } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId requerido' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Always fetch order from DB — never trust a client-supplied total
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, total, status')
      .eq('id', orderId)
      .eq('status', 'paid')
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Orden no válida o no pagada' }, { status: 400 })
    }

    const orderTotalCents: number = order.total

    let couponAffiliateId: string | null = null
    let couponId: string | null = null
    let couponCode_resolved: string | null = null
    let couponCommissionPct = 0

    if (couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('id, code, affiliate_id')
        .ilike('code', couponCode)
        .single()

      if (coupon?.affiliate_id) {
        couponAffiliateId = coupon.affiliate_id
        couponId = coupon.id
        couponCode_resolved = coupon.code

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

    // Use atomic DB function: INSERT + balance increment in one transaction
    const { data: result, error: rpcErr } = await supabase.rpc('record_attribution_atomic', {
      p_order_id:         orderId,
      p_affiliate_id:     attribution.affiliateId,
      p_attribution_type: attribution.type,
      p_coupon_id:        attribution.couponId ?? null,
      p_coupon_code:      couponCode_resolved ?? null,
      p_commission_pct:   attribution.commissionPct,
      p_commission_cents: commissionAmountCents,
    })

    if (rpcErr) {
      return NextResponse.json({ error: 'Error al registrar atribución' }, { status: 500 })
    }

    if (result === 'order_invalid') {
      return NextResponse.json({ error: 'Orden no válida o no pagada' }, { status: 400 })
    }

    // Mark only the most-recent unconverted click for this link as converted
    if (result === 'inserted' && referralLinkId) {
      const { data: clickRow } = await supabase
        .from('referral_clicks')
        .select('id')
        .eq('referral_link_id', referralLinkId)
        .eq('converted', false)
        .order('clicked_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (clickRow) {
        await supabase
          .from('referral_clicks')
          .update({ converted: true, order_id: orderId })
          .eq('id', clickRow.id)
      }
    }

    return NextResponse.json({
      ok: true,
      attributed: result === 'inserted',
      duplicate: result === 'duplicate',
      type: attribution.type,
      commissionAmountCents,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
