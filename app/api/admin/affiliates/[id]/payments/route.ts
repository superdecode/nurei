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
      .select('id, amount_cents, period_from, period_to, attribution_ids, notes, paid_at, payment_type, reference_number', { count: 'exact' })
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
        let orders: Array<{ short_id: string; total: number; customer_name: string | null; order_date: string | null }> = []
        if (p.attribution_ids && p.attribution_ids.length > 0) {
          try {
            const { data: attrs } = await supabase
              .from('affiliate_attributions')
              .select('order_id, orders(short_id, total, customer_name, created_at)')
              .in('id', p.attribution_ids)
            if (attrs) {
              orders = attrs.map((a) => {
                const orderData = a.orders as unknown as Record<string, unknown> | null
                if (!orderData) return { short_id: '', total: 0, customer_name: null, order_date: null }
                const shortId = orderData.short_id as string | undefined
                const total = orderData.total as number | undefined
                const customerName = orderData.customer_name as string | null | undefined
                const orderDate = orderData.created_at as string | null | undefined
                return { short_id: shortId ?? '', total: total ?? 0, customer_name: customerName ?? null, order_date: orderDate ?? null }
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
    // Only need id/created_at to derive the period range — the RPC does its own
    // internal fetch (and its own filtering to payout_status = 'approved') for
    // the amounts.
    const { data: attributions, error: attrErr } = await supabase
      .from('affiliate_attributions')
      .select('id, created_at')
      .eq('affiliate_id', id)
      .in('id', attribution_ids)

    if (attrErr || !attributions || attributions.length === 0) {
      return NextResponse.json({ error: 'No se encontraron las atribuciones seleccionadas' }, { status: 404 })
    }

    const dates = attributions.map((a) => new Date(a.created_at))
    const periodFrom = new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10)
    const periodTo = new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10)

    // Atomic, row-locked RPC: fetches/filters attributions, nets out clawback
    // debt, inserts the commission_payments row, marks attributions paid, and
    // updates the affiliate profile balances — all in one transaction.
    const { data: amountPaid, error: rpcErr } = await supabase.rpc('process_affiliate_payout_atomic', {
      p_affiliate_id: id,
      p_attribution_ids: attribution_ids,
      p_period_from: periodFrom,
      p_period_to: periodTo,
      p_paid_by: guard.userId,
      p_notes: notes || null,
      p_payment_type: payment_type,
      p_reference_number: reference_number || null,
    })

    if (rpcErr) {
      console.error('[payments API] Error calling process_affiliate_payout_atomic:', rpcErr)
      return NextResponse.json({ error: 'Error al procesar pago' }, { status: 500 })
    }

    if (!amountPaid || amountPaid === 0) {
      return NextResponse.json({ error: 'No se procesó ningún pago' }, { status: 400 })
    }

    // The RPC returns only the net amount paid, not the row it inserted. Correlate
    // back to the exact row it just created using the values we know precisely:
    // affiliate_id, the net amount (from the RPC's own return value), the period
    // range, payment_type and paid_by — all supplied by/derived from this same
    // call, ordered by paid_at desc as a tiebreaker for the (practically
    // impossible) case of two identical payments landing at the same instant.
    let paymentQuery = supabase
      .from('commission_payments')
      .select('id, amount_cents, period_from, period_to, attribution_ids, notes, paid_at, payment_type, reference_number')
      .eq('affiliate_id', id)
      .eq('amount_cents', amountPaid)
      .eq('period_from', periodFrom)
      .eq('period_to', periodTo)
      .eq('payment_type', payment_type)
      .eq('paid_by', guard.userId)

    paymentQuery = reference_number
      ? paymentQuery.eq('reference_number', reference_number)
      : paymentQuery.is('reference_number', null)

    const { data: paymentData, error: fetchPaymentErr } = await paymentQuery
      .order('paid_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchPaymentErr || !paymentData) {
      // Payment already succeeded atomically via the RPC — this only affects
      // the response payload, not the money movement, so don't surface it as
      // a failed payment to the admin.
      console.error('[payments API] Payment processed but could not fetch back the created row:', fetchPaymentErr)
      return NextResponse.json({ data: null })
    }

    return NextResponse.json({ data: paymentData })
  } catch (err) {
    console.error('[payments API] Unexpected error:', err)
    return NextResponse.json({ error: 'Error al procesar pago' }, { status: 500 })
  }
}
