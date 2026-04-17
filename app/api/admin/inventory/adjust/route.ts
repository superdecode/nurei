import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { createInventoryMovement } from '@/lib/supabase/queries/inventory'

const adjustSchema = z.object({
  product_id: z.string().uuid(),
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
  try {

    const body = await request.json()
    const parsed = adjustSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload inválido', details: parsed.error.flatten() }, { status: 400 })
    }

    const { product_id, kind, value, motivo, nota } = parsed.data
    const supabase = createServiceClient()
    const reference = refCode('INV-MAN')

    if (kind === 'entrada') {
      if (value <= 0) return NextResponse.json({ error: 'La entrada debe ser mayor a 0' }, { status: 400 })
      const reason = [motivo, nota].filter(Boolean).join(' · ')
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
      const reason = [motivo, nota].filter(Boolean).join(' · ')
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
    const { data: prod, error } = await supabase.from('products').select('stock_quantity').eq('id', product_id).single()
    if (error || !prod) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    const current = prod.stock_quantity ?? 0
    const delta = value - current
    if (delta === 0) {
      return NextResponse.json({ data: { skipped: true, message: 'Sin cambio de stock' } })
    }
    const reason = [motivo, nota].filter(Boolean).join(' · ')
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
