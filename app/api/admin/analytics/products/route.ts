import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { getProductPerformance } from '@/lib/supabase/queries/analytics'

const schema = z.object({
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  sortBy: z.string().default('revenue'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const parsed = schema.safeParse({
    dateFrom: request.nextUrl.searchParams.get('dateFrom') ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    dateTo: request.nextUrl.searchParams.get('dateTo') ?? new Date().toISOString().slice(0, 10),
    sortBy: request.nextUrl.searchParams.get('sortBy') ?? 'revenue',
    limit: request.nextUrl.searchParams.get('limit') ?? '50',
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { dateFrom, dateTo, sortBy, limit } = parsed.data
  const supabase = createServiceClient()
  const data = await getProductPerformance(supabase, { dateFrom, dateTo }, sortBy, limit)

  return NextResponse.json({ data, meta: { from: dateFrom, to: dateTo, generatedAt: new Date().toISOString() } })
}
