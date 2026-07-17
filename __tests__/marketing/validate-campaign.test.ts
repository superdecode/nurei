import { describe, it, expect } from 'vitest'
import { validateCampaignDraft } from '../../lib/marketing/validate-campaign'
import type { CampaignContent } from '../../types'

const baseContent: CampaignContent = {
  heading: 'Hola',
  body: 'Cuerpo del mensaje',
  imageUrl: null,
  ctaLabel: 'Ir',
  ctaLink: { type: 'url', value: '/menu' },
  couponCode: null,
}

describe('validateCampaignDraft', () => {
  it('passes for a complete draft', () => {
    const result = validateCampaignDraft({
      name: 'Campaña de prueba',
      subject: 'Asunto',
      content: baseContent,
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('requires a name', () => {
    const result = validateCampaignDraft({ name: '', subject: 'Asunto', content: baseContent })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('El nombre de la campaña es requerido.')
  })

  it('requires a subject', () => {
    const result = validateCampaignDraft({ name: 'X', subject: '  ', content: baseContent })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('El asunto es requerido.')
  })

  it('requires heading or body to be non-empty', () => {
    const result = validateCampaignDraft({
      name: 'X', subject: 'Asunto',
      content: { ...baseContent, heading: '', body: '' },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Agrega un título o un texto al contenido.')
  })

  it('rejects a URL cta link that is not http(s)', () => {
    const result = validateCampaignDraft({
      name: 'X', subject: 'Asunto',
      content: { ...baseContent, ctaLink: { type: 'url', value: 'javascript:alert(1)' } },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('El enlace del botón debe ser una URL http(s) válida.')
  })

  it('accepts a product cta link without URL validation', () => {
    const result = validateCampaignDraft({
      name: 'X', subject: 'Asunto',
      content: { ...baseContent, ctaLink: { type: 'product', value: 'ramen-picante' } },
    })
    expect(result.valid).toBe(true)
  })

  it('collects multiple errors at once', () => {
    const result = validateCampaignDraft({ name: '', subject: '', content: { ...baseContent, heading: '', body: '' } })
    expect(result.errors.length).toBe(3)
  })
})
