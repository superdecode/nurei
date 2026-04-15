import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrderById, getOrderUpdates } from '@/lib/supabase/queries/userOrders'
import { MOCK_USER_ORDERS, MOCK_ORDER_UPDATES } from '@/lib/data/mockOrders'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Try Supabase first
    try {
      const supabase = await createServerSupabaseClient()
      const order = await getOrderById(supabase, id)
      const updates = await getOrderUpdates(supabase, id)
      return NextResponse.json({ data: { order, updates } })
    } catch {
      // Fall back to mock data when Supabase is not configured
    }

    // Mock fallback
    const order = MOCK_USER_ORDERS.find((o) => o.id === id || o.short_id === id)
    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    return NextResponse.json({
      data: {
        order,
        updates: MOCK_ORDER_UPDATES[order.id] ?? [],
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error al obtener pedido' }, { status: 500 })
  }
}
