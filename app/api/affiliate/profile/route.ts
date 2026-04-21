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
    .select(`
      handle, bio, first_name, last_name, phone,
      payment_method, bank_name, bank_clabe, bank_account, bank_holder, payment_notes,
      notify_on_sale, notify_on_payment, notify_weekly_summary
    `)
    .eq('id', affiliateId)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  const [linkRes, couponsRes] = await Promise.all([
    supabase.from('referral_links').select('slug').eq('affiliate_id', affiliateId).maybeSingle(),
    supabase
      .from('coupons')
      .select('id, code, discount_type, type, value, used_count, max_uses, starts_at, expires_at, is_active, is_paused')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false }),
  ])

  const now = Date.now()
  const coupons = (couponsRes.data ?? []).map((c) => {
    let status: 'active' | 'paused' | 'expired' | 'exhausted' = 'active'
    const expiresAt = c.expires_at ? new Date(c.expires_at).getTime() : null
    if (!c.is_active || c.is_paused) status = 'paused'
    else if (expiresAt && expiresAt < now) status = 'expired'
    else if (c.max_uses && c.used_count >= c.max_uses) status = 'exhausted'
    return { ...c, type: c.discount_type ?? c.type, status }
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
