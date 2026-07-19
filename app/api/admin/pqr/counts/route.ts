import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminPermission } from '@/lib/server/require-admin-permission'
import { getPqrCounts } from '@/lib/supabase/queries/pqr'

export async function GET() {
  const guard = await requireAdminPermission('pqr', 'lectura')
  if (guard.error) return guard.error

  try {
    const supabase = createServiceClient()
    const counts = await getPqrCounts(supabase)
    return NextResponse.json({ data: counts })
  } catch {
    return NextResponse.json({ error: 'Error al cargar los conteos' }, { status: 500 })
  }
}
