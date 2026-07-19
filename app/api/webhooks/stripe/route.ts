import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { executeAffiliateAttribution } from '@/lib/server/affiliate-attribution'
import { claimCouponForPaidOrder } from '@/lib/server/coupons/engine'
import { sendMetaPurchaseEvent } from '@/lib/server/meta-capi'
import { centavosToPesos } from '@/lib/tracking/currency'
import { mapStripeRefundStatus } from '@/lib/server/process-refund'
import { sendOrderConfirmationEmails } from '@/lib/email/send-order-emails'

/** Lazy-init: avoid instantiating Stripe at module load (breaks build when STRIPE_SECRET_KEY is unset). */
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) return null
  if (!/^sk_(test|live)_/.test(key)) return null
  return new Stripe(key, { apiVersion: '2026-02-25.clover' })
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
    const stripe = getStripe()
    if (!stripe || !webhookSecret) {
      return NextResponse.json({ error: 'Stripe no configurado' }, { status: 503 })
    }

    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    )

    const supabase = createServiceClient()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orderId = session.metadata?.order_id
        if (!orderId) break

        await supabase.from('orders').update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent as string,
        }).eq('id', orderId)

        await supabase.from('order_updates').insert({
          order_id: orderId,
          status: 'confirmed',
          message: 'Pago confirmado: pedido en pendiente de aceptación',
          updated_by: 'stripe_webhook',
          metadata: { event: 'payment_confirmed' },
        })

        // Everything below must be awaited — Vercel can freeze fire-and-forget
        // work as soon as the response is returned, silently dropping it.
        // Register coupon usage now that the order is paid (idempotent per order).
        await claimCouponForPaidOrder(orderId).catch((err) => {
          console.error('[stripe webhook] claimCouponForPaidOrder failed', { orderId, err })
        })

        const { data: order } = await supabase
          .from('orders')
          .select('total, coupon_code, customer_email, customer_phone, items')
          .eq('id', orderId)
          .single()

        if (order) {
          const attribution = await executeAffiliateAttribution({
            orderId,
            couponCode: order.coupon_code ?? null,
            cookieHeader: session.metadata?.referral_link_id
              ? `_nurei_ref=${session.metadata.referral_link_id}`
              : null,
          }).catch((err) => {
            console.error('[stripe webhook] executeAffiliateAttribution failed', { orderId, err })
            return null
          })

          // Mirrors the admin order-confirm route: a Stripe payment is itself
          // the confirmation, so approve immediately rather than leaving the
          // attribution stuck at payout_status='pending' forever (nothing else
          // approves attributions created via this path).
          if (attribution?.ok && attribution.attributed) {
            const { error: approveErr } = await supabase.rpc('approve_attribution_for_order', { p_order_id: orderId })
            if (approveErr) {
              console.error('[stripe webhook] approve_attribution_for_order failed', { orderId, approveErr })
            }
          }

          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const orderItems = (order.items as Array<{ product_id: string }>) ?? []
          await sendMetaPurchaseEvent({
            orderId,
            eventId: `purchase_${orderId}`,
            eventSourceUrl: `${appUrl}/pedido/${orderId}`,
            valuePesos: centavosToPesos(order.total),
            currency: 'MXN',
            contentIds: orderItems.map((item) => item.product_id),
            userData: {
              email: order.customer_email ?? undefined,
              phone: order.customer_phone ?? undefined,
              fbp: session.metadata?.fbp ?? undefined,
              fbc: session.metadata?.fbc ?? undefined,
              clientIpAddress: session.metadata?.client_ip ?? undefined,
              clientUserAgent: session.metadata?.client_ua ?? undefined,
            },
          }).catch((err) => {
            console.error('[stripe webhook] sendMetaPurchaseEvent failed', { orderId, err })
          })
        }

        // The email sender uses an order-scoped idempotency key, so Stripe
        // webhook retries cannot generate duplicate confirmations.
        const emailDelivery = await sendOrderConfirmationEmails(orderId)
        if (!emailDelivery.sent) {
          console.error('[email] Stripe payment confirmed but email was not sent', {
            orderId,
            eventId: event.id,
            reason: emailDelivery.reason,
          })
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent
        const orderId = intent.metadata?.order_id
        if (orderId) {
          await supabase.from('orders').update({
            payment_status: 'failed',
            status: 'failed',
            failure_reason: 'Pago rechazado por Stripe',
          }).eq('id', orderId)

          await supabase.from('order_updates').insert({
            order_id: orderId,
            status: 'failed',
            message: 'Stripe rechazó el pago',
            updated_by: 'stripe_webhook',
            metadata: { event: 'payment_failed' },
          })
        }
        break
      }

      case 'charge.refunded':
      case 'refund.updated': {
        const refund =
          event.type === 'refund.updated'
            ? (event.data.object as Stripe.Refund)
            : (event.data.object as Stripe.Charge).refunds?.data?.[0]
        if (!refund?.id) break

        const dbStatus = mapStripeRefundStatus(refund.status)

        if (dbStatus === 'failed') {
          // Reverse the ledger effects (order status/refunded amount, affiliate
          // commission clawback) that were applied optimistically when the
          // refund was created. The RPC itself updates order_refunds.status —
          // a plain update here would race with or precede its own state check.
          const { error: reverseErr } = await supabase.rpc('reverse_failed_refund_atomic', {
            p_stripe_refund_id: refund.id,
          })
          if (reverseErr) {
            console.error('[stripe-webhook] Error reversing failed refund:', reverseErr)
          }
        } else {
          await supabase
            .from('order_refunds')
            .update({ status: dbStatus })
            .eq('stripe_refund_id', refund.id)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
