import type { Product } from '@/types'

type PresentationFields = Pick<Product, 'weight_g' | 'unit_of_measure'> &
  Partial<Pick<Product, 'name' | 'description'>>

/** Coerce DB/JSON weight (number, string, null). */
function normalizeWeightG(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const n = parseFloat(String(raw).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Si weight_g no está en BD, muchos catálogos llevan el neto en el nombre (ej. "... 120 g").
 */
function inferPresentationFromText(name?: string | null, description?: string | null): string | null {
  const re = /(\d+(?:[.,]\d+)?)\s*(kg|ml|mL|g|oz|l|L)\b/gi
  const sources = [name, description].filter((s): s is string => Boolean(s?.trim()))
  for (const text of sources) {
    const matches = [...text.matchAll(re)]
    if (matches.length === 0) continue
    const last = matches[matches.length - 1]
    const n = parseFloat(last[1].replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) continue
    let u = last[2]
    if (u.toLowerCase() === 'l') u = 'L'
    else if (u.toLowerCase() === 'ml') u = 'ml'
    else if (u.toLowerCase() === 'kg') u = 'kg'
    else if (u.toLowerCase() === 'g') u = 'g'
    else if (u.toLowerCase() === 'oz') u = 'oz'
    return `${n} ${u}`
  }
  return null
}

/** Cantidad + unidad para fichas y PDP (ej. 150 g, 500 ml). Usa BD; si falta, infiere desde nombre/descripción. */
export function formatProductPresentation(p: PresentationFields): string {
  const unit = (p.unit_of_measure ?? 'g').trim()
  const w = normalizeWeightG(p.weight_g)

  if (w != null && w > 0) {
    return `${w} ${unit}`
  }

  const inferred = inferPresentationFromText(p.name, p.description)
  if (inferred) return inferred

  return unit
}
