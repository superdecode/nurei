import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id: affiliateId } = await params
  const { attributionIds, notes, periodFrom, periodTo } = await request.json()

  if (!Array.isArray(attributionIds) || attributionIds.length === 0 || !periodFrom || !periodTo) {
    return NextResponse.json({ error: 'attributionIds, periodFrom y periodTo requeridos' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify which of the submitted IDs are actually pending for this affiliate
  const { data: pending, error: fetchError } = await supabase
    .from('affiliate_attributions')
    .select('id')
    .in('id', attributionIds)
    .eq('affiliate_id', affiliateId)
    .eq('payout_status', 'pending')

  if (fetchError) {
    return NextResponse.json({ error: 'Error al verificar atribuciones' }, { status: 500 })
  }
  if (!pending?.length) {
    return NextResponse.json({ error: 'No se encontraron atribuciones pendientes' }, { status: 400 })
  }

  // Warn if some submitted IDs were skipped (already paid or wrong affiliate)
  const skippedCount = attributionIds.length - pending.length
  const validIds = pending.map((a) => a.id)

  // Use atomic DB function: marks attributions paid + updates balance in one transaction
  const { data: amountPaid, error: rpcErr } = await supabase.rpc('process_affiliate_payout_atomic', {
    p_affiliate_id:    affiliateId,
    p_attribution_ids: validIds,
    p_period_from:     periodFrom,
    p_period_to:       periodTo,
    p_paid_by:         guard.userId,
    p_notes:           notes ?? null,
  })

  if (rpcErr) {
    return NextResponse.json({ error: 'Error al procesar pago' }, { status: 500 })
  }
  if (!amountPaid || amountPaid === 0) {
    return NextResponse.json({ error: 'No se procesó ningún pago' }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    amountPaidCents: amountPaid,
    ...(skippedCount > 0 && {
      warning: `${skippedCount} atribución(es) omitida(s) porque ya estaban pagadas o no pertenecen a este afiliado`,
    }),
  })
}
