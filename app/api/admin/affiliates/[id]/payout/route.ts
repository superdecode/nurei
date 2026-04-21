import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id: affiliateId } = await params
  const { attributionIds, notes, periodFrom, periodTo } = await request.json()

  if (!attributionIds?.length || !periodFrom || !periodTo) {
    return NextResponse.json({ error: 'attributionIds, periodFrom y periodTo requeridos' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: attrs, error: fetchError } = await supabase
    .from('affiliate_attributions')
    .select('id, commission_amount_cents')
    .in('id', attributionIds)
    .eq('affiliate_id', affiliateId)
    .eq('payout_status', 'pending')

  if (fetchError || !attrs?.length) {
    return NextResponse.json({ error: 'No se encontraron atribuciones pendientes' }, { status: 400 })
  }

  const totalCents = attrs.reduce((s, a) => s + a.commission_amount_cents, 0)
  const now = new Date().toISOString()

  const { error: payError } = await supabase.from('commission_payments').insert({
    affiliate_id: affiliateId,
    amount_cents: totalCents,
    period_from: periodFrom,
    period_to: periodTo,
    attribution_ids: attrs.map((a) => a.id),
    notes: notes ?? null,
    paid_by: guard.userId,
    paid_at: now,
  })

  if (payError) return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 })

  await supabase
    .from('affiliate_attributions')
    .update({ payout_status: 'paid', paid_at: now })
    .in('id', attrs.map((a) => a.id))

  const { data: profile } = await supabase
    .from('affiliate_profiles')
    .select('pending_payout_cents, total_earned_cents')
    .eq('id', affiliateId)
    .single()

  if (profile) {
    await supabase
      .from('affiliate_profiles')
      .update({
        pending_payout_cents: Math.max(0, profile.pending_payout_cents - totalCents),
        total_earned_cents: profile.total_earned_cents + totalCents,
      })
      .eq('id', affiliateId)
  }

  return NextResponse.json({ ok: true, amountPaidCents: totalCents })
}
