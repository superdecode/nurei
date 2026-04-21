import type { OrderStatus } from '@/types'

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
