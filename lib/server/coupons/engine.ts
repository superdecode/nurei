import { createServiceClient } from '@/lib/supabase/server'

type CouponRow = {
  id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  discount_type: 'percentage' | 'fixed' | 'conditional' | null
  conditional_type: 'percentage' | 'fixed' | null
  conditional_threshold: number | null
  scope_type: 'global' | 'categories' | 'products' | null
  scope_category_slugs: string[] | null
  scope_product_ids: string[] | null
  customer_tags: string[] | null
  min_order_amount: number
  max_uses: number | null
  max_uses_per_customer: number | null
  used_count: number
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
  is_paused: boolean | null
}

type CartItemInput = {
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
  category?: string | null
}

export type CouponValidationInput = {
  code: string
  subtotal: number
  shippingFee: number
  items: CartItemInput[]
  customerEmail?: string | null
  customerPhone?: string | null
}

export type CouponValidationResult =
  | { valid: false; reason: string; status: number }
  | {
      valid: true
      couponId: string
      code: string
      discountAmount: number
      eligibleSubtotal: number
      status: 'active' | 'paused' | 'expired' | 'exhausted'
      snapshot: Record<string, unknown>
    }

function normalizeStatus(coupon: CouponRow): 'active' | 'paused' | 'expired' | 'exhausted' {
  const now = Date.now()
  const starts = coupon.starts_at ? new Date(coupon.starts_at).getTime() : null
  const expires = coupon.expires_at ? new Date(coupon.expires_at).getTime() : null
  if (!coupon.is_active || coupon.is_paused) return 'paused'
  if (starts && now < starts) return 'paused'
  if (expires && now > expires) return 'expired'
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return 'exhausted'
  return 'active'
}

async function loadCoupon(code: string): Promise<CouponRow | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('coupons')
    .select(`
      id, code, type, value, discount_type, conditional_type, conditional_threshold,
      scope_type, scope_category_slugs, scope_product_ids, customer_tags, min_order_amount,
      max_uses, max_uses_per_customer, used_count, starts_at, expires_at, is_active, is_paused
    `)
    .ilike('code', code.trim().toUpperCase())
    .maybeSingle()
  return (data as CouponRow | null) ?? null
}

async function resolveCategoriesIfNeeded(items: CartItemInput[]): Promise<Map<string, string>> {
  const missing = items.filter((item) => !item.category).map((item) => item.product_id)
  const map = new Map<string, string>()
  for (const item of items) {
    if (item.category) map.set(item.product_id, item.category)
  }
  if (missing.length === 0) return map
  const supabase = createServiceClient()
  const { data } = await supabase.from('products').select('id, category').in('id', missing)
  for (const row of data ?? []) {
    map.set(row.id, row.category)
  }
  return map
}

async function countCustomerUses(
  couponId: string,
  customerEmail?: string | null,
  customerPhone?: string | null
): Promise<number> {
  if (!customerEmail && !customerPhone) return 0
  const supabase = createServiceClient()
  if (customerEmail && customerPhone) {
    const email = customerEmail.toLowerCase()
    const { count } = await supabase
      .from('coupon_usages')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', couponId)
      .or(`customer_email.eq.${email},customer_phone.eq.${customerPhone}`)
    return count ?? 0
  }
  if (customerEmail) {
    const { count } = await supabase
      .from('coupon_usages')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', couponId)
      .eq('customer_email', customerEmail.toLowerCase())
    return count ?? 0
  }
  const { count } = await supabase
    .from('coupon_usages')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', couponId)
    .eq('customer_phone', customerPhone ?? '')
  return count ?? 0
}

async function customerHasEligibleTag(
  tags: string[],
  customerEmail?: string | null,
  customerPhone?: string | null
) {
  if (!customerEmail && !customerPhone) return false
  const supabase = createServiceClient()
  let query = supabase.from('customers').select('tags').limit(1)
  if (customerEmail) query = query.eq('email', customerEmail.toLowerCase())
  else query = query.eq('phone', customerPhone ?? '')
  const { data } = await query.maybeSingle()
  const customerTags = data?.tags ?? []
  return tags.some((tag) => customerTags.includes(tag))
}

