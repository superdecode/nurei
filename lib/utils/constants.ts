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

export const ORDER_STATUS_MAP = {
  pending: { label: 'Procesando', color: 'text-nurei-muted', bgColor: 'bg-nurei-muted/10', icon: '⏳' },
  confirmed: { label: 'Confirmado', color: 'text-nurei-cta', bgColor: 'bg-nurei-cta/10', icon: '✅' },
  shipped: { label: 'Enviado', color: 'text-nurei-accent', bgColor: 'bg-nurei-accent/10', icon: '📦' },
  delivered: { label: 'Entregado', color: 'text-nurei-stock', bgColor: 'bg-nurei-stock/10', icon: '✅' },
  cancelled: { label: 'Cancelado', color: 'text-error', bgColor: 'bg-error/10', icon: '❌' },
  failed: { label: 'Fallido', color: 'text-error', bgColor: 'bg-error/10', icon: '⚠️' },
} as const

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled', 'failed'],
  delivered: [],
  cancelled: [],
  failed: [],
}

export const DEFAULT_SHIPPING_FEE = 9900 // $99 MXN en centavos
export const FREE_SHIPPING_THRESHOLD = 59900 // $599 MXN — envío gratis
export const MIN_ORDER_AMOUNT = 19900 // $199 MXN en centavos

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
