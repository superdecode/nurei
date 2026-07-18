import { NextRequest, NextResponse } from 'next/server'
import { duplicateProduct } from '@/lib/supabase/queries/products'
import { requireAdmin } from '@/lib/server/require-admin'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  try {
    const { id } = await params
    const product = await duplicateProduct(id)
    return NextResponse.json({ data: product }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error duplicating product'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
