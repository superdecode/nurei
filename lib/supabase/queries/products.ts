import { createServiceClient } from '@/lib/supabase/server'
import type { Product, ProductVariant } from '@/types'
import { computeStockStatus } from '@/lib/inventory/stock-status'

// ─── Helpers ────────────────────────────────────────────────────────────

function getStockStatus(row: Record<string, unknown>): Product['stock_status'] {
  const trackInventory = (row.track_inventory as boolean | null | undefined) !== false
  const allowBackorder = (row.allow_backorder as boolean | null | undefined) === true

  if (!trackInventory || allowBackorder) return 'available'

  if ((row.has_variants as boolean | null | undefined) === true) {
    type RawV = { stock?: number | null; status: string }
    const active = ((row.product_variants as RawV[] | null) ?? []).filter(v => v.status === 'active')
    if (active.length === 0) return 'available'
    return active.some(v => (v.stock ?? 0) > 0) ? 'available' : 'out_of_stock'
  }

  return computeStockStatus({
    stock_quantity: row.stock_quantity as number | string | null | undefined,
    low_stock_threshold: row.low_stock_threshold as number | string | null | undefined,
  })
}

function coerceWeightG(raw: unknown): number {
  if (raw == null || raw === '') return 0
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  const n = parseFloat(String(raw).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function mapRow(row: Record<string, unknown>): Product {
  type RawVariant = { id: string; name: string; price: number; image: string | null; status: string; sort_order: number; stock?: number | null }
  const rawVariants = (row.product_variants as RawVariant[] | null) ?? []
  const activeVariants = rawVariants
    .filter((v) => v.status === 'active')
    .sort((a, b) => a.sort_order - b.sort_order)
  const variantImages = activeVariants
    .filter((v) => v.image)
    .map((v) => v.image as string)
    .filter((img, i, arr) => arr.indexOf(img) === i)

  return {
    ...row,
    price: (row.base_price as number) ?? (row.price as number) ?? 0,
    base_price: (row.base_price as number) ?? (row.price as number) ?? 0,
    images: (row.images as string[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    has_variants: (row.has_variants as boolean) ?? false,
    requires_spice_level: (row.requires_spice_level as boolean) ?? false,
    status: (row.status as string) ?? 'draft',
    unit_of_measure: (row.unit_of_measure as string) ?? 'units',
    primary_image_index: (row.primary_image_index as number) ?? 0,
    weight_g: coerceWeightG(row.weight_g),
    shipping_weight_g: (row.shipping_weight_g as number | null) ?? null,
    dimensions_cm: (row.dimensions_cm as Product['dimensions_cm']) ?? null,
    stock_quantity: (row.stock_quantity as number) ?? 0,
    low_stock_threshold: (row.low_stock_threshold as number) ?? 5,
    track_inventory: (row.track_inventory as boolean) ?? true,
    allow_backorder: (row.allow_backorder as boolean) ?? false,
    stock_status: getStockStatus(row),
    variant_images: variantImages.length > 0 ? variantImages : undefined,
    variants: activeVariants.length > 0 ? activeVariants.map((v) => ({
      id: v.id,
      product_id: row.id as string,
      name: v.name,
      sku: null,
      sku_suffix: null,
      price: v.price,
      compare_at_price: null,
      stock: v.stock ?? 0,
      attributes: {},
      image: v.image,
      status: v.status as 'active' | 'inactive',
      sort_order: v.sort_order,
      created_at: '',
      updated_at: '',
    })) : undefined,
  } as Product
}

// ─── List products ──────────────────────────────────────────────────────

interface ListFilters {
  category?: string
  status?: string
  featured?: boolean
  search?: string
  hasVariants?: boolean
}

export async function listProducts(filters: ListFilters = {}) {
  const supabase = createServiceClient()
  let query = supabase.from('products').select('*, product_variants(id, name, price, image, status, sort_order, stock)')
  const normalizedSearch = filters.search
    ? filters.search.replace(/[(),]/g, '').replace(/\./g, ' ').trim()
    : undefined

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.category) {
    query = query.eq('category', filters.category)
  }
  if (filters.featured) {
    query = query.eq('is_featured', true)
  }
  if (filters.hasVariants !== undefined) {
    query = query.eq('has_variants', filters.hasVariants)
  }
  if (normalizedSearch) {
    query = query.or(`name.ilike.%${normalizedSearch}%,slug.ilike.%${normalizedSearch}%,sku.ilike.%${normalizedSearch}%`)
  }

  query = query
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapRow)
}

// ─── Get single product ─────────────────────────────────────────────────

export async function getProduct(id: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return mapRow(data)
}

export async function getProductBySlug(slug: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('products')
    .select('*, product_variants(id, name, price, image, status, sort_order, stock)')
    .eq('slug', slug)
    .single()

  if (error) throw error
  return mapRow(data)
}

// ─── Create product ─────────────────────────────────────────────────────

export async function createProduct(product: Partial<Product>) {
  const supabase = createServiceClient()
  const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const categoryForOrder = product.category ?? 'crunchy'
  const { data: lastOrdered } = await supabase
    .from('products')
    .select('display_order')
    .eq('category', categoryForOrder)
    .order('display_order', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  const nextDisplayOrder = typeof lastOrdered?.display_order === 'number' ? lastOrdered.display_order + 1 : 0
  const row = {
    name: product.name ?? 'Borrador sin nombre',
    slug: product.slug ?? `borrador-${uniqueSuffix}`,
    description: product.description ?? null,
    category: categoryForOrder,
    subcategory: product.subcategory ?? null,
    sku: product.sku ?? `SKU-${uniqueSuffix.toUpperCase().replace(/[^A-Z0-9-]/g, '')}`,
    brand_id: product.brand_id ?? null,
    brand: product.brand ?? null,
    origin: product.origin ?? '',
    origin_country: product.origin_country ?? null,
    unit_of_measure: product.unit_of_measure ?? 'units',
    spice_level: product.spice_level ?? 0,
    weight_g: product.weight_g ?? 0,
    shipping_weight_g: product.shipping_weight_g ?? null,
    price: product.base_price ?? product.price ?? 0,
    base_price: product.base_price ?? product.price ?? 0,
    compare_at_price: product.compare_at_price ?? null,
    cost_estimate: product.cost_estimate ?? null,
    availability_score: product.availability_score ?? 100,
    is_active: product.status !== 'archived' && (product.status ?? 'active') === 'active',
    is_featured: product.is_featured ?? false,
    is_favorite: product.is_favorite ?? false,
    is_limited: product.is_limited ?? false,
    has_variants: product.has_variants ?? false,
    requires_spice_level: product.requires_spice_level ?? false,
    status: product.status ?? 'active',
    campaign: product.campaign ?? null,
    images: product.images ?? [],
    primary_image_index: product.primary_image_index ?? 0,
    tags: product.tags ?? [],
    dimensions_cm: product.dimensions_cm ?? null,
    stock_quantity: product.stock_quantity ?? 0,
    low_stock_threshold: product.low_stock_threshold ?? 5,
    track_inventory: product.track_inventory ?? true,
    allow_backorder: product.allow_backorder ?? false,
    display_order: product.display_order ?? nextDisplayOrder,
  }

  const { data, error } = await supabase
    .from('products')
    .insert(row)
    .select()
    .single()

  if (error) throw error
  return mapRow(data)
}

// ─── Update product ─────────────────────────────────────────────────────

export async function updateProduct(id: string, updates: Partial<Product>) {
  const supabase = createServiceClient()
  const row: Record<string, unknown> = {}

  const fields = [
    'name', 'slug', 'description', 'category', 'subcategory', 'sku',
    'brand_id', 'brand', 'origin', 'origin_country', 'unit_of_measure', 'spice_level',
    'weight_g', 'shipping_weight_g', 'compare_at_price', 'cost_estimate', 'availability_score',
    'is_featured', 'is_favorite', 'is_limited', 'has_variants', 'requires_spice_level',
    'status', 'campaign', 'images', 'primary_image_index', 'tags',
    'dimensions_cm', 'stock_quantity', 'low_stock_threshold',
    'track_inventory', 'allow_backorder', 'display_order',
  ]

  for (const f of fields) {
    if (f in updates) {
      row[f] = (updates as Record<string, unknown>)[f]
    }
  }

  if ('base_price' in updates || 'price' in updates) {
    const val = updates.base_price ?? updates.price
    row.price = val
    row.base_price = val
  }

  if ('status' in updates) {
    row.is_active = updates.status === 'active'
  }

  const { data, error } = await supabase
    .from('products')
    .update(row)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return mapRow(data)
}

// ─── Delete product ─────────────────────────────────────────────────────

export async function deleteProduct(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function reorderProducts(ids: string[]) {
  const supabase = createServiceClient()
  const tasks = ids.map((id, index) =>
    supabase
      .from('products')
      .update({ display_order: index })
      .eq('id', id)
  )
  const results = await Promise.all(tasks)
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}

// ─── Duplicate product ──────────────────────────────────────────────────

export async function duplicateProduct(id: string) {
  const original = await getProduct(id)
  const now = Date.now()
  const copy = {
    ...original,
    name: `${original.name} (copia)`,
    slug: '',
    sku: `${original.sku}-COPY-${now}`,
    status: 'draft' as const,
    is_active: false,
  }
  delete (copy as Record<string, unknown>).id
  delete (copy as Record<string, unknown>).created_at
  delete (copy as Record<string, unknown>).updated_at
  delete (copy as Record<string, unknown>).variants
  return createProduct(copy)
}

// ─── Variants ───────────────────────────────────────────────────────────

export async function listVariants(productId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order')

  if (error) throw error
  return (data ?? []) as ProductVariant[]
}

export async function upsertVariants(productId: string, variants: Partial<ProductVariant>[]) {
  const supabase = createServiceClient()

  // Delete existing variants not in the new list
  const existingIds = variants.filter(v => v.id).map(v => v.id!)
  if (existingIds.length > 0) {
    await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', productId)
      .not('id', 'in', `(${existingIds.join(',')})`)
  } else {
    await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', productId)
  }

  const rows = variants.map((v, i) => ({
    ...(v.id ? { id: v.id } : {}),
    product_id: productId,
    name: v.name ?? '',
    sku: v.sku ?? null,
    sku_suffix: v.sku_suffix ?? null,
    price: v.price ?? 0,
    compare_at_price: v.compare_at_price ?? null,
    cost_estimate: v.cost_estimate ?? null,
    stock: v.stock ?? 0,
    attributes: v.attributes ?? {},
    image: v.image ?? null,
    status: v.status ?? 'active',
    sort_order: i,
  }))

  const { data, error } = await supabase
    .from('product_variants')
    .upsert(rows, { onConflict: 'id' })
    .select()

  if (error) throw error
  return (data ?? []) as ProductVariant[]
}
