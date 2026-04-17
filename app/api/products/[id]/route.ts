import { NextRequest, NextResponse } from 'next/server'
import { getProduct, updateProduct, deleteProduct } from '@/lib/supabase/queries/products'
import { listVariants } from '@/lib/supabase/queries/products'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

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
    const adminCheck = await requireAdmin()
    if (adminCheck.error) return adminCheck.error

    const { id } = await params
    const body = await request.json()
    const previous = await getProduct(id)
    const product = await updateProduct(id, body)

    const nextStock = typeof body.stock_quantity === 'number' ? body.stock_quantity : null
    const prevStock = previous.stock_quantity ?? 0
    if (nextStock !== null && nextStock !== prevStock) {
      const diff = nextStock - prevStock
      const internalReference = `INV-AJU-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`
      await createServiceClient().from('inventory_movements').insert({
        product_id: id,
        type: 'ajuste',
        quantity: diff,
        reason: body.inventory_note?.trim() || 'Ajuste desde edición de producto',
        reference: internalReference,
        created_by: adminCheck.userId,
      })
    }
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
    const adminCheck = await requireAdmin()
    if (adminCheck.error) return adminCheck.error

    const { id } = await params
    await deleteProduct(id)
    return NextResponse.json({ data: { success: true } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error deleting product'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
