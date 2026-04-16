import { NextRequest, NextResponse } from 'next/server'
import { getProduct, updateProduct, deleteProduct } from '@/lib/supabase/queries/products'
import { listVariants } from '@/lib/supabase/queries/products'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await getProduct(id)
    const variants = await listVariants(id)
    return NextResponse.json({ data: { ...product, variants } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Product not found'
    return NextResponse.json({ error: message }, { status: 404 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const product = await updateProduct(id, body)
    return NextResponse.json({ data: product })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error updating product'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteProduct(id)
    return NextResponse.json({ data: { success: true } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error deleting product'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
