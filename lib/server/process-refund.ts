import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { validateRefundRequest, resolveRefundMethod } from './refund-validation'
import { sendOrderRefundEmail } from '@/lib/email/send-order-emails'

export interface ProcessRefundParams {
  orderId: string
  amountCents: number
  reason: string
  referenceNote?: string | null
  processedBy: string
}

export interface ProcessRefundResult {
  ok: boolean
  error?: string
  status?: number
  refundId?: string
}

/**
 * Maps a Stripe refund status to the three values order_refunds.status accepts
 * (per the CHECK constraint in supabase/migrations/051_refund_system.sql).
 * 'requires_action' and 'null' are treated as non-final, same as 'pending'.
 */
function mapStripeRefundStatus(
  status: Stripe.Refund['status']
): 'pending' | 'succeeded' | 'failed' {
  if (status === 'succeeded') return 'succeeded'
  if (status === 'failed' || status === 'canceled') return 'failed'
  return 'pending'
}

export async function processRefund(
  supabase: SupabaseClient,
  stripe: Stripe,
  params: ProcessRefundParams
): Promise<ProcessRefundResult> {
  const { orderId, amountCents, reason, referenceNote, processedBy } = params

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, total, refunded_amount_cents, payment_status, payment_method, stripe_payment_intent_id')
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    return { ok: false, error: 'Pedido no encontrado', status: 404 }
  }

  const validation = validateRefundRequest(
    {
      total: order.total,
      refunded_amount_cents: order.refunded_amount_cents ?? 0,
      payment_status: order.payment_status,
    },
    amountCents,
    reason
  )
  if (!validation.ok) {
    return { ok: false, error: validation.error, status: 422 }
  }

  const refundMethod = resolveRefundMethod(order.payment_method)
  let stripeRefundId: string | null = null
  // Manual refunds (cash/transfer) are always immediately final — the admin
  // already performed the transfer before confirming in the UI.
  let initialStatus: 'pending' | 'succeeded' | 'failed' = 'succeeded'

  if (refundMethod === 'stripe') {
    if (!order.stripe_payment_intent_id) {
      return { ok: false, error: 'El pedido no tiene un pago de Stripe asociado', status: 422 }
    }
    try {
      const refund = await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        amount: amountCents,
        reason: 'requested_by_customer',
      })
      stripeRefundId = refund.id
      initialStatus = mapStripeRefundStatus(refund.status)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al procesar el reembolso en Stripe'
      return { ok: false, error: message, status: 502 }
    }
  }

  const { data: refundId, error: rpcErr } = await supabase.rpc('process_order_refund_atomic', {
    p_order_id: orderId,
    p_amount_cents: amountCents,
    p_reason: reason.trim(),
    p_refund_method: refundMethod,
    p_stripe_refund_id: stripeRefundId,
    p_notes: referenceNote?.trim() || null,
    p_processed_by: processedBy,
    p_initial_status: initialStatus,
  })

  if (rpcErr) {
    // A Stripe refund can't be undone from here — this must be loud, not swallowed.
    console.error('[refund] CRITICAL: refund executed but DB write failed — manual reconciliation required', {
      orderId,
      stripeRefundId,
      amountCents,
      error: rpcErr.message,
    })
    return {
      ok: false,
      error: 'El reembolso se procesó pero hubo un error al registrarlo. Contacta a soporte técnico.',
      status: 500,
    }
  }

  void sendOrderRefundEmail(orderId, { amountCents, reason: reason.trim(), refundMethod }).catch((e) => {
    console.error('[refund] Error enviando correo de reembolso:', e)
  })

  return { ok: true, refundId: refundId as string }
}
