import { describe, expect, it } from 'vitest'
import {
  renderOrderDeliveredHtml,
  renderOrderPreparingHtml,
  renderOrderShippedHtml,
} from '../../lib/email/templates/order-emails-html'

describe('renderOrderShippedHtml', () => {
  const html = renderOrderShippedHtml({
    brandName: 'nurei',
    shortId: 'NR-1042',
    customerName: 'María',
    orderUrl: 'https://www.nurei.mx/pedido/order-id?token=access-token',
    orderDate: '18 jul 2026',
    total: 45900,
    deliveryAddress: 'Roma Norte, CDMX',
    trackingNumber: 'TRACK-123',
    carrier: 'Estafeta',
  })

  it('puts the essential order data before the status details', () => {
    expect(html).toContain('Pedido</p>')
    expect(html).toContain('Fecha</p>')
    expect(html).toContain('Total</p>')
    expect(html.indexOf('Total</p>')).toBeLessThan(html.indexOf('En camino'))
  })

  it('uses a single header icon and a direct order CTA', () => {
    expect((html.match(/📦/g) ?? [])).toHaveLength(1)
    expect(html).toContain('href="https://www.nurei.mx/pedido/order-id?token=access-token"')
    expect(html).toContain('>Ver mi pedido</a>')
  })

  it('does not use flex layout for the status card', () => {
    expect(html).not.toContain('display:flex')
  })

  it('renders every status template as a complete email document', () => {
    const props = {
      brandName: 'nurei',
      shortId: 'NR-1042',
      customerName: 'María',
      orderUrl: 'https://www.nurei.mx/pedido/order-id?token=access-token',
      orderDate: '18 jul 2026',
      total: 45900,
      deliveryAddress: 'Roma Norte, CDMX',
    }

    for (const rendered of [
      renderOrderPreparingHtml(props),
      renderOrderShippedHtml(props),
      renderOrderDeliveredHtml(props),
    ]) {
      expect(rendered).toMatch(/^<!DOCTYPE html>/)
      expect(rendered).toContain('</html>')
      expect(rendered).toContain('NR-1042')
      expect(rendered).toContain('Ver mi pedido')
    }
  })

  it('escapes customer-controlled fields', () => {
    const rendered = renderOrderShippedHtml({
      brandName: 'nurei',
      shortId: 'NR-1042',
      customerName: '<script>alert(1)</script>',
      orderUrl: 'https://www.nurei.mx/pedido/order-id',
      orderDate: '18 jul 2026',
      total: 45900,
      deliveryAddress: '<img src=x onerror=alert(1)>',
      trackingNumber: '<b>TRACK</b>',
    })

    expect(rendered).not.toContain('<script>')
    expect(rendered).not.toContain('<img src=x')
    expect(rendered).not.toContain('<b>TRACK</b>')
  })
})
