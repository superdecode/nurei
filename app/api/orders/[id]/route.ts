import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrderUpdates } from '@/lib/supabase/queries/userOrders'
import { getAccessibleOrder } from '@/lib/server/order-access'

// Public endpoint — order ID (UUID) acts as the access token (tracking-link model)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    const publicToken = request.nextUrl.searchParams.get('token')
    const order = await getAccessibleOrder(id, publicToken)
    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    const supabase = createServiceClient()
    const updates = await getOrderUpdates(supabase, id)
    return NextResponse.json({ data: { order, updates } })
  } catch {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
}
