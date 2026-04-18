import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function resolveOrigin(request: NextRequest): string {
  // Prefer explicit env var (set in Vercel dashboard for production)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (appUrl && !appUrl.includes('localhost')) return appUrl

  // Reconstruct from Vercel/proxy forwarded headers
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ?? 'https'
  if (host) return `${proto}://${host}`

  return request.nextUrl.origin
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
