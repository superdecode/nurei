import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { getDeal, updateDeal, deleteDeal } from '@/lib/supabase/queries/crm'
import { updateDealSchema } from '@/lib/validations/crm'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params

  try {
    const supabase = createServiceClient()
    const deal = await getDeal(supabase, id)
    if (!deal) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })
    return NextResponse.json({ data: deal })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error cargando oportunidad'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params

  try {
    const body = await request.json()
    const parsed = updateDealSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const supabase = createServiceClient()
    const deal = await updateDeal(supabase, id, parsed.data, auth.userId)
    return NextResponse.json({ data: deal })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error actualizando oportunidad'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params

  try {
    const supabase = createServiceClient()
    await deleteDeal(supabase, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error eliminando oportunidad'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
