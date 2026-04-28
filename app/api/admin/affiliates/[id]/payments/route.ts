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

  try {
    const { data: paymentsData, error, count } = await supabase
      .from('commission_payments')
      .select('id, amount_cents, period_from, period_to, attribution_ids, notes, paid_at', { count: 'exact' })
      .eq('affiliate_id', id)
      .order('paid_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[payments API error]', error)
      return NextResponse.json({ error: 'Error al obtener historial de pagos' }, { status: 500 })
    }

    const total = count ?? 0
    const payments = paymentsData ?? []

    const enriched = await Promise.all(
      payments.map(async (p) => {
        let orders: Array<{ short_id: string; total: number; customer_name: string | null }> = []
        if (p.attribution_ids && p.attribution_ids.length > 0) {
          try {
            const { data: attrs } = await supabase
              .from('affiliate_attributions')
              .select('order_id, orders(short_id, total, customer_name)')
              .in('id', p.attribution_ids)
            if (attrs) {
              orders = attrs.map((a) => {
                const orderData = a.orders as unknown as Record<string, unknown> | null
                if (!orderData) return { short_id: '', total: 0, customer_name: null }
                const shortId = orderData.short_id as string | undefined
                const total = orderData.total as number | undefined
                const customerName = orderData.customer_name as string | null | undefined
                return { short_id: shortId ?? '', total: total ?? 0, customer_name: customerName ?? null }
              })
            }
          } catch (err) {
            console.error('[payments API] Error fetching orders for payment:', p.id, err)
          }
        }
        return { ...p, orders }
      })
    )

    return NextResponse.json({
      data: enriched,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    })
  } catch (err) {
    console.error('[payments API] Unexpected error:', err)
    return NextResponse.json({ error: 'Error al obtener historial de pagos' }, { status: 500 })
  }
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

  if (!payment_type || !payment_type.trim()) {
    return NextResponse.json({ error: 'Tipo de pago requerido' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
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

    const dates = attributions.map((a) => new Date(a.created_at))
    const periodFrom = new Date(Math.min(...dates.map((d) => d.getTime())))
    const periodTo = new Date(Math.max(...dates.map((d) => d.getTime())))

    const { data: paymentData, error: insertErr } = await supabase
      .from('commission_payments')
      .insert({
        affiliate_id: id,
        amount_cents: totalAmount,
        period_from: periodFrom.toISOString().slice(0, 10),
        period_to: periodTo.toISOString().slice(0, 10),
        attribution_ids,
        notes: notes || null,
        payment_type: payment_type ?? 'transferencia',
        reference_number: reference_number || null,
        paid_by: guard.userId,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertErr) {
      console.error('[payments API] Error inserting payment:', insertErr)
      return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 })
    }

    const { error: updateErr } = await supabase
      .from('affiliate_attributions')
      .update({ payout_status: 'paid' })
      .in('id', attribution_ids)
      .eq('affiliate_id', id)

    if (updateErr) {
      console.error('[payments API] Error updating attribution status:', updateErr)
      return NextResponse.json({ error: 'Pago registrado pero hubo error al actualizar estados' }, { status: 500 })
    }

    const { data: remainingAttrs } = await supabase
      .from('affiliate_attributions')
      .select('commission_amount_cents')
      .eq('affiliate_id', id)
      .in('payout_status', ['pending', 'approved'])

    const newPending = (remainingAttrs ?? []).reduce((sum, a) => sum + (a.commission_amount_cents ?? 0), 0)

    const { error: profileErr } = await supabase
      .from('affiliate_profiles')
      .update({ pending_payout_cents: newPending })
      .eq('id', id)

    if (profileErr) {
      console.error('[payments API] Error updating profile pending amount:', profileErr)
    }

    return NextResponse.json({ data: paymentData })
  } catch (err) {
    console.error('[payments API] Unexpected error:', err)
    return NextResponse.json({ error: 'Error al procesar pago' }, { status: 500 })
  }
}
