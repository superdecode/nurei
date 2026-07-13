import { createServiceClient } from '@/lib/supabase/server'
import { resolveAttribution } from '@/lib/affiliate/attribution'
import { calculateCommission } from '@/lib/affiliate/commission'
import { getReferralLinkIdFromHeader } from '@/lib/affiliate/cookie'

export type AttributionExecInput = {
  orderId: string
  couponCode?: string | null
  cookieHeader?: string | null
  referralLinkId?: string | null  // bypasses cookie — use when cookie is no longer available (e.g. admin confirmation)
}

export type AttributionExecResult = {
  ok: boolean
  attributed: boolean
  duplicate?: boolean
  type?: 'coupon' | 'cookie'
  commissionAmountCents?: number
  error?: string
  status?: number
}

export async function executeAffiliateAttribution(input: AttributionExecInput): Promise<AttributionExecResult> {
  const { orderId, couponCode, cookieHeader, referralLinkId: referralLinkIdOverride } = input
  const referralLinkId = referralLinkIdOverride ?? getReferralLinkIdFromHeader(cookieHeader ?? null)

  if (!orderId) return { ok: false, attributed: false, error: 'orderId requerido', status: 400 }

  const supabase = createServiceClient()

  // Use payment_status='paid' — orders.status only accepts ('pending','confirmed','shipped','delivered','cancelled','failed')
  // 'paid' is a valid payment_status value, NOT a valid status value.
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, total, subtotal, coupon_discount, user_id, status, payment_status')
    .eq('id', orderId)
    .eq('payment_status', 'paid')
    .single()

  if (orderErr || !order) {
    console.warn('[attribution] order not found or not paid', { orderId, orderErr: orderErr?.message })
    return { ok: false, attributed: false, error: 'Orden no válida o no pagada', status: 400 }
  }

  // Commission is paid on net product revenue (subtotal minus coupon discount),
  // never on shipping. Fall back to total only if subtotal is unavailable.
  const netProductCents: number =
    typeof order.subtotal === 'number'
      ? Math.max(0, order.subtotal - (order.coupon_discount ?? 0))
      : order.total
  const orderBuyerId: string | null = order.user_id ?? null
  let couponAffiliateId: string | null = null
  let couponId: string | null = null
  let couponCodeResolved: string | null = null
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
      couponCodeResolved = coupon.code

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
    return { ok: true, attributed: false }
  }

  // Block self-referral: an affiliate cannot earn commission on their own purchase.
  if (orderBuyerId && attribution.affiliateId === orderBuyerId) {
    console.warn('[attribution] self-referral blocked', { orderId, affiliateId: attribution.affiliateId })
    return { ok: true, attributed: false }
  }

  const commissionAmountCents = calculateCommission({
    orderTotalCents: netProductCents,
    commissionPct: attribution.commissionPct,
  })

  const { data: result, error: rpcErr } = await supabase.rpc('record_attribution_atomic', {
    p_order_id: orderId,
    p_affiliate_id: attribution.affiliateId,
    p_attribution_type: attribution.type,
    p_coupon_id: attribution.couponId ?? null,
    p_coupon_code: couponCodeResolved ?? null,
    p_commission_pct: attribution.commissionPct,
    p_commission_cents: commissionAmountCents,
  })

  if (rpcErr) return { ok: false, attributed: false, error: 'Error al registrar atribución', status: 500 }
  if (result === 'order_invalid') return { ok: false, attributed: false, error: 'Orden no válida o no pagada', status: 400 }

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

  return {
    ok: true,
    attributed: result === 'inserted',
    duplicate: result === 'duplicate',
    type: attribution.type,
    commissionAmountCents,
  }
}
