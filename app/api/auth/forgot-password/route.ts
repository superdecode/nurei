import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveOrigin } from '@/lib/utils/resolve-origin'
import { rateLimit, getClientIp } from '@/lib/server/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const rl = rateLimit(`forgot-password:${ip}`, 5, 300_000)
  if (!rl.allowed) {
    return NextResponse.json({ ok: true })
  }

  try {
    const body = await request.json()
    const email = String(body?.email ?? '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const origin = resolveOrigin(request)
    const redirectTo = `${origin}/login`
    // Always return 200 regardless of whether the email exists (anti-enumeration)
    await supabase.auth.resetPasswordForEmail(email, { redirectTo }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
