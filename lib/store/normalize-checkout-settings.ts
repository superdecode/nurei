import type { PaymentMethod } from '@/types'

/** Normalized storefront shipping settings (supports legacy `fee_cents` seed). */
export type NormalizedShippingSettings = {
  standard_fee_cents: number
  express_fee_cents: number
  free_shipping_min_cents: number | null
  standard_estimated_time: string
  express_estimated_time: string
  legacy_estimated_time: string
  enabled: boolean
  zones: string[]
}

/** Raw JSON blobs from app_config merge into this shape over time */
export function normalizeShippingFromConfig(raw: unknown): NormalizedShippingSettings {
  const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const standard_fee_cents =
    typeof s.standard_fee_cents === 'number'
      ? s.standard_fee_cents
      : typeof s.fee_cents === 'number'
        ? s.fee_cents
        : 2900

  const express_fee_cents = typeof s.express_fee_cents === 'number' ? s.express_fee_cents : 5900

  const freeRaw = s.free_shipping_min_cents
  const free_shipping_min_cents =
    typeof freeRaw === 'number'
      ? freeRaw > 0
        ? freeRaw
        : null
      : null

  return {
    standard_fee_cents,
    express_fee_cents,
    free_shipping_min_cents,
    standard_estimated_time:
      typeof s.standard_estimated_time === 'string' ? s.standard_estimated_time : '3-5 días hábiles',
    express_estimated_time:
      typeof s.express_estimated_time === 'string' ? s.express_estimated_time : '24-48 horas',
    legacy_estimated_time:
      typeof s.estimated_time === 'string'
        ? s.estimated_time
        : typeof s.standard_estimated_time === 'string'
          ? s.standard_estimated_time
          : '3-5 días hábiles',
    enabled: typeof s.enabled === 'boolean' ? s.enabled : true,
    zones: Array.isArray(s.zones) ? (s.zones as string[]) : [],
  }
}

export type CheckoutBootstrapResponse = {
  shipping: NormalizedShippingSettings
  checkout: {
    require_account: boolean
    guest_checkout: boolean
    min_order_cents: number
    max_items_per_order: number
  }
  payment_methods: PaymentMethod[]
}
