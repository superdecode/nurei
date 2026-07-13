import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { getCrmStats } from '@/lib/supabase/queries/crm'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const supabase = createServiceClient()
    const stats = await getCrmStats(supabase)
    return NextResponse.json({ data: stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error cargando estadísticas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
