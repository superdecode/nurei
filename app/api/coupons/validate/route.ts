import { NextRequest, NextResponse } from 'next/server'
import type { ValidateCouponResponse, Coupon } from '@/types'

// TODO: Replace with Supabase query
const MOCK_COUPONS: Coupon[] = [
  {
    id: '1', code: 'BIENVENIDO10', type: 'percentage', value: 10,
    min_order_amount: 20000, max_uses: 100, used_count: 23,
    expires_at: '2026-06-01T00:00:00Z', is_active: true,
    description: 'Descuento de bienvenida',
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2', code: 'ENVIOGRATIS', type: 'fixed', value: 9900,
    min_order_amount: 30000, max_uses: 50, used_count: 12,
    expires_at: null, is_active: true,
    description: 'Envío gratis',
    created_at: '2024-02-01T00:00:00Z', updated_at: '2024-02-01T00:00:00Z',
  },
]

export async function POST(request: NextRequest) {
  try {
    const { code, subtotal } = await request.json()

    if (!code || typeof subtotal !== 'number') {
      return NextResponse.json({ valid: false, error: 'Datos inválidos' } satisfies ValidateCouponResponse)
    }

    const coupon = MOCK_COUPONS.find((c) => c.code.toUpperCase() === code.toUpperCase())

    if (!coupon) {
      return NextResponse.json({ valid: false, error: 'Cupón no encontrado' } satisfies ValidateCouponResponse)
    }

    if (!coupon.is_active) {
      return NextResponse.json({ valid: false, error: 'Cupón inactivo' } satisfies ValidateCouponResponse)
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Cupón expirado' } satisfies ValidateCouponResponse)
    }

    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json({ valid: false, error: 'Cupón agotado' } satisfies ValidateCouponResponse)
    }

    if (subtotal < coupon.min_order_amount) {
      const min = (coupon.min_order_amount / 100).toFixed(0)
      return NextResponse.json({
        valid: false,
        error: `Orden mínima de $${min} MXN`,
      } satisfies ValidateCouponResponse)
    }

    const discount_amount = coupon.type === 'percentage'
      ? Math.round(subtotal * (coupon.value / 100))
      : coupon.value

    return NextResponse.json({
      valid: true,
      discount_amount,
      coupon,
    } satisfies ValidateCouponResponse)
  } catch {
    return NextResponse.json({ valid: false, error: 'Error interno' } satisfies ValidateCouponResponse, { status: 500 })
  }
}
