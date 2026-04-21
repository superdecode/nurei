import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

/** Lazy-init: avoid instantiating Stripe at module load (breaks build when STRIPE_SECRET_KEY is unset). */
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2026-02-25.clover' })
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    const stripe = getStripe()
    if (!stripe || !webhookSecret) {
      return NextResponse.json({ error: 'Stripe no configurado' }, { status: 503 })
    }

    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    )

    const supabase = createServiceClient()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orderId = session.metadata?.order_id
        if (!orderId) break

        await supabase.from('orders').update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          status: 'paid',
          confirmed_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent as string,
        }).eq('id', orderId)

        await supabase.from('order_updates').insert({
          order_id: orderId,
          status: 'paid',
          message: 'Pago confirmado: pedido en pendiente de aceptación',
          updated_by: 'stripe_webhook',
          metadata: { event: 'payment_confirmed' },
        })

        const { data: order } = await supabase
          .from('orders')
          .select('total, coupon_code')
          .eq('id', orderId)
          .single()

        if (order) {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
          fetch(`${baseUrl}/api/affiliate/attribution`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              orderTotalCents: order.total,
              couponCode: order.coupon_code ?? null,
              // cookie-based attribution: pass referral_link_id stored in checkout session metadata
              cookieHeader: session.metadata?.referral_link_id
                ? `_nurei_ref=${session.metadata.referral_link_id}`
                : null,
            }),
          }).catch(() => {})
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent
        const orderId = intent.metadata?.order_id
        if (orderId) {
          await supabase.from('orders').update({
            payment_status: 'failed',
            status: 'failed',
          }).eq('id', orderId)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
