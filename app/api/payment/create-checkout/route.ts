import { NextRequest, NextResponse } from 'next/server'
import { getStripeServer } from '@/lib/stripe/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAccessibleOrder } from '@/lib/server/order-access'

export async function POST(request: NextRequest) {
  try {
    const { order_id, public_access_token } = await request.json()

    if (!order_id) {
      return NextResponse.json({ error: 'order_id requerido' }, { status: 400 })
    }

    const order = await getAccessibleOrder(order_id, public_access_token)
    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    const supabase = createServiceClient()

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

    // Add shipping as a line item using the stored shipping_fee on the order
    // Avoid deriving from totals to prevent negative unit_amount when coupon >= shipping cost
    const shippingFee = Math.max(0, order.shipping_fee ?? 0)
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
      ...(order.customer_email ? { customer_email: order.customer_email } : {}),
      line_items: lineItems,
      payment_intent_data: {
        metadata: {
          order_id: order.id,
          short_id: order.short_id,
          customer_name: order.customer_name ?? '',
          ...(referralLinkId ? { referral_link_id: referralLinkId } : {}),
        },
      },
      ...(order.coupon_discount > 0
        ? {
            discounts: [
              {
                coupon: await getOrCreateStripeCoupon(stripe, order.coupon_discount, order.id),
              },
            ],
          }
        : {}),
      success_url: `${appUrl}/pedido/${order.id}?success=true&token=${order.public_access_token}`,
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
 * Creates a per-order Stripe coupon so it cannot be reused across sessions.
 * Each order gets its own unique coupon ID keyed to the order UUID.
 */
async function getOrCreateStripeCoupon(
  stripe: ReturnType<typeof getStripeServer>,
  discountAmount: number,
  orderId: string
): Promise<string> {
  const couponId = `disc_${orderId}`
  try {
    const existing = await stripe.coupons.retrieve(couponId)
    return existing.id
  } catch (err: unknown) {
    // Only proceed if the coupon genuinely doesn't exist (404); re-throw other errors
    const stripeErr = err as { statusCode?: number }
    if (stripeErr?.statusCode !== 404) throw err
  }

  const coupon = await stripe.coupons.create({
    id: couponId,
    amount_off: Math.round(discountAmount),
    currency: 'mxn',
    duration: 'once',
    max_redemptions: 1,
    name: `Descuento orden ${orderId.slice(-8)}`,
  })

  return coupon.id
}
