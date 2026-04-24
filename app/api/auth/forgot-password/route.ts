import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = String(body?.email ?? '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ?? 'https'
    const resolvedBase = (base && !base.includes('localhost')) ? base
      : (host && !host.includes('localhost')) ? `${proto}://${host}`
      : base
    const redirectTo = `${resolvedBase}/login`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
