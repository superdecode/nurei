import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrderFunnel } from '@/lib/supabase/queries/analytics'

const schema = z.object({
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
})

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const parsed = schema.safeParse({
    dateFrom: request.nextUrl.searchParams.get('dateFrom') ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    dateTo: request.nextUrl.searchParams.get('dateTo') ?? new Date().toISOString().slice(0, 10),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createServiceClient()
  const data = await getOrderFunnel(supabase, parsed.data)

  return NextResponse.json({ data, meta: { from: parsed.data.dateFrom, to: parsed.data.dateTo, generatedAt: new Date().toISOString() } })
}
