import type { NextRequest } from 'next/server'

/**
 * Resolves the public production URL from env vars only (no request object).
 * Use this in email senders, webhooks, and any server code without a request.
 *
 * Priority: NEXT_PUBLIC_APP_URL → NEXT_PUBLIC_SITE_URL → VERCEL_URL
 * Never falls back to localhost.
 */
export function resolvePublicUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ]

  for (const url of candidates) {
    const clean = url?.trim().replace(/\/$/, '')
    if (clean && !clean.includes('localhost') && !clean.includes('127.0.0.1')) return clean
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[resolve-origin] NEXT_PUBLIC_APP_URL is not set. ' +
      'Add it to your production environment variables (e.g. https://nurei.mx).'
    )
  }

  return ''
}

/**
 * Resolves the public origin for OAuth callbacks and auth redirects.
 * Use this in API routes that have a NextRequest.
 *
 * Priority: NEXT_PUBLIC_APP_URL → NEXT_PUBLIC_SITE_URL → VERCEL_URL → x-forwarded-host
 * Never falls back to localhost in production.
 */
export function resolveOrigin(request: NextRequest): string {
  // 1 & 2: explicit env vars
  const fromEnv = resolvePublicUrl()
  if (fromEnv) return fromEnv

  // 3: reverse-proxy / CDN forwarded header
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ?? 'https'
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) return `${proto}://${host}`

  // local dev only
  return request.nextUrl.origin
}
