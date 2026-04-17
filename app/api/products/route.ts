import { NextRequest, NextResponse } from 'next/server'
import { listProducts, createProduct, getProductBySlug } from '@/lib/supabase/queries/products'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const category = searchParams.get('category') || undefined
    const status = searchParams.get('status') || undefined
    const featured = searchParams.get('featured') === 'true' || undefined
    const search = searchParams.get('search') || undefined
    const slug = searchParams.get('slug') || undefined
    const hasVariants = searchParams.has('has_variants')
      ? searchParams.get('has_variants') === 'true'
      : undefined

    if (slug) {
      const product = await getProductBySlug(slug)
      return NextResponse.json({ data: { products: [product], total: 1 } })
    }

    const products = await listProducts({ category, status, featured, search, hasVariants })

    return NextResponse.json({ data: { products, total: products.length } })
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
    const product = await createProduct(body)
    if ((body.stock_quantity ?? 0) > 0) {
      const internalReference = `INV-INI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`
      await createServiceClient().from('inventory_movements').insert({
        product_id: product.id,
        type: 'entrada',
        quantity: Math.abs(body.stock_quantity),
        reason: body.inventory_note?.trim() || 'Stock inicial al crear producto',
        reference: internalReference,
        created_by: adminCheck.userId,
      })
    }
    return NextResponse.json({ data: product }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error creating product'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
