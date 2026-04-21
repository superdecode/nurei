import { NextRequest, NextResponse } from 'next/server'
import { createOrderSchema } from '@/lib/validations/order'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { getUserOrders } from '@/lib/supabase/queries/userOrders'
import { getSettings } from '@/lib/supabase/queries/settings'
import { registerCouponUsage, validateCoupon } from '@/lib/server/coupons/engine'
import {
  computeStandardShippingFeeCents,
  normalizeShippingFromConfig,
} from '@/lib/store/normalize-checkout-settings'

// ─── GET: user's order history ───────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status') as import('@/types').OrderStatus | null

    const orders = await getUserOrders(supabase, user.id, status ?? undefined)
    return NextResponse.json({ data: orders })
  } catch {
    return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 })
  }
}

// ─── POST: create order ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createOrderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const {
      customer_phone, customer_email, customer_name,
      delivery_address, delivery_instructions, items, coupon_code,
    } = parsed.data

    // Validate items and calculate totals
    const productIds = items.map((i) => i.product_id)
    const supabaseService = createServiceClient()
    const { data: dbProducts } = await supabaseService
      .from('products')
      .select('id, name, price, base_price, is_active, status, images, primary_image_index, image_thumbnail_url')
      .in('id', productIds)

    let subtotal = 0
    const orderItems = items.map((item) => {
      const product = dbProducts?.find((p) => p.id === item.product_id)
      if (!product || (!product.is_active && product.status !== 'active')) {
        throw new Error(`Producto ${item.product_id} no disponible`)
      }
      const unitPrice = product.base_price ?? product.price
      const itemSubtotal = unitPrice * item.quantity
      subtotal += itemSubtotal
      const imgs = (product as { images?: string[] }).images ?? []
      const idx = (product as { primary_image_index?: number }).primary_image_index ?? 0
      const thumb =
        (product as { image_thumbnail_url?: string | null }).image_thumbnail_url
        ?? (imgs.length ? imgs[idx] ?? imgs[0] : null)
      return {
        product_id: product.id,
        name: product.name,
        image_url: thumb,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: itemSubtotal,
      }
    })

    const supabase = await createServerSupabaseClient()
    const appSettings = await getSettings(supabase)
    const normalizedShipping = normalizeShippingFromConfig(appSettings.shipping)
    const shippingFee = computeStandardShippingFeeCents(subtotal, normalizedShipping)
    let couponDiscount = 0
    let validatedCouponCode: string | null = null
    let validatedCouponId: string | null = null
    let couponSnapshot: Record<string, unknown> | null = null

    // Validate coupon if provided (server-side robust validator)
    if (coupon_code) {
      const result = await validateCoupon({
        code: coupon_code,
        subtotal,
        shippingFee,
        customerEmail: customer_email ?? null,
        customerPhone: customer_phone,
        items: orderItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        })),
      })
      if (!result.valid) {
        return NextResponse.json({ error: result.reason }, { status: result.status })
      }
      couponDiscount = result.discountAmount
      validatedCouponCode = result.code
      validatedCouponId = result.couponId
      couponSnapshot = result.snapshot
    }

    const total = subtotal + shippingFee - couponDiscount

    // Generate short ID
    const shortId = `NUR-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`

    // Try Supabase insert; fall back to mock if not configured
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          short_id: shortId,
          user_id: user?.id ?? null,
          customer_name: customer_name ?? null,
          customer_phone,
          customer_email: customer_email ?? null,
          delivery_address,
          delivery_instructions: delivery_instructions ?? null,
          items: orderItems,
          subtotal,
          shipping_fee: shippingFee,
          coupon_code: validatedCouponCode,
          coupon_discount: couponDiscount,
          coupon_snapshot: couponSnapshot,
          discount: 0,
          total,
          status: 'pending',
          payment_status: 'pending',
          source: 'web',
        })
        .select()
        .single()

      if (!error && order) {
        // Register coupon use if used
        if (validatedCouponCode && validatedCouponId) {
          await registerCouponUsage({
            couponId: validatedCouponId,
            orderId: order.id,
            customerEmail: customer_email ?? null,
            customerPhone: customer_phone,
            discountAmount: couponDiscount,
            snapshot: couponSnapshot ?? { code: validatedCouponCode },
          })
        }

        // Log initial status
        await supabase.from('order_updates').insert({
          order_id: order.id,
          status: 'pending',
          message: 'Pedido recibido, procesando pago.',
          updated_by: 'system',
        })

        return NextResponse.json({
          data: {
            order_id: order.id,
            short_id: order.short_id,
            subtotal,
            shipping_fee: shippingFee,
            coupon_discount: couponDiscount,
            total,
          },
        })
      }
    } catch {
      // Supabase not configured — return mock response
    }

    // Mock fallback
    return NextResponse.json({
      data: {
        order_id: `order-${Date.now()}`,
        short_id: shortId,
        subtotal,
        shipping_fee: shippingFee,
        coupon_discount: couponDiscount,
        total,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
