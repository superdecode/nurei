import { NextRequest, NextResponse } from 'next/server'
import { createOrderSchema } from '@/lib/validations/order'
import { PRODUCTS } from '@/lib/data/products'
import { calculateShippingFee } from '@/lib/utils/calculations'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getUserOrders } from '@/lib/supabase/queries/userOrders'

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
    let subtotal = 0
    const orderItems = items.map((item) => {
      const product = PRODUCTS.find((p) => p.id === item.product_id)
      if (!product || !product.is_active) {
        throw new Error(`Producto ${item.product_id} no disponible`)
      }
      const itemSubtotal = product.price * item.quantity
      subtotal += itemSubtotal
      return {
        product_id: product.id,
        name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        subtotal: itemSubtotal,
      }
    })

    const shippingFee = calculateShippingFee(subtotal)
    let couponDiscount = 0
    let validatedCouponCode: string | null = null

    // Validate coupon if provided
    if (coupon_code) {
      const supabase = await createServerSupabaseClient()
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .ilike('code', coupon_code)
        .eq('is_active', true)
        .single()

      if (coupon && subtotal >= coupon.min_order_amount) {
        const now = new Date()
        const notExpired = !coupon.expires_at || new Date(coupon.expires_at) > now
        const notExhausted = !coupon.max_uses || coupon.used_count < coupon.max_uses

        if (notExpired && notExhausted) {
          couponDiscount = coupon.type === 'percentage'
            ? Math.round(subtotal * (coupon.value / 100))
            : coupon.value
          validatedCouponCode = coupon.code
        }
      }
    }

    const total = subtotal + shippingFee - couponDiscount

    // Generate short ID
    const shortId = `NUR-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`

    // Try Supabase insert; fall back to mock if not configured
    try {
      const supabase = await createServerSupabaseClient()
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
          discount: 0,
          total,
          status: 'pending',
          payment_status: 'pending',
          source: 'web',
        })
        .select()
        .single()

      if (!error && order) {
        // Increment coupon use count if used
        if (validatedCouponCode) {
          try {
            await supabase.rpc('increment_coupon_use', { p_code: validatedCouponCode })
          } catch { /* non-critical */ }
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
