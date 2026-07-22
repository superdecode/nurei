import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { validateRedemptionAmount } from '@/lib/server/loyalty/points'
import { rateLimit, getClientIp } from '@/lib/server/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const rl = rateLimit(`loyalty-redeem-validate:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ valid: false, error: 'Demasiados intentos. Intenta en un momento.' }, { status: 429 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ valid: false, error: 'Debes iniciar sesión para canjear puntos' }, { status: 401 })
    }

    const body = await request.json()
    const points = Number(body?.points ?? 0)
    const subtotal = Number(body?.subtotal ?? 0)
    const couponDiscount = Number(body?.couponDiscount ?? 0)

    if (!Number.isInteger(points) || points < 0 || Number.isNaN(subtotal)) {
      return NextResponse.json({ valid: false, error: 'Datos inválidos' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data: loyalty } = await service
      .from('loyalty_points')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    const result = validateRedemptionAmount({
      points,
      balance: loyalty?.balance ?? 0,
      subtotal,
      couponDiscount,
    })

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ valid: true, discount_cents: result.discountCents })
  } catch {
    return NextResponse.json({ valid: false, error: 'No pudimos validar el canje de puntos' }, { status: 500 })
  }
}
