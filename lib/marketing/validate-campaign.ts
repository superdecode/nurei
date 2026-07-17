import type { CampaignContent } from '@/types'

export interface CampaignDraftInput {
  name: string
  subject: string
  content: CampaignContent
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value, value.startsWith('/') ? 'https://placeholder.local' : undefined)
    return url.protocol === 'http:' || url.protocol === 'https:' || value.startsWith('/')
  } catch {
    return false
  }
}

export function validateCampaignDraft(input: CampaignDraftInput): ValidationResult {
  const errors: string[] = []

  if (!input.name.trim()) errors.push('El nombre de la campaña es requerido.')
  if (!input.subject.trim()) errors.push('El asunto es requerido.')
  if (!input.content.heading.trim() && !input.content.body.trim()) {
    errors.push('Agrega un título o un texto al contenido.')
  }

  const cta = input.content.ctaLink
  if (cta && cta.type === 'url' && !isValidHttpUrl(cta.value)) {
    errors.push('El enlace del botón debe ser una URL http(s) válida.')
  }

  return { valid: errors.length === 0, errors }
}
