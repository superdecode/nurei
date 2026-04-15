/**
 * Format price from centavos to MXN display string
 */
export function formatPrice(centavos: number): string {
  const pesos = centavos / 100
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pesos)
}

/**
 * Format date to local time string
 */
export function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format date to relative time (e.g., "hace 5 min")
 */
export function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `hace ${diffMin} min`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `hace ${diffHours}h`

  return formatDate(dateString)
}

/**
 * Format date to display string
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format phone number for display
 */
export function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.length === 10) {
    return `${clean.slice(0, 2)} ${clean.slice(2, 6)} ${clean.slice(6)}`
  }
  return phone
}

/**
 * Format product metadata (weight, origin)
 */
export function formatProductMeta(weightG: number, origin: string): string {
  return `${weightG}g · ${origin}`
}
