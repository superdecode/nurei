import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { getCompany, updateCompany, deleteCompany } from '@/lib/supabase/queries/crm'
import { updateCompanySchema } from '@/lib/validations/crm'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params

  try {
    const supabase = createServiceClient()
    const company = await getCompany(supabase, id)
    if (!company) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    return NextResponse.json({ data: company })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error cargando empresa'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params

  try {
    const body = await request.json()
    const parsed = updateCompanySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const supabase = createServiceClient()
    const company = await updateCompany(supabase, id, parsed.data)
    return NextResponse.json({ data: company })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error actualizando empresa'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params

  try {
    const supabase = createServiceClient()
    await deleteCompany(supabase, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error eliminando empresa'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
