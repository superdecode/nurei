import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { listDeals, createDeal } from '@/lib/supabase/queries/crm'
import { createDealSchema } from '@/lib/validations/crm'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const sp = request.nextUrl.searchParams
    const supabase = createServiceClient()
    const deals = await listDeals(supabase, {
      status: (sp.get('status') as 'open' | 'won' | 'lost' | 'all' | null) ?? undefined,
      customerId: sp.get('customerId') ?? undefined,
      companyId: sp.get('companyId') ?? undefined,
      search: sp.get('search') ?? undefined,
    })
    return NextResponse.json({ data: deals })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error listando oportunidades'
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()
    const parsed = createDealSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const supabase = createServiceClient()
    const deal = await createDeal(supabase, parsed.data, auth.userId)
    return NextResponse.json({ data: deal }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error creando oportunidad'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