export async function validateCoupon(input: CouponValidationInput): Promise<CouponValidationResult> {
  const coupon = await loadCoupon(input.code)
  if (!coupon) return { valid: false, reason: 'El código no existe.', status: 404 }

  // 2-3 estado y vigencia
  const status = normalizeStatus(coupon)
  if (status !== 'active') {
    const reason =
      status === 'paused'
        ? 'Este cupón está pausado.'
        : status === 'expired'
          ? 'Este cupón está vencido.'
          : 'Este cupón está agotado.'
    return { valid: false, reason, status: 400 }
  }

  // 4 límite global
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
    return { valid: false, reason: 'Este cupón alcanzó su límite de usos.', status: 400 }
  }

  // 5 límite por cliente
  if (coupon.max_uses_per_customer) {
    const personalUses = await countCustomerUses(coupon.id, input.customerEmail, input.customerPhone)
    if (personalUses >= coupon.max_uses_per_customer) {
      return { valid: false, reason: 'Ya alcanzaste el límite de usos de este cupón.', status: 400 }
    }
  }

  // 6 tags
  const requiredTags = coupon.customer_tags ?? []
  if (requiredTags.length > 0) {
    const ok = await customerHasEligibleTag(requiredTags, input.customerEmail, input.customerPhone)
    if (!ok) {
      return { valid: false, reason: 'Este cupón no aplica para tu perfil de cliente.', status: 400 }
    }
  }

  // 7 alcance
  const scope = coupon.scope_type ?? 'global'
  let eligibleItems = input.items
  if (scope !== 'global') {
    const allowedProducts = new Set(coupon.scope_product_ids ?? [])
    const allowedCategories = new Set(coupon.scope_category_slugs ?? [])
    const categoryMap = await resolveCategoriesIfNeeded(input.items)
    const hasProducts = allowedProducts.size > 0
    const hasCategories = allowedCategories.size > 0
    eligibleItems = input.items.filter((item) => {
      const byProduct = hasProducts && allowedProducts.has(item.product_id)
      const byCategory = hasCategories && allowedCategories.has(categoryMap.get(item.product_id) ?? '')
      if (!hasProducts && !hasCategories) return true
      return byProduct || byCategory
    })
  }
  if (scope !== 'global' && eligibleItems.length === 0) {
    return { valid: false, reason: 'El carrito no contiene productos elegibles para este cupón.', status: 400 }
  }

  const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.subtotal, 0)

  // 8 mínimo compra
  if (eligibleSubtotal < coupon.min_order_amount) {
    return {
      valid: false,
      reason: `Este cupón requiere un mínimo de ${Math.round(coupon.min_order_amount / 100)} MXN.`,
      status: 400,
    }
  }

  const discountType = coupon.discount_type ?? coupon.type
  let discountAmount = 0
  if (discountType === 'percentage') {
    discountAmount = Math.round(eligibleSubtotal * (coupon.value / 100))
  } else if (discountType === 'fixed') {
    discountAmount = Math.min(coupon.value, eligibleSubtotal)
  } else {
    const threshold = coupon.conditional_threshold ?? 0
    if (eligibleSubtotal < threshold) {
      return {
        valid: false,
        reason: `Este cupón requiere compras desde ${Math.round(threshold / 100)} MXN para activar el beneficio.`,
        status: 400,
      }
    }
    if ((coupon.conditional_type ?? 'fixed') === 'percentage') {
      discountAmount = Math.round(eligibleSubtotal * (coupon.value / 100))
    } else {
      discountAmount = Math.min(coupon.value, eligibleSubtotal)
    }
  }

  return {
    valid: true,
    couponId: coupon.id,
    code: coupon.code,
    discountAmount: Math.max(0, discountAmount),
    eligibleSubtotal,
    status: 'active',
    snapshot: {
      code: coupon.code,
      type: discountType,
      value: coupon.value,
      applied_on_subtotal: eligibleSubtotal,
      scope_type: scope,
      scope_categories: coupon.scope_category_slugs ?? [],
      scope_products: coupon.scope_product_ids ?? [],
      min_order_amount: coupon.min_order_amount,
      starts_at: coupon.starts_at,
      expires_at: coupon.expires_at,
      validated_at: new Date().toISOString(),
    },
  }
}

export async function registerCouponUsage(input: {
  couponId: string
  orderId: string | null
  customerId?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  discountAmount: number
  snapshot: Record<string, unknown>
}) {
  const supabase = createServiceClient()
  await supabase.from('coupon_usages').insert({
    coupon_id: input.couponId,
    order_id: input.orderId,
    customer_id: input.customerId ?? null,
    customer_email: input.customerEmail?.toLowerCase() ?? null,
    customer_phone: input.customerPhone ?? null,
    discount_amount: input.discountAmount,
    applied_snapshot: input.snapshot,
  })
  await supabase.rpc('increment_coupon_use', { p_code: String(input.snapshot.code ?? '') })
}
