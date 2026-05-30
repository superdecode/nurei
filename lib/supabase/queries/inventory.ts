import { SupabaseClient } from '@supabase/supabase-js'
import type { InventoryMovement } from '@/types'
import { computeStockStatus } from '@/lib/inventory/stock-status'

export async function getInventoryMovements(
  supabase: SupabaseClient,
  options: {
    productId?: string
    type?: InventoryMovement['type']
    limit?: number
    from?: string
    to?: string
  } = {}
): Promise<InventoryMovement[]> {
  const limit = options.limit ?? 50
  let query = supabase
    .from('inventory_movements')
    .select('*, product:products(id, name, slug, sku, image_url, stock_quantity, low_stock_threshold)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options.productId) {
    query = query.eq('product_id', options.productId)
  }
  if (options.type) {
    query = query.eq('type', options.type)
  }
  if (options.from) {
    query = query.gte('created_at', options.from)
  }
  if (options.to) {
    query = query.lte('created_at', options.to)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as InventoryMovement[]
}

export async function createInventoryMovement(
  supabase: SupabaseClient,
  movement: {
    product_id: string
    type: InventoryMovement['type']
    quantity: number
    reason?: string
    reference?: string
    created_by?: string
  }
): Promise<InventoryMovement> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .insert(movement)
    .select()
    .single()
  if (error) throw error

  // Update product stock
  const delta = ['entrada', 'devolucion'].includes(movement.type)
    ? Math.abs(movement.quantity)
    : movement.type === 'ajuste'
      ? movement.quantity
      : -Math.abs(movement.quantity)

  const { error: rpcError } = await supabase.rpc('increment_stock', {
    p_product_id: movement.product_id,
    p_delta: delta,
  })
  if (rpcError) {
    const { data: prod } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', movement.product_id)
      .single()
    if (prod) {
      const { error: updError } = await supabase
        .from('products')
        .update({ stock_quantity: ((prod as { stock_quantity?: number }).stock_quantity ?? 0) + delta })
        .eq('id', movement.product_id)
      if (updError) throw updError
    }
  }

  return data as InventoryMovement
}

export async function getInventoryProductsSnapshot(
  supabase: SupabaseClient,
  options: { search?: string; lowStockOnly?: boolean; limit?: number } = {}
) {
  let query = supabase
    .from('products')
    .select(
      'id, name, sku, category, base_price, price, stock_quantity, low_stock_threshold, track_inventory, allow_backorder, updated_at, is_active, status, images, primary_image_index, has_variants'
    )
    .order('updated_at', { ascending: false })
    .limit(options.limit ?? 500)

  if (options.search) {
    query = query.or(`name.ilike.%${options.search}%,sku.ilike.%${options.search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  const rows = data ?? []
  if (!options.lowStockOnly) return rows
  return rows.filter((row) => computeStockStatus(row) !== 'available')
}

export async function updateVariantStocks(
  supabase: SupabaseClient,
  productId: string,
  variants: Array<{ id: string; stock: number }>,
  createdBy?: string,
  reason?: string
): Promise<void> {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const r = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
  const reference = `INV-VAR-${d}-${r}`
  const adjustReason = reason ?? 'Ajuste de stock por variante'

  for (const v of variants) {
    const { data: current } = await supabase
      .from('product_variants')
      .select('stock')
      .eq('id', v.id)
      .eq('product_id', productId)
      .single()

    const currentStock = (current as { stock?: number } | null)?.stock ?? 0
    const delta = v.stock - currentStock
    if (delta === 0) continue

    await supabase
      .from('product_variants')
      .update({ stock: v.stock })
      .eq('id', v.id)

    await supabase.from('inventory_movements').insert({
      product_id: productId,
      type: 'ajuste',
      quantity: delta,
      reason: adjustReason,
      reference,
      created_by: createdBy ?? null,
    })
  }

  // Keep products.stock_quantity in sync with sum of active variant stocks
  const { data: allVariants } = await supabase
    .from('product_variants')
    .select('stock')
    .eq('product_id', productId)
    .eq('status', 'active')
  const total = ((allVariants ?? []) as Array<{ stock?: number }>).reduce((s, v) => s + (v.stock ?? 0), 0)
  await supabase.from('products').update({ stock_quantity: total }).eq('id', productId)
}

export async function bulkUpdateStock(
  supabase: SupabaseClient,
  updates: Array<{ product_id: string; stock_quantity: number }>,
  createdBy?: string
): Promise<void> {
  for (const update of updates) {
    // Get current stock
    const { data: product } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', update.product_id)
      .single()

    const currentStock = product?.stock_quantity ?? 0
    const diff = update.stock_quantity - currentStock

    if (diff !== 0) {
      // Create movement record
      await supabase.from('inventory_movements').insert({
        product_id: update.product_id,
        type: 'ajuste',
        quantity: diff,
        reason: 'Ajuste masivo de inventario',
        created_by: createdBy,
      })

      // Update stock
      await supabase
        .from('products')
        .update({ stock_quantity: update.stock_quantity })
        .eq('id', update.product_id)
    }
  }
}
