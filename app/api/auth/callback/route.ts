import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function resolveOrigin(request: NextRequest): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (appUrl && !appUrl.includes('localhost')) return appUrl

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ?? 'https'
  if (host) return `${proto}://${host}`

  return request.nextUrl.origin
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const origin = resolveOrigin(request)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback`)
}
