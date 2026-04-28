import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id } = await params
  const sp = req.nextUrl.searchParams
  const page = parseInt(sp.get('page') ?? '1', 10)
  const limit = parseInt(sp.get('limit') ?? '20', 10)
  const offset = (page - 1) * limit

  const supabase = createServiceClient()

  const { data: payments, error, count } = await supabase
    .from('commission_payments')
    .select('id, amount_cents, payment_type, reference_number, notes, paid_at, attribution_ids, period_from, period_to', { count: 'exact' })
    .eq('affiliate_id', id)
    .order('paid_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: 'Error al obtener historial de pagos' }, { status: 500 })
  }

  const total = count ?? 0

  // For each payment, fetch the associated order details
  const enriched = await Promise.all(
    (payments ?? []).map(async (p) => {
      let orders: Array<{ short_id: string; total: number; customer_name: string | null }> = []
      if (p.attribution_ids && p.attribution_ids.length > 0) {
        const { data: attrs } = await supabase
          .from('affiliate_attributions')
          .select('order_id, orders(short_id, total, customer_name)')
          .in('id', p.attribution_ids)
        if (attrs) {
          orders = attrs.map((a) => {
            const o = a.orders as Record<string, unknown> | null
            return { short_id: o?.short_id ?? '', total: o?.total ?? 0, customer_name: o?.customer_name ?? null }
          })
        }
      }
      return { ...p, orders }
    })
  )

  return NextResponse.json({
    data: enriched,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id } = await params
  const body = await req.json()
  const { attribution_ids, payment_type, reference_number, notes } = body as {
    attribution_ids: string[]
    payment_type: 'efectivo' | 'transferencia' | 'otro'
    reference_number?: string
    notes?: string
  }

  if (!attribution_ids || !Array.isArray(attribution_ids) || attribution_ids.length === 0) {
    return NextResponse.json({ error: 'Selecciona al menos una orden' }, { status: 400 })
  }

  if (!payment_type) {
    return NextResponse.json({ error: 'Tipo de pago requerido' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 1. Get the attribution records to compute total
  const { data: attributions, error: attrErr } = await supabase
    .from('affiliate_attributions')
    .select('id, commission_amount_cents, payout_status, created_at')
    .eq('affiliate_id', id)
    .in('id', attribution_ids)

  if (attrErr || !attributions || attributions.length === 0) {
    return NextResponse.json({ error: 'No se encontraron las atribuciones seleccionadas' }, { status: 404 })
  }

  const totalAmount = attributions.reduce((sum, a) => sum + (a.commission_amount_cents ?? 0), 0)

  if (totalAmount <= 0) {
    return NextResponse.json({ error: 'El monto total debe ser mayor a 0' }, { status: 400 })
  }

  // 2. Compute period from/to from attribution dates
  const dates = attributions.map((a) => new Date(a.created_at))
  const periodFrom = new Date(Math.min(...dates.map((d) => d.getTime())))
  const periodTo = new Date(Math.max(...dates.map((d) => d.getTime())))

  // 3. Get admin user id
  const { data: adminUser } = await supabase.auth.admin.getUserById(
    (await supabase.auth.getUser()).data.user?.id ?? ''
  )

  // 4. Insert payment record
  const { data: payment, error: insertErr } = await supabase
    .from('commission_payments')
    .insert({
      affiliate_id: id,
      amount_cents: totalAmount,
      period_from: periodFrom.toISOString().slice(0, 10),
      period_to: periodTo.toISOString().slice(0, 10),
      attribution_ids,
      payment_type,
      reference_number: reference_number || null,
      notes: notes || null,
      paid_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertErr) {
    return NextResponse.json({ error: 'Error al registrar pago: ' + insertErr.message }, { status: 500 })
  }

  // 5. Update attribution records to paid
  const { error: updateErr } = await supabase
    .from('affiliate_attributions')
    .update({ payout_status: 'paid' })
    .in('id', attribution_ids)
    .eq('affiliate_id', id)

  if (updateErr) {
    console.error('[payment] error updating attribution status:', updateErr.message)
  }

  // 6. Update affiliate's pending_payout_cents
  const { data: remainingAttrs } = await supabase
    .from('affiliate_attributions')
    .select('commission_amount_cents')
    .eq('affiliate_id', id)
    .in('payout_status', ['pending', 'approved'])

  const newPending = (remainingAttrs ?? []).reduce((s, a) => s + (a.commission_amount_cents ?? 0), 0)
  await supabase
    .from('affiliate_profiles')
    .update({ pending_payout_cents: newPending })
    .eq('id', id)

  return NextResponse.json({ data: payment })
}
