import { NextRequest, NextResponse } from 'next/server'
import { getStripeServer } from '@/lib/stripe/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { order_id } = await request.json()

    if (!order_id) {
      return NextResponse.json({ error: 'order_id requerido' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Fetch the order from the database
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, short_id, total, payment_status, items, customer_name, coupon_discount')
      .eq('id', order_id)
      .single()

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ error: 'Pedido ya pagado' }, { status: 400 })
    }

    const stripe = getStripeServer()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Build line items from the order
    const lineItems = (order.items as Array<{ name: string; quantity: number; unit_price: number; subtotal: number }>).map(
      (item) => ({
        price_data: {
          currency: 'mxn',
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.unit_price), // amounts are already in centavos
        },
        quantity: item.quantity,
      })
    )

    // Add shipping as a line item if the order total exceeds the sum of item subtotals
    const itemsTotal = (order.items as Array<{ subtotal: number }>).reduce(
      (sum, item) => sum + item.subtotal,
      0
    )
    const shippingFee = order.total - itemsTotal + (order.coupon_discount ?? 0)
    if (shippingFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'mxn',
          product_data: {
            name: 'Envío',
          },
          unit_amount: Math.round(shippingFee),
        },
        quantity: 1,
      })
    }

    // If there's a coupon discount, add it as a negative line item (Stripe requires adjustment via discounts)
    // Stripe Checkout supports discounts via coupons — but for simplicity we adjust the total directly
    // by using a single line-item approach if there are discounts

    // Forward referral cookie so webhook can attribute the order
    const referralLinkId = request.cookies.get('_nurei_ref')?.value ?? null

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      ...(order.coupon_discount > 0
        ? {
            discounts: [
              {
                coupon: await getOrCreateStripeCoupon(stripe, order.coupon_discount),
              },
            ],
          }
        : {}),
      success_url: `${appUrl}/pedido/${order.id}?success=true`,
      cancel_url: `${appUrl}/checkout?step=3`,
      metadata: {
        order_id: order.id,
        short_id: order.short_id,
        customer_name: order.customer_name,
        ...(referralLinkId ? { referral_link_id: referralLinkId } : {}),
      },
    })

    // Save the session ID on the order
    await supabase
      .from('orders')
      .update({
        stripe_checkout_session_id: session.id,
        payment_method: 'stripe_card',
      })
      .eq('id', order_id)

    return NextResponse.json({
      data: {
        checkout_url: session.url,
        session_id: session.id,
      },
    })
  } catch (error) {
    console.error('[create-checkout]', error)
    const message = error instanceof Error ? error.message : 'Error creando sesión de pago'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Creates (or returns cached) a one-time Stripe coupon for a fixed discount amount.
 * Since Stripe coupons are persistent, we create one per unique amount to avoid
 * proliferation. Amount is in centavos MXN.
 */
async function getOrCreateStripeCoupon(
  stripe: ReturnType<typeof getStripeServer>,
  discountAmount: number
): Promise<string> {
  const couponId = `order_disc_${discountAmount}`
  try {
    await stripe.coupons.retrieve(couponId)
    return couponId
  } catch {
    // Doesn't exist yet — create it
  }

  const coupon = await stripe.coupons.create({
    id: couponId,
    amount_off: Math.round(discountAmount),
    currency: 'mxn',
    duration: 'once',
    name: `Descuento (${discountAmount / 100} MXN)`,
  })

  return coupon.id
}
