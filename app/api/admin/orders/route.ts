import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { listOrders } from '@/lib/supabase/queries/adminOrders'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)

    const result = await listOrders(supabase, {
      page: Number(searchParams.get('page') ?? '1'),
      pageSize: Number(searchParams.get('pageSize') ?? '20'),
      status: searchParams.get('status') ?? undefined,
      paymentMethod: searchParams.get('paymentMethod') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortDir: (searchParams.get('sortDir') as 'asc' | 'desc') ?? undefined,
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al obtener pedidos'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
