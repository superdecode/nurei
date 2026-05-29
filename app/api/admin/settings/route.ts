import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSettings, upsertSetting, upsertMultipleSettings } from '@/lib/supabase/queries/settings'
import { requireAdmin } from '@/lib/server/require-admin'

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const supabase = createServiceClient()
    const settings = await getSettings(supabase)
    return NextResponse.json({ data: settings })
  } catch {
    return NextResponse.json({ data: {}, error: 'Error fetching settings' })
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const supabase = createServiceClient()
    const body = await request.json()

    // Single key update
    if (body.key && body.value !== undefined) {
      await upsertSetting(supabase, body.key, body.value, body.description)
      return NextResponse.json({ success: true })
    }

    // Multiple settings
    if (body.settings && typeof body.settings === 'object') {
      await upsertMultipleSettings(supabase, body.settings)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error saving settings'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
