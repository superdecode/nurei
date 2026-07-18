import { describe, it, expect } from 'vitest'
import { renderCampaignEmailHtml } from '../../lib/email/templates/campaign-email-html'
import type { CampaignContent } from '../../types'

const content: CampaignContent = {
  heading: 'Hola <script>alert(1)</script>',
  body: 'Línea uno\nLínea dos',
  imageUrl: 'https://example.com/img.jpg',
  ctaLabel: 'Comprar',
  ctaLink: { type: 'url', value: 'https://nurei.mx/menu' },
  couponCode: 'PROMO20',
}

describe('renderCampaignEmailHtml', () => {
  it('escapes HTML in the heading', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('renders each body line as its own paragraph', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).toContain('Línea uno')
    expect(html).toContain('Línea dos')
  })

  it('includes the resolved CTA url and label', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).toContain('href="https://nurei.mx/menu"')
    expect(html).toContain('Comprar')
    expect(html).toContain('border:none;border-radius:14px')
    expect(html).toContain('box-shadow:0 9px 24px rgba(255,193,7,.38)')
    expect(html).not.toContain('border:2px solid #111827')
  })

  it('includes the image when present', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).toContain('https://example.com/img.jpg')
  })

  it('omits the image tag when imageUrl is null', () => {
    const html = renderCampaignEmailHtml({ content: { ...content, imageUrl: null }, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).not.toContain('<img')
  })

  it('shows the coupon code when present', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).toContain('PROMO20')
  })

  it('omits the coupon block when couponCode is null', () => {
    const html = renderCampaignEmailHtml({ content: { ...content, couponCode: null }, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).not.toContain('PROMO20')
  })

  it('uses the shared brand amber color', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).toContain('#FFC107')
  })

  it('includes a hidden preheader when provided', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu', preheader: 'Vista previa del correo' })
    expect(html).toContain('Vista previa del correo')
    expect(html).toContain('display:none')
  })

  it('omits the preheader block when not provided', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).not.toContain('display:none')
  })
})
