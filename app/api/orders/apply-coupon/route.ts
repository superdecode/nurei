import { NextRequest, NextResponse } from 'next/server'
import { validateCoupon } from '@/lib/server/coupons/engine'

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

    const items = Array.isArray(body?.items)
      ? body.items.map((item: {
        product_id: string
        quantity: number
        unit_price: number
        subtotal: number
        category?: string
      }) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        subtotal: Number(item.subtotal ?? 0),
        category: item.category ?? null,
      }))
      : []

    const result = await validateCoupon({
      code,
      subtotal,
      shippingFee,
      items,
      customerEmail: body?.customerEmail ?? null,
      customerPhone: body?.customerPhone ?? null,
    })

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.reason }, { status: result.status })
    }

    return NextResponse.json({
      valid: true,
      code: result.code,
      discount_amount: result.discountAmount,
      eligible_subtotal: result.eligibleSubtotal,
      coupon_status: result.status,
      coupon_snapshot: result.snapshot,
    })
  } catch {
    return NextResponse.json(
      { valid: false, error: 'No pudimos validar el cupón' },
      { status: 500 }
    )
  }
}
