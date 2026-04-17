import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { createInventoryMovement } from '@/lib/supabase/queries/inventory'

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
        if (kind === 'entrada') {
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
          const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', product_id).single()
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
