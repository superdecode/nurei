import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { listActivities, createManualActivity } from '@/lib/supabase/queries/crm'
import { createActivitySchema } from '@/lib/validations/crm'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const sp = request.nextUrl.searchParams
    const dealId = sp.get('dealId') ?? undefined
    const customerId = sp.get('customerId') ?? undefined
    const companyId = sp.get('companyId') ?? undefined
    if (!dealId && !customerId && !companyId) {
      return NextResponse.json({ error: 'Se requiere dealId, customerId o companyId' }, { status: 400 })
    }
    const supabase = createServiceClient()
    const activities = await listActivities(supabase, { dealId, customerId, companyId })
    return NextResponse.json({ data: activities })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error cargando la actividad'
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()
    const parsed = createActivitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const supabase = createServiceClient()
    await createManualActivity(supabase, parsed.data, auth.userId)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error registrando la actividad'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
