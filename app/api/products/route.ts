import { NextRequest, NextResponse } from 'next/server'
import { listProducts, createProduct, getProductBySlug } from '@/lib/supabase/queries/products'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminUserId, requireAdmin } from '@/lib/server/require-admin'

type ProductCreatePayload = Record<string, unknown>

async function createProductWithOptionalStock(body: ProductCreatePayload, adminUserId: string | null) {
  const product = await createProduct(body)
  const stockQuantity = Number(body.stock_quantity ?? 0)
  if (stockQuantity > 0) {
    const internalReference = `INV-INI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`
    await createServiceClient().from('inventory_movements').insert({
      product_id: product.id,
      type: 'entrada',
      quantity: Math.abs(stockQuantity),
      reason: typeof body.inventory_note === 'string' && body.inventory_note.trim() ? body.inventory_note.trim() : 'Stock inicial al crear producto',
      reference: internalReference,
      created_by: adminUserId,
    })
  }
  return product
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const category = searchParams.get('category') || undefined
    const requestedStatus = searchParams.get('status') || undefined
    const featured = searchParams.get('featured') === 'true' || undefined
    const search = searchParams.get('search') || undefined
    const slug = searchParams.get('slug') || undefined
    const hasVariants = searchParams.has('has_variants')
      ? searchParams.get('has_variants') === 'true'
      : undefined

    // Public catalogue reads must stay cookie-free: invoking Auth for every
    // visitor prevents CDN reuse and adds needless Supabase requests. Admin
    // screens opt in explicitly, while privileged filters still require admin.
    const requiresAdmin =
      searchParams.get('admin') === '1'
      || Boolean(slug)
      || (Boolean(requestedStatus) && requestedStatus !== 'active')
    const canManageCatalog = requiresAdmin && Boolean(await getAdminUserId())
    if (requiresAdmin && !canManageCatalog) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    const status = canManageCatalog ? requestedStatus : 'active'

    if (slug) {
      const product = await getProductBySlug(slug)
      const res = NextResponse.json({ data: { products: [product], total: 1 } })
      res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
      return res
    }

    const products = await listProducts({ category, status, featured, search, hasVariants }, canManageCatalog)

    const res = NextResponse.json({ data: { products, total: products.length } })

    // Only cache public, non-filtered reads (admin search/filter results must not be cached publicly)
    if (!canManageCatalog && !search && !hasVariants && status === 'active') {
      res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
    } else {
      res.headers.set('Cache-Control', 'private, no-store')
    }

    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error fetching products'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin()
    if (adminCheck.error) return adminCheck.error

    const body = await request.json()
    const batch = Array.isArray(body)
      ? body
      : Array.isArray((body as { products?: unknown }).products)
        ? (body as { products: ProductCreatePayload[] }).products
        : null

    if (batch) {
      const products = []
      for (const item of batch as ProductCreatePayload[]) {
        products.push(await createProductWithOptionalStock(item, adminCheck.userId))
      }
      return NextResponse.json({ data: { products } }, { status: 201 })
    }

    const product = await createProductWithOptionalStock(body as ProductCreatePayload, adminCheck.userId)
    return NextResponse.json({ data: product }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error creating product'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
