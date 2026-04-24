import type { NextRequest } from 'next/server'

/**
 * Resolves the public origin for OAuth redirects.
 *
 * Priority:
 *  1. NEXT_PUBLIC_APP_URL  — must be set in production env vars (e.g. https://nurei.mx)
 *  2. VERCEL_URL           — set automatically by Vercel on every deployment
 *  3. x-forwarded-host     — injected by reverse proxies / CDN
 *  4. request.nextUrl.origin — last resort (will be localhost in local dev)
 */
export function resolveOrigin(request: NextRequest): string {
  // 1. Explicit production URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (appUrl && !appUrl.includes('localhost')) return appUrl

  // 2. Vercel automatic deployment URL
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl && !vercelUrl.includes('localhost')) return `https://${vercelUrl}`

  // 3. Reverse-proxy forwarded headers
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ?? 'https'
  if (host && !host.includes('localhost')) return `${proto}://${host}`

  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[auth] Could not resolve production origin. ' +
      'Set NEXT_PUBLIC_APP_URL=https://tudominio.com in your deployment environment variables.'
    )
  }

  // 4. Local dev fallback
  return request.nextUrl.origin
}
