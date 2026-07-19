import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminPermission } from '@/lib/server/require-admin-permission'
import { listPqrTickets } from '@/lib/supabase/queries/pqr'
import type { PqrPriority, PqrStatus, PqrType } from '@/types'

export async function GET(request: NextRequest) {
  const guard = await requireAdminPermission('pqr', 'lectura')
  if (guard.error) return guard.error

  try {
    const supabase = createServiceClient()
    const sp = request.nextUrl.searchParams
    const result = await listPqrTickets(supabase, {
      page: Number(sp.get('page') ?? '1'),
      pageSize: Number(sp.get('pageSize') ?? '20'),
      estado: (sp.get('estado') as PqrStatus | 'all' | null) ?? 'all',
      prioridad: (sp.get('prioridad') as PqrPriority | 'all' | null) ?? 'all',
      tipo: (sp.get('tipo') as PqrType | 'all' | null) ?? 'all',
      search: sp.get('search') ?? undefined,
    })
    return NextResponse.json({ data: result })
  } catch {
    return NextResponse.json({ error: 'Error al cargar los PQR' }, { status: 500 })
  }
}
