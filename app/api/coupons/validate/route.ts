import { NextRequest, NextResponse } from 'next/server'
import type { ValidateCouponResponse } from '@/types'
import { validateCoupon } from '@/lib/server/coupons/engine'
import { rateLimit, getClientIp } from '@/lib/server/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const rl = rateLimit(`coupons-validate:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { valid: false, error: 'Demasiados intentos. Intenta en un momento.' } satisfies ValidateCouponResponse,
      { status: 429 }
    )
  }

  try {
    const { code, subtotal, shippingFee } = await request.json()

    if (!code || typeof code !== 'string' || typeof subtotal !== 'number') {
      return NextResponse.json(
        { valid: false, error: 'Datos inválidos' } satisfies ValidateCouponResponse
      )
    }

    const result = await validateCoupon({
      code: code.trim().toUpperCase(),
      subtotal,
      shippingFee: typeof shippingFee === 'number' ? shippingFee : 0,
      customerEmail: null,
      customerPhone: null,
      items: [],
    })

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.reason } satisfies ValidateCouponResponse)
    }

    return NextResponse.json({
      valid: true,
      discount_amount: result.discountAmount,
      coupon: result.snapshot as unknown as ValidateCouponResponse['coupon'],
    } satisfies ValidateCouponResponse)
  } catch {
    return NextResponse.json(
      { valid: false, error: 'Error interno' } satisfies ValidateCouponResponse,
      { status: 500 }
    )
  }
}
