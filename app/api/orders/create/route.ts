import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { saveCheckoutOrder } from '@/lib/server/checkout-session-store'
import { createInventoryMovement } from '@/lib/supabase/queries/inventory'
import {
  createOrderPayloadSchema,
  formatCreateOrderPayloadErrors,
} from '@/lib/validations/order-create-payload'
import { registerCouponUsage, validateCoupon } from '@/lib/server/coupons/engine'
import { getReferralLinkIdFromHeader } from '@/lib/affiliate/cookie'

/** Human-readable unique order number; avoids collisions vs. weak random 4-digit IDs. */
function generateShortOrderId(): string {
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `NUR-${suffix}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createOrderPayloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: formatCreateOrderPayloadErrors(parsed.error),
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const payload = parsed.data
    const productIds = payload.items.map((item) => item.product_id)

    let dbProducts:
      | Array<{
          id: string
          name: string
          price: number
          base_price: number | null
          category: string
          stock_quantity: number
          track_inventory: boolean
          allow_backorder: boolean
          is_active: boolean
          status: string
        }>
      | null = null

    try {
      const service = createServiceClient()
      const { data } = await service
        .from('products')
        .select('id, name, price, base_price, category, stock_quantity, track_inventory, allow_backorder, is_active, status')
        .in('id', productIds)

      dbProducts = data ?? null
    } catch {
      dbProducts = null
    }

    if (!dbProducts) {
      return NextResponse.json(
        { error: 'No pudimos validar inventario en este momento' },
        { status: 503 }
      )
    }

    const stockErrors: Array<{
      product_id: string
      product_name: string
      requested: number
      available: number
    }> = []

    let subtotal = 0
    const orderItems: Array<{
      productId: string
      name: string
      category: string
      quantity: number
      unitPrice: number
      subtotal: number
    }> = []

    for (const line of payload.items) {
      const product = dbProducts.find((entry) => entry.id === line.product_id)
      if (!product || (!product.is_active && product.status !== 'active')) {
        stockErrors.push({
          product_id: line.product_id,
          product_name: product?.name ?? 'Producto no disponible',
          requested: line.quantity,
          available: 0,
        })
        continue
      }

      if (
        product.track_inventory &&
        !product.allow_backorder &&
        product.stock_quantity < line.quantity
      ) {
        stockErrors.push({
          product_id: product.id,
          product_name: product.name,
          requested: line.quantity,
          available: product.stock_quantity,
        })
        continue
      }

      const unitPrice = product.base_price ?? product.price
      const lineSubtotal = unitPrice * line.quantity
      subtotal += lineSubtotal
      orderItems.push({
        productId: product.id,
        name: product.name,
        category: product.category,
        quantity: line.quantity,
        unitPrice,
        subtotal: lineSubtotal,
      })
    }

    if (stockErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'stock_unavailable',
          message: 'Uno o más productos ya no tienen inventario suficiente.',
          products: stockErrors,
        },
        { status: 409 }
      )
    }

    let couponCode: string | null = null
    let couponDiscount = 0
    let couponId: string | null = null
    let couponSnapshot: Record<string, unknown> | null = null
    if (payload.coupon_code) {
      const result = await validateCoupon({
        code: payload.coupon_code,
        subtotal,
        shippingFee: payload.shipping.fee,
        customerEmail: payload.customer.email ?? null,
        customerPhone: payload.customer.phone ?? null,
        items: orderItems.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal,
          category: item.category,
        })),
      })
      if (!result.valid) {
        return NextResponse.json({ error: result.reason }, { status: result.status })
      }
      couponCode = result.code
      couponDiscount = result.discountAmount
      couponId = result.couponId
      couponSnapshot = result.snapshot
    }

    const total = Math.max(0, subtotal + payload.shipping.fee - couponDiscount)

    // Capture referral link from the customer's cookie NOW — it won't be available later
    // (e.g. when admin confirms a cash order days later).
    const referralLinkId = getReferralLinkIdFromHeader(request.headers.get('cookie'))

    const supabaseSession = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabaseSession.auth.getUser()

    const service = createServiceClient()

    let createdOrderId: string | null = null
    let shortId = ''

    const insertPayloadBase = {
      user_id: user?.id ?? null,
      customer_name: payload.customer.full_name,
      customer_phone: payload.customer.phone,
      customer_email: payload.customer.email,
      delivery_address: `${payload.shipping.address}, ${payload.shipping.city}, ${payload.shipping.state}, ${payload.shipping.zip_code}, ${payload.shipping.country}`,
      items: orderItems.map((item) => ({
        product_id: item.productId,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.subtotal,
      })),
      subtotal,
      shipping_fee: payload.shipping.fee,
      coupon_code: couponCode,
      coupon_discount: couponDiscount,
      coupon_snapshot: couponSnapshot,
      discount: 0,
      total,
      status: 'pending',
      payment_status: 'pending',
      source: 'web-checkout',
      payment_method: payload.payment_method,
      referral_link_id: referralLinkId ?? null,
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      shortId = generateShortOrderId()
      const { data: order, error: orderError } = await service
        .from('orders')
        .insert({
          ...insertPayloadBase,
          short_id: shortId,
        })
        .select('id')
        .single()

      if (!orderError && order?.id) {
        createdOrderId = order.id
        break
      }

      const msg = orderError?.message ?? ''
      const code = (orderError as { code?: string })?.code
      if (code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
        continue
      }

      console.error('[orders/create] insert failed:', orderError)
      return NextResponse.json(
        { error: msg || 'No pudimos registrar el pedido en la base de datos.' },
        { status: 500 }
      )
    }

    if (!createdOrderId) {
      return NextResponse.json(
        { error: 'No pudimos generar un número de pedido único. Intenta de nuevo.' },
        { status: 500 }
      )
    }

    if (couponId && couponCode) {
      try {
        await registerCouponUsage({
          couponId,
          orderId: createdOrderId,
          customerEmail: payload.customer.email ?? null,
          customerPhone: payload.customer.phone ?? null,
          discountAmount: couponDiscount,
          snapshot: couponSnapshot ?? { code: couponCode },
        })
      } catch (e) {
        console.error('[orders/create] coupon usage:', e)
      }
    }

    try {
      for (const item of orderItems) {
        const productDb = dbProducts.find((entry) => entry.id === item.productId)
        if (!productDb?.track_inventory) continue

        await createInventoryMovement(createServiceClient(), {
          product_id: item.productId,
          type: 'venta',
          quantity: -Math.abs(item.quantity),
          reason: `Salida por pedido ${shortId}`,
          reference: shortId,
        })
      }
    } catch (invErr) {
      console.error('[orders/create] inventory movement failed (order persisted):', invErr)
    }

    saveCheckoutOrder({
      id: createdOrderId,
      shortId,
      createdAt: new Date().toISOString(),
      customerName: payload.customer.full_name,
      customerEmail: payload.customer.email,
      customerPhone: payload.customer.phone,
      shippingAddress: {
        fullName: payload.customer.full_name,
        email: payload.customer.email,
        phone: payload.customer.phone,
        address: payload.shipping.address,
        city: payload.shipping.city,
        state: payload.shipping.state,
        zipCode: payload.shipping.zip_code,
        country: payload.shipping.country,
      },
      shippingMethod: {
        id: payload.shipping.method_id,
        label: payload.shipping.method_label,
        price: payload.shipping.fee,
        etaLabel: payload.shipping.eta_label,
        estimatedDate: payload.shipping.estimated_date,
      },
      paymentMethod: payload.payment_method,
      items: orderItems,
      couponCode,
      couponDiscount,
      subtotal,
      total,
    })

    return NextResponse.json({
      data: {
        order_id: createdOrderId,
        short_id: shortId,
        subtotal,
        shipping_fee: payload.shipping.fee,
        coupon_discount: couponDiscount,
        coupon_snapshot: couponSnapshot,
        total,
      },
    })
  } catch (err) {
    console.error('[orders/create]', err)
    return NextResponse.json(
      { error: 'No pudimos crear tu pedido. Intenta nuevamente.' },
      { status: 500 }
    )
  }
}
