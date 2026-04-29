import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { getRevenueForecast } from '@/lib/supabase/queries/analytics'

const schema = z.object({
  historicalDays: z.coerce.number().int().min(14).max(365).default(90),
  forecastDays: z.coerce.number().int().min(7).max(90).default(30),
})

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const parsed = schema.safeParse({
    historicalDays: request.nextUrl.searchParams.get('historicalDays') ?? '90',
    forecastDays: request.nextUrl.searchParams.get('forecastDays') ?? '30',
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createServiceClient()
  const data = await getRevenueForecast(supabase, parsed.data.historicalDays, parsed.data.forecastDays)

  return NextResponse.json({ data, meta: { generatedAt: new Date().toISOString() } })
}
