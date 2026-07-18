import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { listActiveCoupons } from '@/lib/supabase/queries/marketing'

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const supabase = createServiceClient()
    const coupons = await listActiveCoupons(supabase)
    return NextResponse.json({ data: coupons })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al listar cupones'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
