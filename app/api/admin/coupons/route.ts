import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

function parseArrayParam(value: string | null) {
  if (!value) return []
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function removeUnsupportedCouponColumns(
  payload: Record<string, unknown>,
  error: { code?: string; message?: string } | null
) {
  const message = String(error?.message ?? '')
  const isSchemaCacheColumnError =
    message.includes('schema cache') && message.includes('Could not find') && message.includes('column')
  if (!isSchemaCacheColumnError) return payload

  const next = { ...payload }
  const match = message.match(/'([^']+)'\s+column/i)
  const missingColumn = match?.[1]
  if (missingColumn && missingColumn in next) {
    delete next[missingColumn]
  } else {
    for (const key of ['conditional_threshold', 'conditional_type', 'discount_type']) {
      const columnRegex = new RegExp(`'${key}'\\s+column|column\\s+'${key}'`, 'i')
      if (columnRegex.test(message)) delete next[key]
    }
  }
  return next
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const sp = request.nextUrl.searchParams
  const search = sp.get('search')?.trim()
  const status = sp.get('status')
  const type = sp.get('type')
  const dateFrom = sp.get('dateFrom')
  const dateTo = sp.get('dateTo')
  const page = Math.max(1, Number(sp.get('page') ?? '1'))
  const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize') ?? '20')))

  const supabase = createServiceClient()
  const shouldRangeInDb = !status || status === 'all'
  let query = supabase
    .from('coupons')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
  if (shouldRangeInDb) {
    query = query.range((page - 1) * pageSize, page * pageSize - 1)
  }

  if (search) query = query.ilike('code', `%${search}%`)
  if (type && type !== 'all') query = query.eq('discount_type', type)
  if (dateFrom) query = query.gte('starts_at', `${dateFrom}T00:00:00.000Z`)
  if (dateTo) query = query.lte('expires_at', `${dateTo}T23:59:59.999Z`)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: 'No se pudieron cargar cupones' }, { status: 500 })

  const affiliateIds = Array.from(new Set((data ?? []).map((c) => c.affiliate_id).filter(Boolean)))
  const affiliateHandleMap = new Map<string, string>()
  if (affiliateIds.length > 0) {
    const { data: affiliates } = await supabase
      .from('affiliate_profiles')
      .select('id, handle')
      .in('id', affiliateIds)
    for (const affiliate of affiliates ?? []) affiliateHandleMap.set(affiliate.id, affiliate.handle)
  }

  const now = Date.now()
  const computed = (data ?? []).map((coupon) => {
    let computed_status: 'active' | 'paused' | 'expired' | 'exhausted' = 'active'
    const startsAt = coupon.starts_at ? new Date(coupon.starts_at).getTime() : null
    const expiresAt = coupon.expires_at ? new Date(coupon.expires_at).getTime() : null
    if (!coupon.is_active || coupon.is_paused || (startsAt && startsAt > now)) computed_status = 'paused'
    else if (expiresAt && expiresAt < now) computed_status = 'expired'
    else if (coupon.max_uses && coupon.used_count >= coupon.max_uses) computed_status = 'exhausted'

    return {
      ...coupon,
      type: coupon.discount_type ?? coupon.type,
      affiliate_handle: coupon.affiliate_id ? affiliateHandleMap.get(coupon.affiliate_id) ?? null : null,
      scope_category_slugs: coupon.scope_category_slugs ?? [],
      scope_product_ids: coupon.scope_product_ids ?? [],
      customer_tags: coupon.customer_tags ?? [],
      computed_status,
    }
  })

  const filtered = status && status !== 'all'
    ? computed.filter((coupon) => coupon.computed_status === status)
    : computed
  const paged = shouldRangeInDb ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)
  const effectiveTotal = shouldRangeInDb ? (count ?? filtered.length) : filtered.length

  return NextResponse.json({
    data: {
      coupons: paged,
      total: effectiveTotal,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(effectiveTotal / pageSize)),
    },
  })
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const body = await request.json()
  const code = String(body?.code ?? '').trim().toUpperCase()
  const discountType = String(body?.type ?? 'percentage') as 'percentage' | 'fixed' | 'conditional'
  const value = Number(body?.value ?? 0)
  if (!code || !value) {
    return NextResponse.json({ error: 'Código y valor son obligatorios' }, { status: 400 })
  }
  if (!['percentage', 'fixed', 'conditional'].includes(discountType)) {
    return NextResponse.json({ error: `Tipo de cupón inválido: ${discountType}` }, { status: 400 })
  }
  const scopeType = String(body?.scope_type ?? 'global')
  if (!['global', 'categories', 'products'].includes(scopeType)) {
    return NextResponse.json({ error: `Alcance inválido: ${scopeType}` }, { status: 400 })
  }
  if (discountType === 'percentage' && (value <= 0 || value > 100)) {
    return NextResponse.json({ error: 'El porcentaje debe estar entre 1 y 100' }, { status: 400 })
  }
  if (discountType !== 'percentage' && value <= 0) {
    return NextResponse.json({ error: 'El valor del descuento debe ser mayor a 0' }, { status: 400 })
  }
  if (discountType === 'conditional' && !Number(body?.conditional_threshold ?? 0)) {
    return NextResponse.json({ error: 'El cupón condicional requiere un umbral de activación válido' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const payload: Record<string, unknown> = {
    code,
    type: discountType === 'fixed' ? 'fixed' : 'percentage',
    discount_type: discountType,
    conditional_type: body?.conditional_type ?? null,
    conditional_threshold: body?.conditional_threshold ? Number(body.conditional_threshold) : null,
    value,
    min_order_amount: Number(body?.min_order_amount ?? 0),
    max_uses: body?.max_uses ? Number(body.max_uses) : null,
    max_uses_per_customer: body?.max_uses_per_customer ? Number(body.max_uses_per_customer) : null,
    starts_at: body?.starts_at || null,
    expires_at: body?.expires_at || null,
    is_active: body?.is_active ?? true,
    is_paused: body?.is_paused ?? false,
    scope_type: scopeType,
    scope_category_slugs: Array.isArray(body?.scope_category_slugs)
      ? body.scope_category_slugs
      : parseArrayParam(body?.scope_category_slugs ?? null),
    scope_product_ids: body?.scope_product_ids ?? [],
    customer_tags: body?.customer_tags ?? [],
    affiliate_id: body?.affiliate_id || null,
    description: body?.description ?? null,
  }

  let { data, error } = await supabase.from('coupons').insert(payload).select('*').single()
  let currentPayload = payload
  while (error) {
    const fallbackPayload = removeUnsupportedCouponColumns(currentPayload, error)
    if (Object.keys(fallbackPayload).length === Object.keys(currentPayload).length) break
    currentPayload = fallbackPayload
    const retry = await supabase.from('coupons').insert(currentPayload).select('*').single()
    data = retry.data
    error = retry.error
  }
  if (error) {
    return NextResponse.json({
      error: `No se pudo crear el cupón: ${error.message}`,
      details: error.details,
      hint: error.hint,
      code: error.code,
    }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}
