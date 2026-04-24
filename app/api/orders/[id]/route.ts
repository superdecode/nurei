import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrderById, getOrderUpdates } from '@/lib/supabase/queries/userOrders'

// Public endpoint — order ID (UUID) acts as the access token (tracking-link model)
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    const supabase = createServiceClient()
    const order = await getOrderById(supabase, id)
    const updates = await getOrderUpdates(supabase, id)
    return NextResponse.json({ data: { order, updates } })
  } catch {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
}
