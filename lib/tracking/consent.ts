export const CONSENT_COOKIE_NAME = '_nurei_consent'
export const CONSENT_TTL_SECONDS = 365 * 24 * 60 * 60 // 12 months

export type ConsentValue = 'accepted' | 'rejected'

const VALID_VALUES: ConsentValue[] = ['accepted', 'rejected']

export function readConsentCookie(cookieString: string): ConsentValue | null {
  const match = cookieString.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE_NAME}=([^;]+)`))
  const raw = match?.[1]
  if (!raw) return null
  return VALID_VALUES.includes(raw as ConsentValue) ? (raw as ConsentValue) : null
}

export function buildConsentCookieString(value: ConsentValue): string {
  return `${CONSENT_COOKIE_NAME}=${value}; path=/; max-age=${CONSENT_TTL_SECONDS}; SameSite=Lax`
}

export function getConsent(): ConsentValue | null {
  if (typeof document === 'undefined') return null
  return readConsentCookie(document.cookie)
}

export function setConsent(value: ConsentValue): void {
  if (typeof document === 'undefined') return
  document.cookie = buildConsentCookieString(value)
}
