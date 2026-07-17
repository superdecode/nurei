import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  trackPageView,
  trackViewContent,
  trackAddToCart,
  trackInitiateCheckout,
  trackPurchase,
} from '../../lib/tracking/meta-pixel'

describe('trackPageView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when window.fbq is unavailable', () => {
    vi.stubGlobal('window', {})
    expect(() => trackPageView()).not.toThrow()
  })

  it('calls window.fbq with PageView event', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq })
    trackPageView()
    expect(fbq).toHaveBeenCalledWith('track', 'PageView')
  })
})

describe('trackViewContent', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when window.fbq is unavailable', () => {
    vi.stubGlobal('window', {})
    expect(() => trackViewContent({ id: 'p1', name: 'Ramen' }, 15000)).not.toThrow()
  })

  it('calls window.fbq with ViewContent event', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq })
    trackViewContent({ id: 'p1', name: 'Ramen' }, 15000)
    expect(fbq).toHaveBeenCalledWith('track', 'ViewContent', {
      content_ids: ['p1'],
      content_name: 'Ramen',
      content_type: 'product',
      currency: 'MXN',
      value: 150,
    })
  })
})

describe('trackAddToCart', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when window.fbq is unavailable', () => {
    vi.stubGlobal('window', {})
    expect(() => trackAddToCart({ id: 'p1', name: 'Ramen' }, 15000)).not.toThrow()
  })

  it('calls window.fbq with AddToCart event and default quantity of 1', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq })
    trackAddToCart({ id: 'p1', name: 'Ramen' }, 15000)
    expect(fbq).toHaveBeenCalledWith('track', 'AddToCart', {
      content_ids: ['p1'],
      content_name: 'Ramen',
      content_type: 'product',
      currency: 'MXN',
      value: 150,
    })
  })

  it('calls window.fbq with AddToCart event and multiplies price by quantity', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq })
    trackAddToCart({ id: 'p1', name: 'Ramen' }, 15000, 3)
    expect(fbq).toHaveBeenCalledWith('track', 'AddToCart', {
      content_ids: ['p1'],
      content_name: 'Ramen',
      content_type: 'product',
      currency: 'MXN',
      value: 450,
    })
  })
})

describe('trackInitiateCheckout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when window.fbq is unavailable', () => {
    vi.stubGlobal('window', {})
    expect(() => trackInitiateCheckout(['p1', 'p2'], 50000)).not.toThrow()
  })

  it('calls window.fbq with InitiateCheckout event', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq })
    trackInitiateCheckout(['p1', 'p2'], 50000)
    expect(fbq).toHaveBeenCalledWith('track', 'InitiateCheckout', {
      content_ids: ['p1', 'p2'],
      content_type: 'product',
      currency: 'MXN',
      value: 500,
    })
  })
})

describe('trackPurchase', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when window.fbq is unavailable', () => {
    vi.stubGlobal('window', {})
    expect(() =>
      trackPurchase({ eventId: 'purchase_order-1', contentIds: ['p1'], valueCentavos: 20000 })
    ).not.toThrow()
  })

  it('calls window.fbq with Purchase event and eventID for dedup', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq })
    trackPurchase({ eventId: 'purchase_order-1', contentIds: ['p1'], valueCentavos: 20000 })
    expect(fbq).toHaveBeenCalledWith(
      'track',
      'Purchase',
      { content_ids: ['p1'], content_type: 'product', currency: 'MXN', value: 200 },
      { eventID: 'purchase_order-1' }
    )
  })
})
