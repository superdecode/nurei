import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { listCompanies, createCompany } from '@/lib/supabase/queries/crm'
import { createCompanySchema } from '@/lib/validations/crm'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const supabase = createServiceClient()
    const companies = await listCompanies(supabase, {
      search: request.nextUrl.searchParams.get('search') ?? undefined,
    })
    return NextResponse.json({ data: companies })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error listando empresas'
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()
    const parsed = createCompanySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const supabase = createServiceClient()
    const company = await createCompany(supabase, parsed.data, auth.userId)
    return NextResponse.json({ data: company }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error creando empresa'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
