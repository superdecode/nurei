import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAffiliate } from '@/lib/server/require-affiliate'

export async function GET() {
  const guard = await requireAffiliate()
  if (guard.error) return guard.error

  const affiliateId = guard.userId!
  const supabase = createServiceClient()

  const { data: profile, error: profileErr } = await supabase
    .from('affiliate_profiles')
    .select('*')
    .eq('id', affiliateId)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  const [linkRes, couponsRes] = await Promise.all([
    supabase.from('referral_links').select('slug').eq('affiliate_id', affiliateId).maybeSingle(),
    supabase
      .from('coupons')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false }),
  ])

  let couponRows = couponsRes.data ?? []
  if (couponsRes.error && couponRows.length === 0) {
    const retry = await supabase.from('coupons').select('*').eq('affiliate_id', affiliateId)
    couponRows = retry.data ?? []
  }

  const now = Date.now()
  const coupons = couponRows.map((c: Record<string, unknown>) => {
    const isActive = Boolean(c.is_active)
    const isPaused = Boolean(c.is_paused)
    const usedCount = Number(c.used_count ?? 0)
    const maxUses = c.max_uses != null ? Number(c.max_uses) : null
    const expiresAt = c.expires_at ? new Date(String(c.expires_at)).getTime() : null
    let status: 'active' | 'paused' | 'expired' | 'exhausted' = 'active'
    if (!isActive || isPaused) status = 'paused'
    else if (expiresAt && expiresAt < now) status = 'expired'
    else if (maxUses != null && usedCount >= maxUses) status = 'exhausted'
    const dtype = (c.discount_type ?? c.type) as string | undefined
    return {
      id: c.id as string,
      code: c.code as string,
      type: dtype ?? 'percentage',
      value: Number(c.value ?? 0),
      used_count: usedCount,
      max_uses: maxUses,
      starts_at: (c.starts_at as string | null) ?? null,
      expires_at: (c.expires_at as string | null) ?? null,
      is_active: isActive,
      is_paused: isPaused,
      status,
    }
  })

  return NextResponse.json({
    data: {
      ...profile,
      referral_slug: linkRes.data?.slug ?? null,
      coupons,
    },
  })
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAffiliate()
  if (guard.error) return guard.error

  const affiliateId = guard.userId!
  const body = await request.json()
  const supabase = createServiceClient()

  const allowed = [
    'bio', 'first_name', 'last_name', 'phone',
    'payment_method', 'bank_name', 'bank_clabe', 'bank_account', 'bank_holder', 'payment_notes',
    'notify_on_sale', 'notify_on_payment', 'notify_weekly_summary',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // Validate CLABE length if provided
  if (typeof update.bank_clabe === 'string' && update.bank_clabe.length > 0 && update.bank_clabe.length !== 18) {
    return NextResponse.json({ error: 'La CLABE debe tener exactamente 18 dígitos' }, { status: 400 })
  }

  const { error } = await supabase.from('affiliate_profiles').update(update).eq('id', affiliateId)
  if (error) return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
