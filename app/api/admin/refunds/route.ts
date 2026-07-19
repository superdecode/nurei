import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { listRefunds } from '@/lib/supabase/queries/adminRefunds'
import { requireAdminPermission } from '@/lib/server/require-admin-permission'

export async function GET(request: NextRequest) {
  const guard = await requireAdminPermission('reembolsos', 'lectura')
  if (guard.error) return guard.error

  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)

    const result = await listRefunds(supabase, {
      page: Number(searchParams.get('page') ?? '1'),
      pageSize: Number(searchParams.get('pageSize') ?? '20'),
      status: searchParams.get('status') ?? undefined,
      refundMethod: searchParams.get('refundMethod') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortDir: (searchParams.get('sortDir') as 'asc' | 'desc') ?? undefined,
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al obtener reembolsos'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
