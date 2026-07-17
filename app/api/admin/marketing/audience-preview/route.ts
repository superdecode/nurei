import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { buildAudienceFilter } from '@/lib/marketing/audience-filter'
import { resolveAudience } from '@/lib/supabase/queries/marketing'

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const body = await request.json()
    const segments = Array.isArray(body.segments) ? body.segments : []
    const tags = Array.isArray(body.tags) ? body.tags : []
    const filter = buildAudienceFilter({ segments, tags })
    const supabase = createServiceClient()
    const audience = await resolveAudience(supabase, filter)
    return NextResponse.json({ data: { count: audience.length } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al calcular audiencia'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
