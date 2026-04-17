import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('orders')
      .select('status')

    if (error) throw error

    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      counts[row.status] = (counts[row.status] ?? 0) + 1
    }
    return NextResponse.json({ data: counts })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error'
    return NextResponse.json({ error: message, data: {} }, { status: 500 })
  }
}
