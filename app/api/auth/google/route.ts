import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function resolveOrigin(request: NextRequest): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (appUrl && !appUrl.includes('localhost')) return appUrl

  // Fallback: reconstruct from Vercel/proxy forwarded headers
  // If this produces localhost in production, set NEXT_PUBLIC_APP_URL in your deployment env vars.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ?? 'https'
  if (host && !host.includes('localhost')) return `${proto}://${host}`

  if (process.env.NODE_ENV === 'production') {
    console.error('[auth/google] NEXT_PUBLIC_APP_URL is not set — OAuth redirect will use host header fallback. Set this env var in your deployment dashboard.')
  }

  return appUrl ?? request.nextUrl.origin
}

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request)
  const supabase = await createServerSupabaseClient()

  const next = request.nextUrl.searchParams.get('next') ?? '/'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(safeNext)}`,
      scopes: 'email profile openid',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  return NextResponse.redirect(data.url)
}
