import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { saveCheckoutOrder } from '@/lib/server/checkout-session-store'
import { createInventoryMovement } from '@/lib/supabase/queries/inventory'

const createOrderPayloadSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().min(1),
        quantity: z.number().int().min(1).max(20),
      })
    )
    .min(1),
  coupon_code: z.string().optional(),
  customer: z.object({
    full_name: z.string().min(3),
    email: z.string().email(),
    phone: z.string().min(8),
  }),
  shipping: z.object({
    address: z.string().min(6),
    city: z.string().min(2),
    state: z.string().min(2),
    zip_code: z.string().min(4),
    country: z.string().min(2),
    method_id: z.enum(['standard', 'express', 'same_day']),
    method_label: z.string().min(2),
    fee: z.number().min(0),
    eta_label: z.string().min(2),
    estimated_date: z.string().min(8),
  }),
  payment_method: z.enum(['card', 'oxxo', 'transfer', 'wallet']),
})

const COUPON_RULES = {
  BIENVENIDO10: { type: 'percentage', value: 10, min: 20000 },
  NUREI150: { type: 'fixed', value: 15000, min: 50000 },
  ENVIOGRATIS: { type: 'free_shipping', value: 0, min: 30000 },
} as const

function applyCoupon(
  couponCode: string | undefined,
  subtotal: number,
  shippingFee: number
) {
  if (!couponCode) return { code: null, discount: 0 }

  const normalized = couponCode.trim().toUpperCase()
  const rule = COUPON_RULES[normalized as keyof typeof COUPON_RULES]

  if (!rule || subtotal < rule.min) return { code: null, discount: 0 }
  if (rule.type === 'percentage') {
    return { code: normalized, discount: Math.round(subtotal * (rule.value / 100)) }
  }
  if (rule.type === 'fixed') {
    return { code: normalized, discount: rule.value }
  }

  return { code: normalized, discount: shippingFee }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createOrderPayloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos del pedido inválidos', details: parsed.error.flatten() },
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
          stock_quantity: number
          track_inventory: boolean
          allow_backorder: boolean
          is_active: boolean
          status: string
        }>
      | null
      = null

    try {
      const service = createServiceClient()
      const { data } = await service
        .from('products')
        .select('id, name, price, base_price, stock_quantity, track_inventory, allow_backorder, is_active, status')
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

    const couponResult = applyCoupon(payload.coupon_code, subtotal, payload.shipping.fee)
    const total = Math.max(0, subtotal + payload.shipping.fee - couponResult.discount)
    const shortId = `NUR-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`

    let createdOrderId: string | null = null

    try {
      const supabase = await createServerSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data: order } = await supabase
        .from('orders')
        .insert({
          short_id: shortId,
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
          coupon_code: couponResult.code,
          coupon_discount: couponResult.discount,
          discount: 0,
          total,
          status: 'pending',
          payment_status: 'pending',
          source: 'web-checkout',
        })
        .select('id')
        .single()

      createdOrderId = order?.id ?? null

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
    } catch {
      createdOrderId = null
    }

    const orderId = createdOrderId ?? `order_${Date.now()}`

    saveCheckoutOrder({
      id: orderId,
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
      couponCode: couponResult.code,
      couponDiscount: couponResult.discount,
      subtotal,
      total,
    })

    return NextResponse.json({
      data: {
        order_id: orderId,
        short_id: shortId,
        subtotal,
        shipping_fee: payload.shipping.fee,
        coupon_discount: couponResult.discount,
        total,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'No pudimos crear tu pedido. Intenta nuevamente.' },
      { status: 500 }
    )
  }
}
