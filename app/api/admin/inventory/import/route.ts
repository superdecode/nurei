import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Papa from 'papaparse'
import { createServiceClient } from '@/lib/supabase/server'

type ParsedRow = {
  sku: string
  nombre?: string
  categoria?: string
  stock?: number
  precio?: number
  alerta_stock?: number
}

function normalizeHeader(h: string) {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

function mapRow(raw: Record<string, string>): ParsedRow | null {
  const keys = Object.keys(raw).reduce<Record<string, string>>((acc, k) => {
    acc[normalizeHeader(k)] = raw[k]?.trim() ?? ''
    return acc
  }, {})

  const sku =
    keys.sku ||
    keys.codigo ||
    keys.codigo_sku ||
    keys['sku_producto'] ||
    ''
  if (!sku) return null

  const stockRaw = keys.stock ?? keys.cantidad ?? keys.inventario ?? ''
  const precioRaw = keys.precio ?? keys.price ?? ''
  const alertaRaw = keys.alerta_stock ?? keys.alerta ?? keys.umbral ?? ''

  return {
    sku,
    nombre: keys.nombre || keys.name || keys.producto,
    categoria: keys.categoria || keys.category,
    stock: stockRaw === '' ? undefined : Number(stockRaw),
    precio: precioRaw === '' ? undefined : Number(precioRaw),
    alerta_stock: alertaRaw === '' ? undefined : Number(alertaRaw),
  }
}

const confirmRowSchema = z.object({
  sku: z.string().min(1),
  stock_quantity: z.number().int().min(0).optional(),
  low_stock_threshold: z.number().int().min(0).optional(),
  base_price_cents: z.number().int().min(0).optional(),
})

const confirmSchema = z.object({
  rows: z.array(confirmRowSchema).min(1),
})

export async function POST(request: NextRequest) {

  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }

    const text = await file.text()
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })

    if (parsed.errors.length) {
      return NextResponse.json(
        { error: 'CSV inválido', details: parsed.errors.map((e) => e.message) },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const preview: ParsedRow[] = []
    const errors: Array<{ row: number; sku: string; message: string }> = []
    const validRows: z.infer<typeof confirmRowSchema>[] = []

    const rows = parsed.data ?? []
    for (let i = 0; i < rows.length; i++) {
      const mapped = mapRow(rows[i])
      if (!mapped) {
        errors.push({ row: i + 2, sku: '', message: 'Fila sin SKU' })
        continue
      }

      const { data: product, error } = await supabase.from('products').select('id, sku, stock_quantity, low_stock_threshold, base_price').eq('sku', mapped.sku).maybeSingle()

      if (error || !product) {
        errors.push({ row: i + 2, sku: mapped.sku, message: 'SKU no encontrado en catálogo' })
        continue
      }

      if (mapped.stock !== undefined && (!Number.isFinite(mapped.stock) || mapped.stock < 0)) {
        errors.push({ row: i + 2, sku: mapped.sku, message: 'Stock inválido' })
        continue
      }
      if (mapped.alerta_stock !== undefined && (!Number.isFinite(mapped.alerta_stock) || mapped.alerta_stock < 0)) {
        errors.push({ row: i + 2, sku: mapped.sku, message: 'Alerta inválida' })
        continue
      }
      if (mapped.precio !== undefined && (!Number.isFinite(mapped.precio) || mapped.precio < 0)) {
        errors.push({ row: i + 2, sku: mapped.sku, message: 'Precio inválido' })
        continue
      }

      const rowPayload: z.infer<typeof confirmRowSchema> = { sku: mapped.sku }
      if (mapped.stock !== undefined) rowPayload.stock_quantity = Math.round(mapped.stock)
      if (mapped.alerta_stock !== undefined) rowPayload.low_stock_threshold = Math.round(mapped.alerta_stock)
      if (mapped.precio !== undefined) rowPayload.base_price_cents = Math.round(mapped.precio * 100)

      if (
        rowPayload.stock_quantity === undefined &&
        rowPayload.low_stock_threshold === undefined &&
        rowPayload.base_price_cents === undefined
      ) {
        errors.push({ row: i + 2, sku: mapped.sku, message: 'Sin campos para actualizar' })
        continue
      }

      validRows.push(rowPayload)
      if (preview.length < 12) preview.push(mapped)
    }

    return NextResponse.json({
      data: {
        preview,
        summary: {
          total: rows.length,
          valid: validRows.length,
          invalid: errors.length,
        },
        errors,
        /** Pasar este token en confirmación junto con rows (mismo orden) — simplificación: devolvemos rows listas */
        rows: validRows,
      },
    })
  }

  const body = await request.json()
  const parsed = confirmSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', details: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createServiceClient()
  const ref = `INV-IMP-${Date.now()}`
  let imported = 0
  const failed: Array<{ sku: string; message: string }> = []

  for (const row of parsed.data.rows) {
    try {
      const { data: product } = await supabase.from('products').select('id, stock_quantity').eq('sku', row.sku).single()
      if (!product) throw new Error('No encontrado')

      const updates: Record<string, number> = {}
      if (row.base_price_cents !== undefined) {
        updates.base_price = row.base_price_cents
        updates.price = row.base_price_cents
      }
      if (row.low_stock_threshold !== undefined) updates.low_stock_threshold = row.low_stock_threshold

      if (row.stock_quantity !== undefined) {
        const prev = product.stock_quantity ?? 0
        const next = row.stock_quantity
        const diff = next - prev
        await supabase.from('products').update({ ...updates, stock_quantity: next }).eq('id', product.id)
        if (diff !== 0) {
          await supabase.from('inventory_movements').insert({
            product_id: product.id,
            type: 'ajuste',
            quantity: diff,
            reason: 'Importación de inventario',
            reference: ref,
            created_by: undefined,
          })
        }
      } else if (Object.keys(updates).length > 0) {
        await supabase.from('products').update(updates).eq('id', product.id)
      }
      imported += 1
    } catch (e) {
      failed.push({ sku: row.sku, message: e instanceof Error ? e.message : 'Error' })
    }
  }

  return NextResponse.json({ data: { imported, failed, reference: ref } })
}
