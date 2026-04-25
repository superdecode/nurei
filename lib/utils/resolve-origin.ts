import type { NextRequest } from 'next/server'

function isLocalHost(value: string): boolean {
  return value.includes('localhost') || value.includes('127.0.0.1')
}

function cleanUrl(value?: string | null): string {
  return value?.trim().replace(/\/$/, '') ?? ''
}

function toOriginFromUrl(value?: string | null): string {
  if (!value) return ''
  try {
    return cleanUrl(new URL(value).origin)
  } catch {
    return ''
  }
}

function firstNonLocal(candidates: Array<string | undefined | null>): string {
  for (const candidate of candidates) {
    const clean = cleanUrl(candidate)
    if (clean && !isLocalHost(clean)) return clean
  }
  return ''
}

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

  const resolved = firstNonLocal(candidates)
  if (resolved) return resolved

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
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim() ?? ''
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ?? 'https'
  const forwardedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : ''

  // 4: browser-provided context headers
  const originHeader = toOriginFromUrl(request.headers.get('origin'))
  const refererOrigin = toOriginFromUrl(request.headers.get('referer'))

  // 5: fallback to request URL origin
  const requestOrigin = cleanUrl(request.nextUrl.origin)

  const resolved = firstNonLocal([
    forwardedOrigin,
    request.headers.get('host') ? `${forwardedProto}://${request.headers.get('host')}` : '',
    originHeader,
    refererOrigin,
    requestOrigin,
  ])
  if (resolved) return resolved

  // production guardrail: never return localhost for OAuth redirects
  if (process.env.NODE_ENV === 'production') {
    const productionFallback = firstNonLocal([
      process.env.AUTH_PUBLIC_URL,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    ])
    if (productionFallback) return productionFallback
  }

  // local dev only
  return requestOrigin
}
