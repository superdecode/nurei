import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { order_id } = await request.json()

    if (!order_id) {
      return NextResponse.json({ error: 'order_id requerido' }, { status: 400 })
    }

    // TODO: Implement with Stripe
    // const order = await getOrder(order_id)
    // if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    // if (order.payment_status === 'paid') return NextResponse.json({ error: 'Pedido ya pagado' }, { status: 400 })
    //
    // const session = await stripe.checkout.sessions.create({
    //   payment_method_types: ['card'],
    //   line_items: [{
    //     price_data: {
    //       currency: 'mxn',
    //       product_data: { name: `Pedido InBreve ${order.short_id}` },
    //       unit_amount: order.total,
    //     },
    //     quantity: 1,
    //   }],
    //   mode: 'payment',
    //   success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pedido/${order.id}?success=true`,
    //   cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout`,
    //   metadata: { order_id: order.id, short_id: order.short_id },
    // })
    //
    // await supabase.from('orders').update({ stripe_checkout_session_id: session.id }).eq('id', order.id)
    //
    // return NextResponse.json({ data: { checkout_url: session.url, session_id: session.id } })

    // Mock response — in dev, checkout goes directly to tracking
    return NextResponse.json({
      data: {
        checkout_url: null, // No Stripe URL in dev
        session_id: `mock_session_${Date.now()}`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error creando sesión de pago'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
