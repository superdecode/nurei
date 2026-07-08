import { NextRequest, NextResponse } from 'next/server'
import { getCheckoutOrder } from '@/lib/server/checkout-session-store'
import { getAccessibleOrder } from '@/lib/server/order-access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const publicToken = request.nextUrl.searchParams.get('token')
    const dbOrder = await getAccessibleOrder(id, publicToken)
    if (dbOrder) {
      return NextResponse.json({
        data: {
          id: dbOrder.id,
          public_access_token: dbOrder.public_access_token,
          order_number: dbOrder.short_id,
          created_at: dbOrder.created_at,
          estimated_delivery: dbOrder.delivered_at ?? null,
          shipping_fee: dbOrder.shipping_fee,
          subtotal: dbOrder.subtotal,
          coupon_discount: dbOrder.coupon_discount,
          total: dbOrder.total,
          items: dbOrder.items,
          customer: {
            full_name: dbOrder.customer_name,
            email: dbOrder.customer_email,
            phone: dbOrder.customer_phone,
            delivery_address: dbOrder.delivery_address,
          },
        },
      })
    }

    const cached = getCheckoutOrder(id, publicToken)
    if (!cached) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        id: cached.id,
        public_access_token: cached.publicAccessToken,
        order_number: cached.shortId,
        created_at: cached.createdAt,
        estimated_delivery: cached.shippingMethod.estimatedDate,
        shipping_fee: cached.shippingMethod.price,
        subtotal: cached.subtotal,
        coupon_discount: cached.couponDiscount,
        total: cached.total,
        items: cached.items.map((item) => ({
          product_id: item.productId,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal,
        })),
        customer: {
          full_name: cached.customerName,
          email: cached.customerEmail,
          phone: cached.customerPhone,
          delivery_address: `${cached.shippingAddress.address}, ${cached.shippingAddress.city}, ${cached.shippingAddress.state}, ${cached.shippingAddress.zipCode}`,
        },
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'No pudimos obtener la confirmación del pedido' },
      { status: 500 }
    )
  }
}
