import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    // TODO: Implement Stripe webhook verification
    // const event = stripe.webhooks.constructEvent(
    //   body,
    //   signature,
    //   process.env.STRIPE_WEBHOOK_SECRET!
    // )
    //
    // switch (event.type) {
    //   case 'checkout.session.completed': {
    //     const session = event.data.object
    //     const orderId = session.metadata?.order_id
    //     if (!orderId) break
    //
    //     await supabase.from('orders').update({
    //       payment_status: 'paid',
    //       paid_at: new Date().toISOString(),
    //       status: 'confirmed',
    //       confirmed_at: new Date().toISOString(),
    //       stripe_payment_intent_id: session.payment_intent,
    //     }).eq('id', orderId)
    //
    //     await supabase.from('order_updates').insert({
    //       order_id: orderId,
    //       status: 'confirmed',
    //       message: 'Pago confirmado via Stripe',
    //       updated_by: 'stripe_webhook',
    //     })
    //     break
    //   }
    //
    //   case 'payment_intent.payment_failed': {
    //     const intent = event.data.object
    //     // Handle failed payment
    //     break
    //   }
    // }

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
