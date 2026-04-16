import { NextRequest, NextResponse } from 'next/server'
import { listProducts, createProduct } from '@/lib/supabase/queries/products'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const category = searchParams.get('category') || undefined
    const status = searchParams.get('status') || undefined
    const featured = searchParams.get('featured') === 'true' || undefined
    const search = searchParams.get('search') || undefined
    const hasVariants = searchParams.has('has_variants')
      ? searchParams.get('has_variants') === 'true'
      : undefined

    const products = await listProducts({ category, status, featured, search, hasVariants })

    return NextResponse.json({ data: { products, total: products.length } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error fetching products'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const product = await createProduct(body)
    return NextResponse.json({ data: product }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error creating product'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
