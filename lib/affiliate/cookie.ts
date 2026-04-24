import { NextResponse } from 'next/server'

export const REFERRAL_COOKIE_NAME = '_nurei_ref'
export const REFERRAL_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

export function setReferralCookie(response: NextResponse, referralLinkId: string): NextResponse {
  response.cookies.set(REFERRAL_COOKIE_NAME, referralLinkId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFERRAL_TTL_SECONDS,
    path: '/',
  })
  return response
}

export function clearReferralCookie(response: NextResponse): NextResponse {
  response.cookies.delete(REFERRAL_COOKIE_NAME)
  return response
}

export function getReferralLinkIdFromHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE_NAME}=([^;]+)`))
  return match?.[1] ?? null
}
