'use client'

import { centavosToPesos } from './currency'

type GtagFn = (...args: unknown[]) => void

declare global {
  interface Window {
    gtag?: GtagFn
  }
}

export interface Ga4Item {
  item_id: string
  item_name: string
  price: number
  quantity?: number
  item_category?: string
}

interface TrackableProduct {
  id: string
  name: string
  category?: string
}

function callGtag(...args: unknown[]): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  try {
    window.gtag(...args)
  } catch {
    // tracking must never break the app
  }
}

export function buildGa4Item(product: TrackableProduct, priceCentavos: number, quantity = 1): Ga4Item {
  return {
    item_id: product.id,
    item_name: product.name,
    price: centavosToPesos(priceCentavos),
    quantity,
    item_category: product.category,
  }
}

export function trackViewItem(product: TrackableProduct, priceCentavos: number): void {
  callGtag('event', 'view_item', {
    currency: 'MXN',
    value: centavosToPesos(priceCentavos),
    items: [buildGa4Item(product, priceCentavos)],
  })
}

export function trackAddToCart(product: TrackableProduct, priceCentavos: number, quantity = 1): void {
  callGtag('event', 'add_to_cart', {
    currency: 'MXN',
    value: centavosToPesos(priceCentavos * quantity),
    items: [buildGa4Item(product, priceCentavos, quantity)],
  })
}

export function trackBeginCheckout(items: Ga4Item[], valueCentavos: number): void {
  callGtag('event', 'begin_checkout', {
    currency: 'MXN',
    value: centavosToPesos(valueCentavos),
    items,
  })
}

export function trackPurchase(args: { transactionId: string; valueCentavos: number; items: Ga4Item[] }): void {
  callGtag('event', 'purchase', {
    transaction_id: args.transactionId,
    currency: 'MXN',
    value: centavosToPesos(args.valueCentavos),
    items: args.items,
  })
}
