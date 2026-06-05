import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { createInventoryMovement } from '@/lib/supabase/queries/inventory'
import { requireAdmin } from '@/lib/server/require-admin'

const bulkAdjustSchema = z.object({
  product_ids: z.array(z.string().uuid()).min(1),
  kind: z.enum(['entrada', 'salida', 'correccion']),
  value: z.number().int().min(0),
  motivo: z.string().trim().min(1).max(120),
  nota: z.string().trim().max(200).optional(),
})

function refCode() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const r = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, '0')
  return `INV-MAN-BULK-${d}-${r}`
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {

    const body = await request.json()
    const parsed = bulkAdjustSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload inválido', details: parsed.error.flatten() }, { status: 400 })
    }

    const { product_ids, kind, value, motivo, nota } = parsed.data
    const supabase = createServiceClient()
    const batchRef = refCode()
    const reasonBase = [motivo, nota].filter(Boolean).join(' · ')

    let ok = 0
    const errors: Array<{ product_id: string; message: string }> = []

    for (const product_id of product_ids) {
      try {
        const { data: prod } = await supabase
          .from('products')
          .select('stock_quantity, has_variants')
          .eq('id', product_id)
          .single()

        if (prod?.has_variants) {
          // Apply adjustment to each active variant equally, then sync parent
          const { data: variants } = await supabase
            .from('product_variants')
            .select('id, stock')
            .eq('product_id', product_id)
            .eq('status', 'active')

          const activeVariants = (variants ?? []) as Array<{ id: string; stock: number }>
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
              reason: `${reasonBase} (${activeVariants.length} variantes)`,
              reference: batchRef,
              created_by: null,
            })
          }
        } else if (kind === 'entrada') {
          if (value <= 0) throw new Error('Valor inválido')
          await createInventoryMovement(supabase, {
            product_id,
            type: 'entrada',
            quantity: value,
            reason: reasonBase,
            reference: batchRef,
            created_by: undefined,
          })
        } else if (kind === 'salida') {
          if (value <= 0) throw new Error('Valor inválido')
          await createInventoryMovement(supabase, {
            product_id,
            type: 'salida',
            quantity: -Math.abs(value),
            reason: reasonBase,
            reference: batchRef,
            created_by: undefined,
          })
        } else {
          const current = prod?.stock_quantity ?? 0
          const delta = value - current
          if (delta !== 0) {
            await createInventoryMovement(supabase, {
              product_id,
              type: 'ajuste',
              quantity: delta,
              reason: `${reasonBase} (corrección a ${value} uds.)`,
              reference: batchRef,
              created_by: undefined,
            })
          }
        }
        ok += 1
      } catch (e) {
        errors.push({
          product_id,
          message: e instanceof Error ? e.message : 'Error',
        })
      }
    }

    return NextResponse.json({ data: { processed: ok, failed: errors.length, errors } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en ajuste masivo'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
