import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getInventoryMovements, createInventoryMovement, bulkUpdateStock } from '@/lib/supabase/queries/inventory'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('product_id') ?? undefined
    const limit = Number(searchParams.get('limit') ?? '50')

    const movements = await getInventoryMovements(supabase, productId, limit)
    return NextResponse.json({ data: movements })
  } catch {
    return NextResponse.json({ data: [], error: 'Error fetching inventory' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()

    // Bulk update
    if (Array.isArray(body.updates)) {
      await bulkUpdateStock(supabase, body.updates, body.created_by)
      return NextResponse.json({ success: true })
    }

    // Single movement
    const movement = await createInventoryMovement(supabase, body)
    return NextResponse.json({ data: movement })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error updating inventory'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
