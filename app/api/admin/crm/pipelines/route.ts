import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { listPipelines } from '@/lib/supabase/queries/crm'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const supabase = createServiceClient()
    const pipelines = await listPipelines(supabase)
    return NextResponse.json({ data: pipelines })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error cargando pipelines'
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
}
