import { NextRequest, NextResponse } from 'next/server'

type PaymentMethod = 'card' | 'oxxo' | 'transfer' | 'wallet'

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
    const method = String(body?.method ?? '') as PaymentMethod
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

    if (!['card', 'oxxo', 'transfer', 'wallet'].includes(method)) {
      return NextResponse.json(
        { error: 'Método de pago no soportado' },
        { status: 400 }
      )
    }

    if (method === 'card') {
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

      return NextResponse.json({
        data: {
          status: 'approved',
          transactionId: `txn_${Date.now()}`,
          method: 'card',
          cardType: cardBrand,
          cardLast4,
        },
      })
    }

    if (method === 'oxxo') {
      return NextResponse.json({
        data: {
          status: 'pending',
          method: 'oxxo',
          reference: `98${Date.now().toString().slice(-10)}`,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        },
      })
    }

    if (method === 'transfer') {
      return NextResponse.json({
        data: {
          status: 'pending',
          method: 'transfer',
          reference: `TR-${orderId.slice(-6).toUpperCase()}`,
          bank: 'Banco Nurei Demo',
        },
      })
    }

    return NextResponse.json({
      data: {
        status: 'approved',
        method: 'wallet',
        transactionId: `wl_${Date.now()}`,
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
