import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { getRevenueTimeSeries } from '@/lib/supabase/queries/analytics'

const schema = z.object({
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
})

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const parsed = schema.safeParse({
    dateFrom: request.nextUrl.searchParams.get('dateFrom') ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    dateTo: request.nextUrl.searchParams.get('dateTo') ?? new Date().toISOString().slice(0, 10),
    granularity: request.nextUrl.searchParams.get('granularity') ?? 'day',
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { dateFrom, dateTo, granularity } = parsed.data
  const supabase = createServiceClient()
  const data = await getRevenueTimeSeries(supabase, { dateFrom, dateTo }, granularity)

  return NextResponse.json({ data, meta: { from: dateFrom, to: dateTo, generatedAt: new Date().toISOString() } })
}
