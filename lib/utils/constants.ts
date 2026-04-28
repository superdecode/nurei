import type { OrderStatus } from '@/types'

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
  paid:            { label: 'Pendiente',        color: 'text-blue-700',   bgColor: 'bg-blue-50',   borderColor: 'border-blue-300', icon: '💳' },
  preparing:       { label: 'Procesando',        color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-300', icon: '📦' },
  ready_to_ship:   { label: 'En camino',         color: 'text-sky-700',    bgColor: 'bg-sky-50',    borderColor: 'border-sky-300', icon: '🚚' }, // legacy compat
  shipped:         { label: 'En camino',          color: 'text-sky-700',    bgColor: 'bg-sky-50',    borderColor: 'border-sky-300', icon: '📦' },
  delivered:       { label: 'Entregado',          color: 'text-emerald-700',bgColor: 'bg-emerald-50',borderColor: 'border-emerald-300', icon: '✅' },
  cancelled:       { label: 'Cancelado',          color: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-300', icon: '❌' },
  refunded:        { label: 'Reembolsado',        color: 'text-gray-600',   bgColor: 'bg-gray-50',   borderColor: 'border-gray-300', icon: '↩️' },
  // Legacy compat
  pending:   { label: 'Pendiente',     color: 'text-blue-700',   bgColor: 'bg-blue-50',   borderColor: 'border-blue-300', icon: '⏳' },
  confirmed: { label: 'Pendiente',     color: 'text-blue-700',   bgColor: 'bg-blue-50',   borderColor: 'border-blue-300', icon: '✅' },
  failed:    { label: 'Fallido',      color: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-300', icon: '⚠️' },
}

export const VALID_STATUS_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid:            ['preparing', 'cancelled'],
  preparing:       ['shipped', 'cancelled'],
  ready_to_ship:   ['shipped', 'cancelled'], // legacy compat
  shipped:         ['delivered', 'cancelled'],
  delivered:       ['refunded'],
  cancelled:       ['refunded'],
  refunded:        [],
  // Legacy
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  failed:    [],
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
}

// Shipping fees, free-shipping threshold, and min order: app_config → GET /api/store/checkout

// ── Contact ─────────────────────────────────────────────────────────────

export const SUPPORT_EMAIL = 'hola@nurei.mx'
export const SUPPORT_PHONE = '5555555555'
export const SUPPORT_WHATSAPP_URL = `https://wa.me/52${SUPPORT_PHONE}`

export const SPICE_LABELS: Record<number, string> = {
  0: 'Sin picante',
  1: 'Suave',
  2: 'Medio',
  3: 'Intenso',
  4: 'Muy Intenso',
  5: 'Extremo',
}
