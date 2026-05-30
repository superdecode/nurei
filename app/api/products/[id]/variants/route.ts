import { NextRequest, NextResponse } from 'next/server'
import { listVariants, upsertVariants } from '@/lib/supabase/queries/products'
import { requireAdmin } from '@/lib/server/require-admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const variants = await listVariants(id)
    return NextResponse.json({ data: variants })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error fetching variants'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const { id } = await params
    const { variants } = await request.json()
    const result = await upsertVariants(id, variants)
    return NextResponse.json({ data: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error updating variants'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
