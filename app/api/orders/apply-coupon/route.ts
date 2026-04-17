import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type CouponRule = {
  code: string
  type: 'percentage' | 'fixed' | 'free_shipping'
  value: number
  minOrderAmount: number
  expiresAt: string | null
  active: boolean
}

const FALLBACK_COUPONS: CouponRule[] = [
  {
    code: 'BIENVENIDO10',
    type: 'percentage',
    value: 10,
    minOrderAmount: 20000,
    expiresAt: '2027-12-31T00:00:00.000Z',
    active: true,
  },
  {
    code: 'NUREI150',
    type: 'fixed',
    value: 15000,
    minOrderAmount: 50000,
    expiresAt: null,
    active: true,
  },
  {
    code: 'ENVIOGRATIS',
    type: 'free_shipping',
    value: 0,
    minOrderAmount: 30000,
    expiresAt: null,
    active: true,
  },
]

function resolveDiscount(
  coupon: CouponRule,
  subtotal: number,
  shippingFee: number
) {
  if (coupon.type === 'percentage') {
    return Math.round(subtotal * (coupon.value / 100))
  }
  if (coupon.type === 'fixed') {
    return coupon.value
  }
  return shippingFee
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const code = String(body?.code ?? '').trim().toUpperCase()
    const subtotal = Number(body?.subtotal ?? 0)
    const shippingFee = Number(body?.shippingFee ?? 0)

    if (!code || Number.isNaN(subtotal) || subtotal < 0) {
      return NextResponse.json(
        { valid: false, error: 'Datos de cupón inválidos' },
        { status: 400 }
      )
    }

    let coupon: CouponRule | null = null

    try {
      const supabase = await createServerSupabaseClient()
      const { data } = await supabase
        .from('coupons')
        .select('code, type, value, min_order_amount, expires_at, is_active')
        .ilike('code', code)
        .single()

      if (data) {
        coupon = {
          code: data.code,
          type: data.type === 'percentage' ? 'percentage' : 'fixed',
          value: data.value,
          minOrderAmount: data.min_order_amount,
          expiresAt: data.expires_at,
          active: data.is_active,
        }
      }
    } catch {
      // Ignore and use fallback coupons.
    }

    if (!coupon) {
      coupon = FALLBACK_COUPONS.find((item) => item.code === code) ?? null
    }

    if (!coupon) {
      return NextResponse.json(
        { valid: false, error: 'Cupón inválido' },
        { status: 404 }
      )
    }

    if (!coupon.active) {
      return NextResponse.json(
        { valid: false, error: 'Cupón inactivo' },
        { status: 400 }
      )
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return NextResponse.json(
        { valid: false, error: 'Cupón expirado' },
        { status: 400 }
      )
    }

    if (subtotal < coupon.minOrderAmount) {
      return NextResponse.json(
        {
          valid: false,
          error: `Este cupón requiere un mínimo de compra de $${(coupon.minOrderAmount / 100).toFixed(0)} MXN`,
        },
        { status: 400 }
      )
    }

    const discountAmount = resolveDiscount(coupon, subtotal, shippingFee)

    return NextResponse.json({
      valid: true,
      code: coupon.code,
      discount_amount: Math.max(0, discountAmount),
      free_shipping: coupon.type === 'free_shipping',
      coupon_type: coupon.type,
    })
  } catch {
    return NextResponse.json(
      { valid: false, error: 'No pudimos validar el cupón' },
      { status: 500 }
    )
  }
}
