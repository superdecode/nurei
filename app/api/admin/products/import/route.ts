import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Papa from 'papaparse'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createProduct, getProduct, updateProduct } from '@/lib/supabase/queries/products'
import type { Product, ProductStatus, UnitOfMeasure } from '@/types'

const UNIT_VALUES: UnitOfMeasure[] = ['ml', 'g', 'kg', 'L', 'oz', 'units', 'box', 'pack']

function normalizeHeader(h: string) {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

function slugify(s: string) {
  const x = s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return x || 'producto'
}

function parseStatus(raw: string | undefined): ProductStatus | null {
  if (!raw?.trim()) return null
  const v = raw.trim().toLowerCase()
  if (v === 'draft' || v === 'borrador') return 'draft'
  if (v === 'active' || v === 'activo') return 'active'
  if (v === 'archived' || v === 'archivado') return 'archived'
  return null
}

function parseUnit(raw: string | undefined): UnitOfMeasure {
  if (!raw?.trim()) return 'units'
  const v = raw.trim().toLowerCase() as UnitOfMeasure
  return UNIT_VALUES.includes(v) ? v : 'units'
}

async function allocateUniqueSlug(supabase: ReturnType<typeof createServiceClient>, base: string): Promise<string> {
  let slug = slugify(base).slice(0, 80)
  let n = 0
  for (;;) {
    const { data } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
    n += 1
    slug = `${slugify(base).slice(0, 70)}-${n}`
  }
}

type PreviewRow = {
  sku: string
  nombre?: string
  categoria_slug?: string
  precio_mxn?: number
  stock?: number
  accion: 'crear' | 'actualizar'
}

type ImportUpdateRow = {
  op: 'update'
  product_id: string
  sku: string
  updates: Record<string, unknown>
}

type ImportCreateRow = {
  op: 'create'
  sku: string
  name: string
  category: string
  base_price: number
  stock_quantity: number
  low_stock_threshold: number
  status: ProductStatus
  description: string | null
  slug_input: string | null
  unit_of_measure: UnitOfMeasure
  weight_g: number
  compare_at_price: number | null
}

const confirmRowSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('update'),
    product_id: z.string().uuid(),
    sku: z.string().min(1),
    updates: z.record(z.string(), z.unknown()),
  }),
  z.object({
    op: z.literal('create'),
    sku: z.string().min(1),
    name: z.string().min(1),
    category: z.string().min(1),
    base_price: z.number().int().nonnegative(),
    stock_quantity: z.number().int().nonnegative(),
    low_stock_threshold: z.number().int().nonnegative(),
    status: z.enum(['draft', 'active', 'archived']),
    description: z.string().nullable().optional(),
    slug_input: z.string().nullable().optional(),
    unit_of_measure: z.enum(['ml', 'g', 'kg', 'L', 'oz', 'units', 'box', 'pack']),
    weight_g: z.number().int().nonnegative(),
    compare_at_price: z.number().int().nonnegative().nullable().optional(),
  }),
])

const confirmSchema = z.object({
  rows: z.array(confirmRowSchema).min(1),
})

function mapKeys(raw: Record<string, string>): Record<string, string> {
  return Object.keys(raw).reduce<Record<string, string>>((acc, k) => {
    acc[normalizeHeader(k)] = raw[k]?.trim() ?? ''
    return acc
  }, {})
}

