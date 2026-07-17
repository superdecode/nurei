import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildGa4Item, trackViewItem, trackPurchase } from '../../lib/tracking/ga4'

describe('buildGa4Item', () => {
  it('converts price to pesos and defaults quantity to 1', () => {
    const item = buildGa4Item({ id: 'p1', name: 'Ramen', category: 'noodles' }, 15000)
    expect(item).toEqual({
      item_id: 'p1',
      item_name: 'Ramen',
      price: 150,
      quantity: 1,
      item_category: 'noodles',
    })
  })
})

describe('trackViewItem', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when window.gtag is unavailable', () => {
    vi.stubGlobal('window', {})
    expect(() => trackViewItem({ id: 'p1', name: 'Ramen', category: 'noodles' }, 15000)).not.toThrow()
  })

  it('calls window.gtag with view_item event', () => {
    const gtag = vi.fn()
    vi.stubGlobal('window', { gtag })
    trackViewItem({ id: 'p1', name: 'Ramen', category: 'noodles' }, 15000)
    expect(gtag).toHaveBeenCalledWith('event', 'view_item', {
      currency: 'MXN',
      value: 150,
      items: [{ item_id: 'p1', item_name: 'Ramen', price: 150, quantity: 1, item_category: 'noodles' }],
    })
  })
})

describe('trackPurchase', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls window.gtag with purchase event and transaction_id', () => {
    const gtag = vi.fn()
    vi.stubGlobal('window', { gtag })
    trackPurchase({
      transactionId: 'order-1',
      valueCentavos: 20000,
      items: [{ item_id: 'p1', item_name: 'Ramen', price: 150, quantity: 1 }],
    })
    expect(gtag).toHaveBeenCalledWith('event', 'purchase', {
      transaction_id: 'order-1',
      currency: 'MXN',
      value: 200,
      items: [{ item_id: 'p1', item_name: 'Ramen', price: 150, quantity: 1 }],
    })
  })
})
