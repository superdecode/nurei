'use client'

import { centavosToPesos } from './currency'

type FbqFn = (...args: unknown[]) => void

declare global {
  interface Window {
    fbq?: FbqFn
  }
}

interface TrackableProduct {
  id: string
  name: string
}

function callFbq(...args: unknown[]): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  try {
    window.fbq(...args)
  } catch {
    // tracking must never break the app
  }
}

export function trackPageView(): void {
  callFbq('track', 'PageView')
}

export function trackViewContent(product: TrackableProduct, priceCentavos: number): void {
  callFbq('track', 'ViewContent', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    currency: 'MXN',
    value: centavosToPesos(priceCentavos),
  })
}

export function trackAddToCart(
  product: TrackableProduct,
  priceCentavos: number,
  quantity = 1
): void {
  callFbq('track', 'AddToCart', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    currency: 'MXN',
    value: centavosToPesos(priceCentavos * quantity),
  })
}

export function trackInitiateCheckout(contentIds: string[], valueCentavos: number): void {
  callFbq('track', 'InitiateCheckout', {
    content_ids: contentIds,
    content_type: 'product',
    currency: 'MXN',
    value: centavosToPesos(valueCentavos),
  })
}

export function trackPurchase(args: {
  eventId: string
  contentIds: string[]
  valueCentavos: number
}): void {
  callFbq(
    'track',
    'Purchase',
    {
      content_ids: args.contentIds,
      content_type: 'product',
      currency: 'MXN',
      value: centavosToPesos(args.valueCentavos),
    },
    { eventID: args.eventId }
  )
}