function pesosToCents(v: number): number {
  if (!Number.isFinite(v) || v < 0) return -1
  return Math.round(v * 100)
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin()
  if (adminCheck.error) return adminCheck.error

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
        { status: 400 },
      )
    }

    const supabase = createServiceClient()
    const { data: catRows } = await supabase.from('categories').select('slug')
    const slugToCanonical = new Map<string, string>()
    for (const c of catRows ?? []) {
      if (c?.slug) slugToCanonical.set(String(c.slug).toLowerCase(), c.slug)
    }

    const preview: PreviewRow[] = []
    const errors: Array<{ row: number; sku: string; message: string }> = []
    const validRows: Array<ImportUpdateRow | ImportCreateRow> = []

    const rows = parsed.data ?? []
    for (let i = 0; i < rows.length; i++) {
      const k = mapKeys(rows[i])
      const sku = k.sku || k.codigo || k.codigo_sku || ''
      if (!sku) {
        errors.push({ row: i + 2, sku: '', message: 'Fila sin SKU' })
        continue
      }

      const { data: existing } = await supabase
        .from('products')
        .select('id, sku, stock_quantity')
        .eq('sku', sku)
        .maybeSingle()

      const nombre = k.nombre || k.name || k.producto || ''
      const catRaw = k.categoria_slug || k.categoria || k.category || ''
      const catKey = catRaw.trim().toLowerCase()
      const categoria = catKey ? slugToCanonical.get(catKey) : undefined

      const precioRaw = k.precio_mxn || k.precio || k.price || ''
      const precioNum = precioRaw === '' ? NaN : Number(precioRaw.replace(',', '.'))
      const precioCents = Number.isFinite(precioNum) ? pesosToCents(precioNum) : -1

      const stockRaw = k.stock || k.cantidad || k.inventario || ''
      const stock = stockRaw === '' ? undefined : Math.round(Number(stockRaw))

      const alertRaw = k.alerta_stock || k.alerta || k.umbral || ''
      const alerta = alertRaw === '' ? undefined : Math.round(Number(alertRaw))

      const estado = parseStatus(k.estado || k.status)
      const descripcion = k.descripcion || k.description || ''
      const slugInput = (k.slug || '').trim() || null
      const unidad = parseUnit(k.unidad || k.unit_of_measure || k.unidad_medida)
      const pesoRaw = k.peso_g || k.peso || k.weight_g || ''
      const peso = pesoRaw === '' ? 0 : Math.round(Number(pesoRaw))

      const compareRaw = k.compare_precio_mxn || k.compare_at || k.precio_compare || ''
      const compareNum = compareRaw === '' ? NaN : Number(compareRaw.replace(',', '.'))
      const compareCents = Number.isFinite(compareNum) && compareNum >= 0 ? pesosToCents(compareNum) : null

      if (existing) {
        if (catRaw && !categoria) {
          errors.push({ row: i + 2, sku, message: `Categoría inválida: "${catRaw}"` })
          continue
        }
        const updates: Record<string, unknown> = {}
        if (nombre) updates.name = nombre
        if (categoria) updates.category = categoria
        if (precioCents >= 0) {
          updates.base_price = precioCents
          updates.price = precioCents
        }
        if (stock !== undefined) {
          if (!Number.isFinite(stock) || stock < 0) {
            errors.push({ row: i + 2, sku, message: 'Stock inválido' })
            continue
          }
          updates.stock_quantity = stock
        }
        if (alerta !== undefined) {
          if (!Number.isFinite(alerta) || alerta < 0) {
            errors.push({ row: i + 2, sku, message: 'Alerta inválida' })
            continue
          }
          updates.low_stock_threshold = alerta
        }
        if (estado) updates.status = estado
        if (descripcion !== '') updates.description = descripcion
        if (slugInput) updates.slug = slugify(slugInput)
        if (k.unidad || k.unit_of_measure || k.unidad_medida) {
          updates.unit_of_measure = unidad
        }
        if (pesoRaw !== '') {
          if (!Number.isFinite(peso) || peso < 0) {
            errors.push({ row: i + 2, sku, message: 'peso_g inválido' })
            continue
          }
          updates.weight_g = peso
        }
        if (compareRaw !== '') {
          if (compareCents === null || compareCents < 0) {
            errors.push({ row: i + 2, sku, message: 'compare_precio_mxn inválido' })
            continue
          }
          updates.compare_at_price = compareCents
        }

        if (Object.keys(updates).length === 0) {
          errors.push({ row: i + 2, sku, message: 'Sin campos para actualizar (solo SKU)' })
          continue
        }

        validRows.push({ op: 'update', product_id: existing.id, sku, updates })
        if (preview.length < 15) {
          preview.push({
            sku,
            nombre: nombre || undefined,
            categoria_slug: categoria,
            precio_mxn: precioCents >= 0 ? precioNum : undefined,
            stock,
            accion: 'actualizar',
          })
        }
        continue
      }

      if (!nombre.trim()) {
        errors.push({ row: i + 2, sku, message: 'Nombre obligatorio para producto nuevo' })
        continue
      }
      if (!catRaw || !categoria) {
        errors.push({
          row: i + 2,
          sku,
          message: `Categoría inválida: "${catRaw}" — use el slug exacto de una categoría existente`,
        })
        continue
      }
      if (precioCents < 0) {
        errors.push({ row: i + 2, sku, message: 'precio_mxn obligatorio y numérico (pesos enteros, ej. 89)' })
        continue
      }

      const st: ProductStatus = estado ?? 'draft'
      const stockQ = stock !== undefined ? stock : 0
      if (!Number.isFinite(stockQ) || stockQ < 0) {
        errors.push({ row: i + 2, sku, message: 'Stock inválido' })
        continue
      }
      const low = alerta !== undefined ? alerta : 5
      if (!Number.isFinite(low) || low < 0) {
        errors.push({ row: i + 2, sku, message: 'alerta_stock inválida' })
        continue
      }

      if (!Number.isFinite(peso) || peso < 0) {
        errors.push({ row: i + 2, sku, message: 'peso_g inválido' })
        continue
      }

      if (compareRaw !== '' && (compareCents === null || compareCents < 0)) {
        errors.push({ row: i + 2, sku, message: 'compare_precio_mxn inválido' })
        continue
      }

      validRows.push({
        op: 'create',
        sku,
        name: nombre.trim(),
        category: categoria,
        base_price: precioCents,
        stock_quantity: stockQ,
        low_stock_threshold: low,
        status: st,
        description: descripcion.trim() ? descripcion.trim() : null,
        slug_input: slugInput,
        unit_of_measure: unidad,
        weight_g: peso,
        compare_at_price: compareCents !== null && compareCents >= 0 ? compareCents : null,
      })
      if (preview.length < 15) {
        preview.push({
          sku,
          nombre: nombre.trim(),
          categoria_slug: categoria,
          precio_mxn: precioNum,
          stock: stockQ,
          accion: 'crear',
        })
      }
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
  const ref = `PROD-IMP-${Date.now()}`
  let imported = 0
  const failed: Array<{ sku: string; message: string }> = []

  for (const row of parsed.data.rows) {
    try {
      if (row.op === 'update') {
        const prev = await getProduct(row.product_id)
        const updates = { ...row.updates } as Partial<Product>
        const nextStock =
          typeof updates.stock_quantity === 'number' ? updates.stock_quantity : null
        const prevStock = prev.stock_quantity ?? 0

        await updateProduct(row.product_id, updates)

        if (nextStock !== null && nextStock !== prevStock) {
          const diff = nextStock - prevStock
          await supabase.from('inventory_movements').insert({
            product_id: row.product_id,
            type: 'ajuste',
            quantity: diff,
            reason: 'Importación CSV (productos)',
            reference: ref,
            created_by: adminCheck.userId,
          })
        }
        imported += 1
        continue
      }

      const slug = await allocateUniqueSlug(supabase, row.slug_input || row.name)
      const product = await createProduct({
        name: row.name,
        slug,
        sku: row.sku,
        category: row.category,
        description: row.description ?? null,
        base_price: row.base_price,
        price: row.base_price,
        stock_quantity: row.stock_quantity,
        low_stock_threshold: row.low_stock_threshold,
        status: row.status,
        unit_of_measure: row.unit_of_measure,
        weight_g: row.weight_g,
        compare_at_price: row.compare_at_price ?? undefined,
        origin: '',
        images: [],
        tags: [],
      })

      if ((row.stock_quantity ?? 0) > 0) {
        await supabase.from('inventory_movements').insert({
          product_id: product.id,
          type: 'entrada',
          quantity: row.stock_quantity,
          reason: 'Stock inicial — importación CSV',
          reference: ref,
          created_by: adminCheck.userId,
        })
      }
      imported += 1
    } catch (e) {
      failed.push({ sku: row.sku, message: e instanceof Error ? e.message : 'Error' })
    }
  }

  return NextResponse.json({ data: { imported, failed } })
}
