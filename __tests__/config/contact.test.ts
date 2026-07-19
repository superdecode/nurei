import { describe, it, expect } from 'vitest'
import { buildWhatsAppUrl } from '@/lib/config/contact'

describe('buildWhatsAppUrl', () => {
  it('adds the 52 country code to a bare 10-digit number', () => {
    expect(buildWhatsAppUrl('5512345678')).toBe('https://wa.me/525512345678')
  })

  it('leaves a number that already has a country code untouched', () => {
    expect(buildWhatsAppUrl('525512345678')).toBe('https://wa.me/525512345678')
  })

  it('strips formatting characters before counting digits', () => {
    expect(buildWhatsAppUrl('+52 55 1234 5678')).toBe('https://wa.me/525512345678')
    expect(buildWhatsAppUrl('(55) 1234-5678')).toBe('https://wa.me/525512345678')
  })

  it('appends an URL-encoded prefilled message when provided', () => {
    const url = buildWhatsAppUrl('5512345678', 'Hola, tengo una pregunta')
    expect(url).toBe('https://wa.me/525512345678?text=Hola%2C%20tengo%20una%20pregunta')
  })

  it('omits the text param entirely when no message is given', () => {
    expect(buildWhatsAppUrl('5512345678')).not.toContain('?text=')
  })
})
