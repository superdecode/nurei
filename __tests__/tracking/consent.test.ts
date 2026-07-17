import { describe, it, expect } from 'vitest'
import { readConsentCookie, buildConsentCookieString, CONSENT_COOKIE_NAME } from '../../lib/tracking/consent'

describe('readConsentCookie', () => {
  it('returns null when cookie is absent', () => {
    expect(readConsentCookie('')).toBeNull()
    expect(readConsentCookie('other=1; foo=bar')).toBeNull()
  })

  it('parses accepted value', () => {
    expect(readConsentCookie(`${CONSENT_COOKIE_NAME}=accepted`)).toBe('accepted')
  })

  it('parses rejected value among other cookies', () => {
    expect(readConsentCookie(`foo=bar; ${CONSENT_COOKIE_NAME}=rejected; baz=1`)).toBe('rejected')
  })

  it('returns null for an unrecognized value', () => {
    expect(readConsentCookie(`${CONSENT_COOKIE_NAME}=garbage`)).toBeNull()
  })
})

describe('buildConsentCookieString', () => {
  it('builds a cookie string with 12 month max-age and path=/', () => {
    const str = buildConsentCookieString('accepted')
    expect(str).toContain(`${CONSENT_COOKIE_NAME}=accepted`)
    expect(str).toContain('path=/')
    expect(str).toContain('max-age=31536000')
  })
})
