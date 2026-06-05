import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { createInventoryMovement } from '@/lib/supabase/queries/inventory'
import { requireAdmin } from '@/lib/server/require-admin'

const adjustSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().optional(),
  kind: z.enum(['entrada', 'salida', 'correccion']),
  /** Cantidad positiva a sumar (entrada) o restar (salida), o stock objetivo absoluto (correccion) */
  value: z.number().int().min(0),
  motivo: z.string().trim().min(1).max(120),
  nota: z.string().trim().max(200).optional(),
})

function refCode(prefix: string) {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const r = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, '0')
  return `${prefix}-${d}-${r}`
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {

    const body = await request.json()
    const parsed = adjustSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload inválido', details: parsed.error.flatten() }, { status: 400 })
    }

    const { product_id, variant_id, kind, value, motivo, nota } = parsed.data
    const supabase = createServiceClient()
    const reference = refCode('INV-MAN')
    const reason = [motivo, nota].filter(Boolean).join(' · ')

    // ── Variant-level adjustment ──────────────────────────────────────────────
    if (variant_id) {
      const { data: variant, error: vErr } = await supabase
        .from('product_variants')
        .select('id, stock')
        .eq('id', variant_id)
        .eq('product_id', product_id)
        .single()
      if (vErr || !variant) return NextResponse.json({ error: 'Variante no encontrada' }, { status: 404 })

      let newStock: number
      if (kind === 'entrada') {
        if (value <= 0) return NextResponse.json({ error: 'La entrada debe ser mayor a 0' }, { status: 400 })
        newStock = (variant.stock ?? 0) + value
      } else if (kind === 'salida') {
        if (value <= 0) return NextResponse.json({ error: 'La salida debe ser mayor a 0' }, { status: 400 })
        newStock = Math.max(0, (variant.stock ?? 0) - value)
      } else {
        newStock = value
      }

      const { error: updateErr } = await supabase
        .from('product_variants')
        .update({ stock: newStock })
        .eq('id', variant_id)
      if (updateErr) throw updateErr

      // Sync product.stock_quantity = sum of active variant stocks
      const { data: allVariants } = await supabase
        .from('product_variants')
        .select('stock')
        .eq('product_id', product_id)
        .eq('status', 'active')
      const totalStock = (allVariants ?? []).reduce((s, v) => s + (v.stock ?? 0), 0)
      await supabase.from('products').update({ stock_quantity: totalStock }).eq('id', product_id)

      await createInventoryMovement(supabase, {
        product_id,
        type: kind === 'entrada' ? 'entrada' : kind === 'salida' ? 'salida' : 'ajuste',
        quantity: kind === 'entrada' ? value : kind === 'salida' ? -Math.abs(value) : newStock - (variant.stock ?? 0),
        reason: `[Var] ${reason}`,
        reference,
        created_by: undefined,
      })

      return NextResponse.json({ data: { variant_id, newStock, totalStock } })
    }

    // ── Product-level adjustment ──────────────────────────────────────────────
    const { data: prod, error: pErr } = await supabase
      .from('products')
      .select('stock_quantity, has_variants')
      .eq('id', product_id)
      .single()
    if (pErr || !prod) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    if (prod.has_variants) {
      // Apply adjustment to each active variant equally, then sync parent
      const { data: variants } = await supabase
        .from('product_variants')
        .select('id, stock')
        .eq('product_id', product_id)
        .eq('status', 'active')

      const activeVariants = (variants ?? []) as Array<{ id: string; stock: number }>
      if (activeVariants.length === 0) {
        return NextResponse.json({ error: 'El producto tiene variantes pero ninguna está activa' }, { status: 400 })
      }

      const prevTotal = prod.stock_quantity ?? 0

      for (const variant of activeVariants) {
        const currentStock = variant.stock ?? 0
        let newStock: number
        if (kind === 'entrada') {
          newStock = currentStock + value
        } else if (kind === 'salida') {
          newStock = Math.max(0, currentStock - value)
        } else {
          newStock = value
        }
        await supabase
          .from('product_variants')
          .update({ stock: newStock })
          .eq('id', variant.id)
      }

      // Sync parent stock_quantity = sum of all active variant stocks
      const { data: allVariants } = await supabase
        .from('product_variants')
        .select('stock')
        .eq('product_id', product_id)
        .eq('status', 'active')
      const newTotal = ((allVariants ?? []) as Array<{ stock?: number }>)
        .reduce((s, v) => s + (v.stock ?? 0), 0)
      
      await supabase
        .from('products')
        .update({ stock_quantity: newTotal })
        .eq('id', product_id)

      const delta = newTotal - prevTotal
      if (delta !== 0) {
        await supabase.from('inventory_movements').insert({
          product_id,
          type: kind === 'entrada' ? 'entrada' : kind === 'salida' ? 'salida' : 'ajuste',
          quantity: delta,
          reason: `${reason} (${activeVariants.length} variantes)`,
          reference,
          created_by: null,
        })
      }

      return NextResponse.json({ data: { product_id, newTotal, delta } })
    }

    if (kind === 'entrada') {
      if (value <= 0) return NextResponse.json({ error: 'La entrada debe ser mayor a 0' }, { status: 400 })
      const movement = await createInventoryMovement(supabase, {
        product_id,
        type: 'entrada',
        quantity: value,
        reason,
        reference,
        created_by: undefined,
      })
      return NextResponse.json({ data: movement })
    }

    if (kind === 'salida') {
      if (value <= 0) return NextResponse.json({ error: 'La salida debe ser mayor a 0' }, { status: 400 })
      const movement = await createInventoryMovement(supabase, {
        product_id,
        type: 'salida',
        quantity: -Math.abs(value),
        reason,
        reference,
        created_by: undefined,
      })
      return NextResponse.json({ data: movement })
    }

    // correccion: value = nuevo stock absoluto
    const current = prod.stock_quantity ?? 0
    const delta = value - current
    if (delta === 0) {
      return NextResponse.json({ data: { skipped: true, message: 'Sin cambio de stock' } })
    }
    const movement = await createInventoryMovement(supabase, {
      product_id,
      type: 'ajuste',
      quantity: delta,
      reason: `${reason} (corrección a ${value} uds.)`,
      reference,
      created_by: undefined,
    })
    return NextResponse.json({ data: movement })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al ajustar inventario'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
