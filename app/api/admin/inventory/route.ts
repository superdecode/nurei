import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getInventoryMovements,
  createInventoryMovement,
  bulkUpdateStock,
  getInventoryProductsSnapshot,
} from '@/lib/supabase/queries/inventory'

const movementSchema = z.object({
  product_id: z.string().uuid(),
  type: z.enum(['entrada', 'salida', 'ajuste', 'venta', 'devolucion']),
  quantity: z.number().int(),
  reason: z.string().trim().max(200).optional(),
  reference: z.string().trim().max(120).optional(),
  created_by: z.string().uuid().optional(),
})

const bulkSchema = z.object({
  updates: z.array(
    z.object({
      product_id: z.string().uuid(),
      stock_quantity: z.number().int().min(0),
    })
  ),
  created_by: z.string().uuid().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('product_id') ?? undefined
    const type = (searchParams.get('type') as import('@/types').InventoryMovementType | null) ?? undefined
    const parsedLimit = Number(searchParams.get('limit') ?? '50')
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 50
    const from = searchParams.get('from') ?? undefined
    const to = searchParams.get('to') ?? undefined
    const includeProducts = searchParams.get('include_products') === 'true'
    const search = searchParams.get('search') ?? undefined
    const lowStockOnly = searchParams.get('low_stock_only') === 'true'

    let movements: import('@/types').InventoryMovement[] = []
    try {
      movements = await getInventoryMovements(supabase, {
        productId,
        type,
        limit,
        from,
        to,
      })
    } catch {
      // movements table may be empty or missing — products still load
    }

    let products: unknown[] = []
    let salesByProduct: Record<string, number> = {}
    let recentEntriesByProduct: Record<string, number> = {}
    if (includeProducts) {
      products = await getInventoryProductsSnapshot(supabase, {
        search,
        lowStockOnly,
        limit: 500,
      })

      const productIds = (products as Array<{ id: string }>).map((p) => p.id)
      if (productIds.length > 0) {
        const fromLast30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const { data: salesRows } = await supabase
          .from('inventory_movements')
          .select('product_id, quantity')
          .in('product_id', productIds)
          .eq('type', 'venta')
          .gte('created_at', fromLast30)

        const { data: entriesRows } = await supabase
          .from('inventory_movements')
          .select('product_id, quantity')
          .in('product_id', productIds)
          .in('type', ['entrada', 'devolucion', 'ajuste'])
          .gte('created_at', fromLast30)

        salesByProduct = (salesRows ?? []).reduce((acc, row) => {
          acc[row.product_id] = (acc[row.product_id] ?? 0) + Math.abs(row.quantity)
          return acc
        }, {} as Record<string, number>)

        recentEntriesByProduct = (entriesRows ?? []).reduce((acc, row) => {
          acc[row.product_id] = (acc[row.product_id] ?? 0) + Math.max(0, row.quantity)
          return acc
        }, {} as Record<string, number>)

        products = (products as Array<Record<string, unknown>>).map((product) => ({
          ...product,
          sold_30d: salesByProduct[product.id as string] ?? 0,
          entries_30d: recentEntriesByProduct[product.id as string] ?? 0,
        }))
      }
    }

    const summary = movements.reduce(
      (acc, movement) => {
        if (['entrada', 'devolucion'].includes(movement.type)) {
          acc.total_in += Math.abs(movement.quantity)
        }
        if (['salida', 'venta'].includes(movement.type)) {
          acc.total_out += Math.abs(movement.quantity)
        }
        if (movement.type === 'ajuste') {
          acc.total_adjustments += movement.quantity
        }
        return acc
      },
      { total_in: 0, total_out: 0, total_adjustments: 0 }
    )

    return NextResponse.json({ data: { movements, products, summary } })
  } catch {
    return NextResponse.json(
      { data: { movements: [], products: [], summary: { total_in: 0, total_out: 0, total_adjustments: 0 } }, error: 'Error fetching inventory' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()

    // Bulk update
    if (Array.isArray(body.updates)) {
      const parsed = bulkSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Payload inválido', details: parsed.error.flatten() }, { status: 400 })
      }
      await bulkUpdateStock(supabase, parsed.data.updates, parsed.data.created_by)
      return NextResponse.json({ success: true })
    }

    // Single movement
    const parsed = movementSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload inválido', details: parsed.error.flatten() }, { status: 400 })
    }
    const movement = await createInventoryMovement(supabase, parsed.data)
    return NextResponse.json({ data: movement })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error updating inventory'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
