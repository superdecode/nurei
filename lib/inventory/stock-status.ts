import type { StockStatus } from '@/types'

type StockFields = {
  track_inventory?: boolean | null
  allow_backorder?: boolean | null
  stock_quantity?: number | string | null
  low_stock_threshold?: number | string | null
}

function toInt(value: number | string | null | undefined, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

/**
 * Estado de stock según existencias reales vs umbral (panel admin, alertas, filtros).
 * No aplica track_inventory / allow_backorder: si hay cantidad y umbral, se compara siempre.
 */
export function computeStockStatus(product: StockFields): StockStatus {
  const quantity = toInt(product.stock_quantity, 0)
  const rawThreshold = product.low_stock_threshold
  const threshold =
    rawThreshold === null || rawThreshold === undefined || rawThreshold === ''
      ? 5
      : toInt(rawThreshold, 5)

  if (quantity <= 0) return 'out_of_stock'

  // Umbral 0 = desactivar alerta de "pocas unidades" (solo agotado importa)
  if (threshold > 0 && quantity <= threshold) return 'low_stock'

  return 'available'
}

/**
 * Estado para tienda: respeta no seguimiento de inventario y pedidos con existencias.
 */
export function computeStorefrontStockStatus(product: StockFields): StockStatus {
  const trackInventory = product.track_inventory !== false
  const allowBackorder = product.allow_backorder === true
  if (!trackInventory || allowBackorder) return 'available'
  return computeStockStatus(product)
}

export function stockStatusLabel(status: StockStatus): string {
  switch (status) {
    case 'out_of_stock':
      return 'Agotado'
    case 'low_stock':
      return 'Pocas unidades'
    default:
      return 'Disponible'
  }
}
