import { NextRequest, NextResponse } from 'next/server'
import { executeAffiliateAttribution } from '@/lib/server/affiliate-attribution'

interface AttributionPayload {
  orderId: string
  couponCode?: string | null
  cookieHeader?: string | null
}

function verifySecret(request: NextRequest): boolean {
  const secret = process.env.AFFILIATE_ATTRIBUTION_SECRET
  if (!secret) return false // fail-secure: no secret configured = reject all
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body: AttributionPayload = await request.json()
    const { orderId, couponCode, cookieHeader } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId requerido' }, { status: 400 })
    }
    const result = await executeAffiliateAttribution({ orderId, couponCode, cookieHeader })
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Error al registrar atribución' }, { status: result.status ?? 500 })
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
