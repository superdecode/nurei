import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAffiliate } from '@/lib/server/require-affiliate'

const VALID_PAYOUT_STATUSES = ['pending', 'approved', 'paid'] as const

export async function GET(request: NextRequest) {
  const guard = await requireAffiliate()
  if (guard.error) return guard.error

  const affiliateId = guard.userId!
  const { searchParams } = request.nextUrl

  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const type = searchParams.get('type')
  const status = searchParams.get('status')

  const supabase = createServiceClient()
  let query = supabase
    .from('affiliate_attributions')
    .select(`
      id, order_id, attribution_type, coupon_id, coupon_code,
      commission_pct, commission_amount_cents, payout_status, paid_at, created_at,
      orders ( short_id, total, created_at, status, payment_method ),
      coupons ( code )
    `)
    .eq('affiliate_id', affiliateId)
    .order('created_at', { ascending: false })

  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)
  if (type && (type === 'coupon' || type === 'cookie')) query = query.eq('attribution_type', type)
  if (status && (VALID_PAYOUT_STATUSES as readonly string[]).includes(status)) {
    query = query.eq('payout_status', status)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: 'Error al obtener órdenes' }, { status: 500 })

  const rows = (data ?? []).map((row) => {
    const { coupons, coupon_code, ...rest } = row as typeof row & { coupons: { code: string } | null }
    return { ...rest, coupon_code: coupon_code ?? coupons?.code ?? null }
  })

  return NextResponse.json({ data: rows })
}
