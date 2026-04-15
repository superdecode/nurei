import { SupabaseClient } from '@supabase/supabase-js'
import type { InventoryMovement } from '@/types'

export async function getInventoryMovements(
  supabase: SupabaseClient,
  productId?: string,
  limit = 50
): Promise<InventoryMovement[]> {
  let query = supabase
    .from('inventory_movements')
    .select('*, product:products(id, name, slug, sku, image_url)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (productId) {
    query = query.eq('product_id', productId)
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
    : -Math.abs(movement.quantity)

  try {
    await supabase.rpc('increment_stock', {
      p_product_id: movement.product_id,
      p_delta: delta,
    })
  } catch {
    // Fallback: manual update if RPC doesn't exist
    const { data: prod } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', movement.product_id)
      .single()
    if (prod) {
      await supabase
        .from('products')
        .update({ stock_quantity: ((prod as { stock_quantity?: number }).stock_quantity ?? 0) + delta })
        .eq('id', movement.product_id)
    }
  }

  return data as InventoryMovement
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
