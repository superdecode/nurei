import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAffiliate } from '@/lib/server/require-affiliate'

export async function GET() {
  const guard = await requireAffiliate()
  if (guard.error) return guard.error

  const affiliateId = guard.userId!
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('commission_payments')
    .select('id, affiliate_id, amount_cents, period_from, period_to, attribution_ids, notes, paid_at')
    .eq('affiliate_id', affiliateId)
    .order('paid_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Error al obtener pagos' }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
