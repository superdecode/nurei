import { NextRequest, NextResponse } from 'next/server'
import { sendOrderConfirmationEmails } from '@/lib/email/send-order-emails'
import { createServiceClient } from '@/lib/supabase/server'
import { executeAffiliateAttribution } from '@/lib/server/affiliate-attribution'

function notifyOrderEmails(
  orderId: string,
  method: string,
  meta?: { reference?: string; expiresAt?: string; bank?: string }
) {
  let pendingPaymentNote: string | undefined
  if (method === 'oxxo' && meta?.reference) {
    const exp = meta.expiresAt
      ? new Date(meta.expiresAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
      : ''
    pendingPaymentNote = `Paga en OXXO con la referencia ${meta.reference}.${exp ? ` Tienes hasta el ${exp}.` : ''} Cuando recibamos el pago, seguimos con tu pedido.`
  }
  if ((method === 'transfer' || method === 'bank_transfer') && meta?.reference) {
    pendingPaymentNote = `Transfiere usando la referencia ${meta.reference}.${meta.bank ? ` Datos: ${meta.bank}.` : ''} Te avisaremos al acreditar.`
  }

  void sendOrderConfirmationEmails(orderId, { pendingPaymentNote }).catch((err) =>
    console.error('[email] notifyOrderEmails:', err)
  )
}

function isCardExpired(expiry: string) {
  const parts = expiry.split('/')
  if (parts.length !== 2) return true
  const month = Number(parts[0])
  const yearShort = Number(parts[1])
  if (!month || month < 1 || month > 12 || Number.isNaN(yearShort)) return true

  const year = yearShort + 2000
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  if (year < currentYear) return true
  if (year === currentYear && month < currentMonth) return true
  return false
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const method = String(body?.method ?? '').trim()
    const orderId = String(body?.orderId ?? '')
    const amount = Number(body?.amount ?? 0)
    const cartLastUpdatedAt = String(body?.cartLastUpdatedAt ?? '')

    if (!orderId || !method || !amount) {
      return NextResponse.json(
        { error: 'Faltan datos para procesar el pago' },
        { status: 400 }
      )
    }

    if (cartLastUpdatedAt) {
      const lastUpdated = new Date(cartLastUpdatedAt).getTime()
      const age = Date.now() - lastUpdated
      const twoHours = 2 * 60 * 60 * 1000
      if (!Number.isNaN(lastUpdated) && age > twoHours) {
        return NextResponse.json(
          {
            error: 'Tu sesión de carrito expiró. Actualiza tu pedido para continuar.',
            code: 'CART_SESSION_TIMEOUT',
            retryable: true,
          },
          { status: 408 }
        )
      }
    }

    const cardLike =
      method === 'card' ||
      method === 'stripe_card' ||
      method.endsWith('_card')

    const supabase = createServiceClient()

    async function markOrderAsPaid(currentMethod: string) {
      const now = new Date().toISOString()
      const { data: order } = await supabase
        .from('orders')
        .select('id, coupon_code')
        .eq('id', orderId)
        .single()

      // 'paid' is NOT a valid value for status (constraint allows only pending/confirmed/shipped/delivered/cancelled/failed)
      // Use 'confirmed' for status and 'paid' for payment_status
      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          paid_at: now,
          confirmed_at: now,
          payment_method: currentMethod,
        })
        .eq('id', orderId)

      if (updateErr) console.error('[payment] markOrderAsPaid update failed', updateErr.message)

      await supabase.from('order_updates').insert({
        order_id: orderId,
        status: 'confirmed',
        message: 'Pago confirmado: pedido en pendiente de aceptación',
        updated_by: 'checkout_payment',
        metadata: { event: 'payment_confirmed', method: currentMethod },
      })

      return order?.coupon_code ?? null
    }

    if (cardLike) {
      const card = body?.card ?? {}
      const cardToken = String(card.token ?? '')
      const cardLast4 = String(card.last4 ?? '')
      const cardBrand = String(card.brand ?? 'unknown')
      const cardExpiry = String(card.expiry ?? '')
      const cardName = String(card.holderName ?? '').trim()

      if (!cardName) {
        return NextResponse.json(
          { error: 'Ingresa el nombre del titular de la tarjeta' },
          { status: 400 }
        )
      }

      if (!cardToken || cardToken.length < 8) {
        return NextResponse.json(
          { error: 'Token de tarjeta inválido' },
          { status: 400 }
        )
      }

      if (isCardExpired(cardExpiry)) {
        return NextResponse.json(
          { error: 'La tarjeta está vencida o la fecha es inválida' },
          { status: 400 }
        )
      }

      if (!/^\d{4}$/.test(cardLast4)) {
        return NextResponse.json(
          { error: 'Información de tarjeta incompleta' },
          { status: 400 }
        )
      }

      if (cardLast4 === '0000') {
        return NextResponse.json(
          {
            error: 'La pasarela rechazó la transacción. Puedes reintentar con otra tarjeta.',
            code: 'GATEWAY_DECLINED',
            retryable: true,
          },
          { status: 402 }
        )
      }

      const couponCode = await markOrderAsPaid(method)

      const rawCookie = request.headers.get('cookie') ?? ''
      const hasReferralCookie = rawCookie.includes('_nurei_ref')
      console.log('[payment] pre-attribution debug', {
        orderId,
        cookiePresent: Boolean(rawCookie),
        cookieHasReferral: hasReferralCookie,
        cookieLen: rawCookie.length,
        cookiePreview: hasReferralCookie ? rawCookie.slice(rawCookie.indexOf('_nurei_ref'), rawCookie.indexOf('_nurei_ref') + 30) : null,
      })

      const attribResult = await executeAffiliateAttribution({
        orderId,
        couponCode,
        cookieHeader: request.headers.get('cookie'),
      }).catch((err) => {
        console.error('[attribution] failed', err)
        return { ok: false, attributed: false, error: String(err) } as const
      })
      console.log('[attribution] result', { orderId, ...attribResult })

      notifyOrderEmails(orderId, method)

      return NextResponse.json({
        data: {
          status: 'approved',
          transactionId: `txn_${Date.now()}`,
          method,
          cardType: cardBrand,
          cardLast4,
        },
      })
    }

    if (method === 'oxxo') {
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      const reference = `98${Date.now().toString().slice(-10)}`
      notifyOrderEmails(orderId, 'oxxo', { reference, expiresAt })

      return NextResponse.json({
        data: {
          status: 'pending',
          method: 'oxxo',
          reference,
          expiresAt,
        },
      })
    }

    if (method === 'transfer' || method === 'bank_transfer') {
      const reference = `TR-${orderId.slice(-6).toUpperCase()}`
      const bank = 'Banco Nurei Demo'
      notifyOrderEmails(orderId, method, { reference, bank })

      return NextResponse.json({
        data: {
          status: 'pending',
          method,
          reference,
          bank,
        },
      })
    }

    // Efectivo / otros métodos en tienda: el pago se recibe en la entrega, NO al crear la orden.
    // No llamar markOrderAsPaid — el admin confirma manualmente cuando cobra el efectivo.
    // La atribución de afiliado se dispara cuando el admin confirma el pedido (vía admin orders API).
    notifyOrderEmails(orderId, method)

    return NextResponse.json({
      data: {
        status: 'pending',
        method,
      },
    })
  } catch {
    return NextResponse.json(
      {
        error: 'No pudimos procesar el pago por el momento. Intenta nuevamente.',
        retryable: true,
      },
      { status: 500 }
    )
  }
}
