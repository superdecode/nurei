import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { getCustomerStats } from '@/lib/supabase/queries/customers'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const supabase = createServiceClient()
    const stats = await getCustomerStats(supabase)
    return NextResponse.json({ data: stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error obteniendo estadísticas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
