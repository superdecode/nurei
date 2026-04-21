import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id } = await params
  const sp = req.nextUrl.searchParams
  const dateFrom = sp.get('dateFrom') ?? undefined
  const dateTo = sp.get('dateTo') ?? undefined

  const supabase = createServiceClient()

  const { data: profile, error: profileErr } = await supabase
    .from('affiliate_profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Afiliado no encontrado' }, { status: 404 })
  }

  // Fetch email from auth
  const { data: authUser } = await supabase.auth.admin.getUserById(id)

  const [linkRes, couponsRes, attrsBase] = await Promise.all([
    supabase
      .from('referral_links')
      .select('id, slug, clicks_count')
      .eq('affiliate_id', id)
      .maybeSingle(),
    supabase
      .from('coupons')
      .select('id, code, discount_type, type, value, used_count, max_uses, starts_at, expires_at, is_active, is_paused')
      .eq('affiliate_id', id)
      .order('created_at', { ascending: false }),
    (() => {
      // Note: coupon_code column added in migration 017 — select without it for safety
      let q = supabase
        .from('affiliate_attributions')
        .select(`
          id, order_id, attribution_type, coupon_id,
          commission_pct, commission_amount_cents, payout_status, created_at,
          orders(short_id, total, customer_name, customer_email)
        `)
        .eq('affiliate_id', id)
        .order('created_at', { ascending: false })
        .limit(200)
      if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00.000Z`)
      if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999Z`)
      return q
    })(),
  ])

  const now = Date.now()
  const coupons = (couponsRes.data ?? []).map((coupon) => {
    let computed_status: 'active' | 'paused' | 'expired' | 'exhausted' = 'active'
    const startsAt = coupon.starts_at ? new Date(coupon.starts_at).getTime() : null
    const expiresAt = coupon.expires_at ? new Date(coupon.expires_at).getTime() : null
    if (!coupon.is_active || coupon.is_paused || (startsAt && startsAt > now)) computed_status = 'paused'
    else if (expiresAt && expiresAt < now) computed_status = 'expired'
    else if (coupon.max_uses && coupon.used_count >= coupon.max_uses) computed_status = 'exhausted'
    return { ...coupon, computed_status, type: coupon.discount_type ?? coupon.type }
  })

  const attributions = attrsBase.data ?? []

  // Unique clicks count from referral_clicks table
  const linkId = linkRes.data?.id
  let uniqueClicks = 0
  if (linkId) {
    const { count } = await supabase
      .from('referral_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('referral_link_id', linkId)
    uniqueClicks = count ?? 0
  }

  // KPI computations
  const totalOrders = attributions.length
  const totalCommission = attributions.reduce((s, a) => s + (a.commission_amount_cents ?? 0), 0)
  const pendingCommission = attributions
    .filter((a) => a.payout_status === 'pending')
    .reduce((s, a) => s + (a.commission_amount_cents ?? 0), 0)
  const totalClicks = linkRes.data?.clicks_count ?? 0
  const conversionRate = totalClicks > 0 ? Math.round((totalOrders / totalClicks) * 100 * 10) / 10 : 0

  // Weekly chart (last 8 weeks)
  const chartData = Array.from({ length: 8 }, (_, i) => {
    const ref = new Date()
    ref.setDate(ref.getDate() - 7 * (7 - i))
    ref.setHours(0, 0, 0, 0)
    const end = new Date(ref)
    end.setDate(ref.getDate() + 7)
    const week = attributions.filter((a) => {
      const d = new Date(a.created_at)
      return d >= ref && d < end
    })
    return {
      label: ref.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
      sales: week.reduce((s, a) => s + (a.commission_amount_cents ?? 0), 0),
      orders: week.length,
    }
  })

  return NextResponse.json({
    data: {
      profile: { ...profile, email: authUser?.user?.email ?? '' },
      referral_link: linkRes.data ?? null,
      coupons,
      attributions,
      kpis: {
        totalOrders,
        totalCommission,
        pendingCommission,
        totalClicks,
        uniqueClicks,
        conversionRate,
      },
      chartData,
    },
  })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id } = await params
  const body = await request.json()
  const supabase = createServiceClient()

  const allowed = [
    'commission_coupon_pct', 'commission_cookie_pct', 'is_active', 'bio', 'handle',
    'first_name', 'last_name', 'phone',
    'payment_method', 'bank_name', 'bank_clabe', 'bank_account', 'bank_holder', 'payment_notes',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { error } = await supabase.from('affiliate_profiles').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

  if (body?.is_active === false) {
    await supabase.from('coupons').update({ is_paused: true }).eq('affiliate_id', id)
  }
  if (body?.is_active === true) {
    await supabase.from('coupons').update({ is_paused: false }).eq('affiliate_id', id)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id } = await params
  const supabase = createServiceClient()

  await supabase.from('coupons').update({ affiliate_id: null }).eq('affiliate_id', id)
  await supabase.from('referral_links').delete().eq('affiliate_id', id)
  const { error } = await supabase.from('affiliate_profiles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar afiliado' }, { status: 500 })
  await supabase.from('user_profiles').update({ role: 'customer' }).eq('id', id)
  return NextResponse.json({ ok: true })
}
