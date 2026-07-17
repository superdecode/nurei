// __tests__/server/meta-capi.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizeEmail, normalizePhone, hashEmail, hashPhone, sendMetaPurchaseEvent } from '../../lib/server/meta-capi'
import { createHash } from 'crypto'

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Test@Example.COM ')).toBe('test@example.com')
  })
})

describe('normalizePhone', () => {
  it('strips non-digits and adds MX country code for 10-digit numbers', () => {
    expect(normalizePhone('(55) 1234-5678')).toBe('5255123 45678'.replace(/\s/g, ''))
  })

  it('leaves already-prefixed numbers unchanged', () => {
    expect(normalizePhone('+52 55 1234 5678')).toBe('525512345678')
  })

  it('strips leading zeros', () => {
    expect(normalizePhone('0445512345678')).toBe('445512345678')
  })
})

describe('hashEmail / hashPhone', () => {
  it('returns sha256 hex of the normalized value', () => {
    expect(hashEmail('Test@Example.com')).toBe(createHash('sha256').update('test@example.com').digest('hex'))
    expect(hashPhone('5512345678')).toBe(createHash('sha256').update('525512345678').digest('hex'))
  })
})

describe('sendMetaPurchaseEvent', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '')
    vi.stubEnv('META_CONVERSIONS_API_TOKEN', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('no-ops and returns ok:true when env vars are unset', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await sendMetaPurchaseEvent({
      orderId: 'order-1',
      eventId: 'purchase_order-1',
      eventSourceUrl: 'https://nurei.mx/pedido/order-1',
      valuePesos: 200,
      currency: 'MXN',
      contentIds: ['p1'],
      userData: {},
    })
    expect(result).toEqual({ ok: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('posts to the Graph API v25.0 events endpoint when configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', 'pixel-123')
    vi.stubEnv('META_CONVERSIONS_API_TOKEN', 'token-abc')
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, text: async () => '' } as Response)

    const result = await sendMetaPurchaseEvent({
      orderId: 'order-1',
      eventId: 'purchase_order-1',
      eventSourceUrl: 'https://nurei.mx/pedido/order-1',
      valuePesos: 200,
      currency: 'MXN',
      contentIds: ['p1'],
      userData: { email: 'Test@Example.com', clientIpAddress: '1.2.3.4', clientUserAgent: 'UA' },
    })

    expect(result).toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, options] = fetchSpy.mock.calls[0]
    expect(String(url)).toBe('https://graph.facebook.com/v25.0/pixel-123/events?access_token=token-abc')
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.data[0].event_name).toBe('Purchase')
    expect(body.data[0].event_id).toBe('purchase_order-1')
    expect(body.data[0].action_source).toBe('website')
    expect(body.data[0].user_data.em).toEqual([hashEmail('Test@Example.com')])
    expect(body.data[0].user_data.client_ip_address).toBe('1.2.3.4')
    expect(body.data[0].custom_data.value).toBe(200)
  })
})
