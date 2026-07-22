import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/server/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const rl = rateLimit(`loyalty-wheel-spin:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 })
    }

    const body = await request.json()
    const cartSessionId = String(body?.cart_session_id ?? '').trim()
    const subtotal = Number(body?.subtotal ?? 0)

    if (!cartSessionId || !Number.isFinite(subtotal)) {
      return NextResponse.json({ ok: false, reason: 'invalid_input' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data, error } = await service.rpc('resolve_wheel_spin_atomic', {
      p_user_id: user.id,
      p_cart_session_id: cartSessionId,
      p_cart_subtotal_cents: Math.round(subtotal),
    })

    if (error) {
      console.error('[loyalty] resolve_wheel_spin_atomic error', error.message)
      return NextResponse.json({ ok: false, reason: 'server_error' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ ok: false, reason: 'server_error' }, { status: 500 })
  }
}
