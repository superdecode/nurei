import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

const bulkSchema = z.object({
  product_ids: z.array(z.string().uuid()).min(1),
  action: z.enum(['deactivate', 'activate', 'apply_discount', 'set_low_stock_threshold', 'set_stock_quantity', 'adjust_stock']),
  value: z.number().optional(),
  note: z.string().max(200).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin()
    if (adminCheck.error) return adminCheck.error

    const body = await request.json()
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload inválido', details: parsed.error.flatten() }, { status: 400 })
    }

    const { product_ids, action, value, note } = parsed.data
    const supabase = createServiceClient()
    const internalRef = `INV-BULK-${Date.now()}`

    if (action === 'deactivate') {
      await supabase.from('products').update({ is_active: false, status: 'archived' }).in('id', product_ids)
      return NextResponse.json({ data: { updated: product_ids.length } })
    }

    if (action === 'activate') {
      await supabase.from('products').update({ is_active: true, status: 'active' }).in('id', product_ids)
      return NextResponse.json({ data: { updated: product_ids.length } })
    }

    if (action === 'set_low_stock_threshold') {
      if (value === undefined || value < 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
      await supabase.from('products').update({ low_stock_threshold: Math.round(value) }).in('id', product_ids)
      return NextResponse.json({ data: { updated: product_ids.length } })
    }

    const { data: products, error } = await supabase
      .from('products')
      .select('id, base_price, price, stock_quantity')
      .in('id', product_ids)

    if (error || !products) {
      return NextResponse.json({ error: 'No se pudieron cargar los productos' }, { status: 400 })
    }

    for (const product of products) {
      if (action === 'apply_discount') {
        if (value === undefined || value <= 0 || value >= 100) continue
        const current = product.base_price ?? product.price
        const next = Math.round(current * (1 - value / 100))
        await supabase
          .from('products')
          .update({ compare_at_price: current, base_price: next, price: next })
          .eq('id', product.id)
      }

      if (action === 'set_stock_quantity') {
        if (value === undefined || value < 0) continue
        const nextStock = Math.round(value)
        const diff = nextStock - (product.stock_quantity ?? 0)
        await supabase.from('products').update({ stock_quantity: nextStock }).eq('id', product.id)
        if (diff !== 0) {
          await supabase.from('inventory_movements').insert({
            product_id: product.id,
            type: 'ajuste',
            quantity: diff,
            reason: note?.trim() || 'Ajuste masivo desde productos',
            reference: internalRef,
            created_by: adminCheck.userId,
          })
        }
      }

      if (action === 'adjust_stock') {
        if (value === undefined || value === 0) continue
        const diff = Math.round(value)
        const nextStock = Math.max(0, (product.stock_quantity ?? 0) + diff)
        const finalDiff = nextStock - (product.stock_quantity ?? 0)
        await supabase.from('products').update({ stock_quantity: nextStock }).eq('id', product.id)
        if (finalDiff !== 0) {
          await supabase.from('inventory_movements').insert({
            product_id: product.id,
            type: 'ajuste',
            quantity: finalDiff,
            reason: note?.trim() || 'Ajuste masivo desde productos',
            reference: internalRef,
            created_by: adminCheck.userId,
          })
        }
      }
    }

    return NextResponse.json({ data: { updated: products.length } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error ejecutando acción masiva'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
