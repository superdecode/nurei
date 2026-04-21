import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

type Params = { params: Promise<{ id: string }> }

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

export async function GET(_: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id } = await params
  const supabase = createServiceClient()
  const [couponRes, usageRes] = await Promise.all([
    supabase.from('coupons').select('*').eq('id', id).single(),
    supabase
      .from('coupon_usages')
      .select('id, order_id, customer_email, customer_phone, discount_amount, applied_snapshot, created_at')
      .eq('coupon_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (couponRes.error || !couponRes.data) {
    return NextResponse.json({ error: 'Cupón no encontrado' }, { status: 404 })
  }

  let affiliate: { id: string; handle: string } | null = null
  if (couponRes.data.affiliate_id) {
    const { data: affiliateData } = await supabase
      .from('affiliate_profiles')
      .select('id, handle')
      .eq('id', couponRes.data.affiliate_id)
      .maybeSingle()
    affiliate = affiliateData ?? null
  }

  return NextResponse.json({
    data: {
      coupon: couponRes.data,
      affiliate,
      usage: usageRes.data ?? [],
    },
  })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { id } = await params
  const body = await request.json()

  const updates: Record<string, unknown> = {}
  if (body?.code !== undefined) updates.code = String(body.code).trim().toUpperCase()
  if (body?.type !== undefined) {
    const nextType = body.type
    updates.discount_type = nextType
    updates.type = nextType === 'fixed' ? 'fixed' : 'percentage'
  }
  if (body?.conditional_type !== undefined) updates.conditional_type = body.conditional_type
  if (body?.conditional_threshold !== undefined) updates.conditional_threshold = body.conditional_threshold
  if (body?.value !== undefined) updates.value = body.value
  if (body?.min_order_amount !== undefined) updates.min_order_amount = body.min_order_amount
  if (body?.max_uses !== undefined) updates.max_uses = body.max_uses
  if (body?.max_uses_per_customer !== undefined) updates.max_uses_per_customer = body.max_uses_per_customer
  if (body?.starts_at !== undefined) updates.starts_at = body.starts_at
  if (body?.expires_at !== undefined) updates.expires_at = body.expires_at
  if (body?.scope_type !== undefined) updates.scope_type = body.scope_type
  if (body?.scope_category_slugs !== undefined) updates.scope_category_slugs = body.scope_category_slugs
  if (body?.scope_product_ids !== undefined) updates.scope_product_ids = body.scope_product_ids
  if (body?.customer_tags !== undefined) updates.customer_tags = body.customer_tags
  if (body?.description !== undefined) updates.description = body.description
  if (body?.affiliate_id !== undefined) updates.affiliate_id = body.affiliate_id
  if (body?.is_active !== undefined) updates.is_active = body.is_active
  if (body?.is_paused !== undefined) updates.is_paused = body.is_paused

  const supabase = createServiceClient()
  let { data, error } = await supabase.from('coupons').update(updates).eq('id', id).select('*').single()
  let currentUpdates = updates
  while (error) {
    const fallbackUpdates = removeUnsupportedCouponColumns(currentUpdates, error)
    if (Object.keys(fallbackUpdates).length === Object.keys(currentUpdates).length) break
    currentUpdates = fallbackUpdates
    const retry = await supabase.from('coupons').update(currentUpdates).eq('id', id).select('*').single()
    data = retry.data
    error = retry.error
  }
  if (error) return NextResponse.json({ error: 'No se pudo actualizar el cupón' }, { status: 500 })
  return NextResponse.json({ data })
}
