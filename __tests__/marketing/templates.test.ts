import { describe, it, expect } from 'vitest'
import { CAMPAIGN_TEMPLATES, getTemplate } from '../../lib/marketing/templates'

describe('getTemplate', () => {
  it('returns the bienvenida template with a heading and CTA', () => {
    const tpl = getTemplate('bienvenida')
    expect(tpl.templateKey).toBe('bienvenida')
    expect(tpl.name).toBe('Bienvenida')
    expect(tpl.subject.length).toBeGreaterThan(0)
    expect(tpl.content.heading.length).toBeGreaterThan(0)
    expect(tpl.content.ctaLabel.length).toBeGreaterThan(0)
  })

  it('returns the winback template', () => {
    const tpl = getTemplate('winback')
    expect(tpl.templateKey).toBe('winback')
  })

  it('returns the promo template with a couponCode placeholder of null', () => {
    const tpl = getTemplate('promo')
    expect(tpl.templateKey).toBe('promo')
    expect(tpl.content.couponCode).toBeNull()
  })

  it('returns a blank template with empty content', () => {
    const tpl = getTemplate('blank')
    expect(tpl.templateKey).toBe('blank')
    expect(tpl.content.heading).toBe('')
    expect(tpl.content.body).toBe('')
  })

  it('exposes exactly 4 templates in CAMPAIGN_TEMPLATES, in gallery order', () => {
    expect(CAMPAIGN_TEMPLATES.map((t) => t.templateKey)).toEqual([
      'bienvenida', 'winback', 'promo', 'blank',
    ])
  })
})
