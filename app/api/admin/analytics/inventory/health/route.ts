import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { getInventoryHealth } from '@/lib/supabase/queries/analytics'

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const supabase = createServiceClient()
  const data = await getInventoryHealth(supabase)

  return NextResponse.json({ data, meta: { generatedAt: new Date().toISOString() } })
}
