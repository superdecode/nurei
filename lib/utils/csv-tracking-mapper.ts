export type TrackingCsvRow = {
  folio: string
  carrier: string
  tracking_number: string
  tracking_url?: string
}

// Accepts a handful of common header spellings so the file doesn't have to
// match one exact template — folio/pedido/orden, transportadora/carrier, etc.
const HEADER_ALIASES: Record<keyof TrackingCsvRow, string[]> = {
  folio: ['folio', 'pedido', 'orden', 'order', 'short_id'],
  carrier: ['transportadora', 'carrier', 'paqueteria', 'paquetería'],
  tracking_number: ['numero_guia', 'número_guía', 'guia', 'guía', 'tracking_number', 'tracking'],
  tracking_url: ['url_tracking', 'tracking_url', 'link_tracking', 'url'],
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_')
}

/** Only accepts http(s) links — anything else (javascript:, data:, malformed) is dropped. */
export function isValidTrackingUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Maps one raw CSV row (arbitrary header spelling/casing) to a TrackingCsvRow.
 * Returns null if folio, carrier, or tracking_number is missing — those rows
 * are skipped client-side rather than sent to the server. An invalid
 * tracking_url is dropped (row still imports without it) rather than
 * rejecting the whole row, since it's an optional field.
 */
export function mapTrackingCsvRow(raw: Record<string, string>): TrackingCsvRow | null {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    normalized[normalizeHeader(key)] = String(value ?? '').trim()
  }

  const pick = (field: keyof TrackingCsvRow): string => {
    for (const alias of HEADER_ALIASES[field]) {
      if (normalized[alias]) return normalized[alias]
    }
    return ''
  }

  const folio = pick('folio')
  const carrier = pick('carrier')
  const tracking_number = pick('tracking_number')
  if (!folio || !carrier || !tracking_number) return null

  const rawTrackingUrl = pick('tracking_url')
  const tracking_url = rawTrackingUrl && isValidTrackingUrl(rawTrackingUrl) ? rawTrackingUrl : undefined

  return { folio, carrier, tracking_number, tracking_url }
}
