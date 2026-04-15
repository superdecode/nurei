import type { OrderStatus } from '@/types'
import { FREE_SHIPPING_THRESHOLD, DEFAULT_SHIPPING_FEE } from './constants'

/**
 * Calculate shipping fee based on subtotal (free above threshold)
 */
export function calculateShippingFee(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE
}

/**
 * Calculate remaining amount for free shipping
 */
export function calculateFreeShippingRemaining(subtotal: number): number {
  return Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal)
}

/**
 * Estimated shipping days based on order status
 */
export function calculateShippingDays(status: OrderStatus): string {
  switch (status) {
    case 'pending':
    case 'confirmed':
      return '3-5 días hábiles'
    case 'shipped':
      return '1-2 días hábiles'
    case 'delivered':
      return 'Entregado'
    default:
      return '—'
  }
}
