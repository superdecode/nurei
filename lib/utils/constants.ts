import type { OrderStatus, RefundStatus, PqrStatus, PqrPriority, PqrType } from '@/types'

export const APP_NAME = 'nurei'
export const APP_TAGLINE = 'Premium Asian Snacks — Curated from Tokyo to CDMX'
export const APP_DESCRIPTION = 'Curaduría premium de snacks asiáticos importados. Envíos a todo México desde CDMX.'

export const CATEGORIES = [
  { value: 'all', label: 'Todo' },
  { value: 'crunchy', label: 'Crunchy' },
  { value: 'spicy', label: 'Spicy' },
  { value: 'limited_edition', label: 'Limited Edition' },
  { value: 'drinks', label: 'Drinks' },
] as const

// ── Order statuses ───────────────────────────────────────────────────────

export interface StatusMeta {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon?: string
}

export const ORDER_STATUS_MAP: Record<OrderStatus, StatusMeta> = {
  pending_payment: { label: 'Pendiente de pago', color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300', icon: '⏳' },
  paid:            { label: 'Pagado',           color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300', icon: '💳' },
  preparing:       { label: 'Procesando',        color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-300', icon: '📦' },
  ready_to_ship:   { label: 'En camino',         color: 'text-sky-700',    bgColor: 'bg-sky-50',    borderColor: 'border-sky-300', icon: '🚚' }, // legacy compat
  shipped:         { label: 'En camino',          color: 'text-sky-700',    bgColor: 'bg-sky-50',    borderColor: 'border-sky-300', icon: '📦' },
  delivered:       { label: 'Entregado',          color: 'text-emerald-700',bgColor: 'bg-emerald-50',borderColor: 'border-emerald-300', icon: '✅' },
  cancelled:       { label: 'Cancelado',          color: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-300', icon: '❌' },
  refunded:        { label: 'Reembolsado',        color: 'text-gray-600',   bgColor: 'bg-gray-50',   borderColor: 'border-gray-300', icon: '↩️' },
  // Legacy compat
  pending:   { label: 'Pendiente de pago', color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300', icon: '⏳' },
  confirmed: { label: 'Pago confirmado',   color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300', icon: '✅' },
  failed:    { label: 'Fallido',      color: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-300', icon: '⚠️' },
}

export const VALID_STATUS_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid:            ['preparing', 'cancelled'],
  preparing:       ['shipped', 'cancelled'],
  ready_to_ship:   ['shipped', 'cancelled'], // legacy compat
  shipped:         ['delivered', 'cancelled'],
  delivered:       [],
  cancelled:       [],
  refunded:        [],
  // Legacy
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  failed:    [],
}

// Label for the primary status-transition button, keyed by the order's CURRENT status.
// Falls back to `Cambiar a ${label del siguiente estado}` when a status has no entry here.
export const STATUS_PRIMARY_ACTION: Partial<Record<OrderStatus, string>> = {
  pending_payment: 'Confirmar pago',
  paid: 'Aceptar pedido',
  preparing: 'Marcar en camino',
  shipped: 'Marcar entregado',
  pending: 'Confirmar pedido',
  confirmed: 'Marcar enviado',
}

export const CANCELLABLE_STATUSES: OrderStatus[] = [
  'pending_payment', 'paid', 'preparing', 'pending', 'confirmed',
]

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Tarjeta',
  stripe_card: 'Tarjeta',
  oxxo: 'OXXO',
  transfer: 'Transferencia',
  bank_transfer: 'Transferencia',
  cash: 'Efectivo',
  cash_on_delivery: 'Contra entrega',
  wallet: 'Billetera',
  mercado_pago: 'Mercado Pago',
  paypal: 'PayPal',
  stripe: 'Stripe',
  other: 'Otro',
}

// ── Refund statuses ──────────────────────────────────────────────────────

export const REFUND_STATUS_MAP: Record<RefundStatus, StatusMeta> = {
  pending:   { label: 'Pendiente',  color: 'text-yellow-700',  bgColor: 'bg-yellow-50',  borderColor: 'border-yellow-300', icon: '⏳' },
  succeeded: { label: 'Completado', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300', icon: '✅' },
  failed:    { label: 'Fallido',    color: 'text-red-700',     bgColor: 'bg-red-50',     borderColor: 'border-red-300', icon: '⚠️' },
}

// ── PQR (peticiones, quejas, reclamos, sugerencias) ──────────────────────

export const PQR_ESTADO_MAP: Record<PqrStatus, StatusMeta> = {
  abierto:    { label: 'Abierto',    color: 'text-blue-700',    bgColor: 'bg-blue-50',    borderColor: 'border-blue-300', icon: '📬' },
  en_proceso: { label: 'En proceso', color: 'text-yellow-700',  bgColor: 'bg-yellow-50',  borderColor: 'border-yellow-300', icon: '🔄' },
  resuelto:   { label: 'Resuelto',   color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300', icon: '✅' },
  cerrado:    { label: 'Cerrado',    color: 'text-gray-600',    bgColor: 'bg-gray-100',   borderColor: 'border-gray-300', icon: '🔒' },
}

export const PQR_PRIORIDAD_MAP: Record<PqrPriority, StatusMeta> = {
  baja:    { label: 'Baja',    color: 'text-gray-600',  bgColor: 'bg-gray-100',  borderColor: 'border-gray-300' },
  media:   { label: 'Media',   color: 'text-blue-700',  bgColor: 'bg-blue-50',   borderColor: 'border-blue-300' },
  alta:    { label: 'Alta',    color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-300' },
  urgente: { label: 'Urgente', color: 'text-red-700',   bgColor: 'bg-red-50',    borderColor: 'border-red-300' },
}

export const PQR_TIPO_LABELS: Record<PqrType, string> = {
  peticion: 'Petición',
  queja: 'Queja',
  reclamo: 'Reclamo',
  sugerencia: 'Sugerencia',
}

// Shipping fees, free-shipping threshold, and min order: app_config → GET /api/store/checkout

// ── Contact ─────────────────────────────────────────────────────────────

export const SUPPORT_EMAIL = 'hola@nurei.mx'

export const SPICE_LABELS: Record<number, string> = {
  0: 'Sin picante',
  1: 'Suave',
  2: 'Medio',
  3: 'Intenso',
  4: 'Muy Intenso',
  5: 'Extremo',
}
