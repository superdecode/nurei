import { describe, expect, it } from 'vitest'
import {
  renderCustomerOrderConfirmationHtml,
  renderAdminNewOrderHtml,
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

  it('keeps the header title-only and uses a direct order CTA', () => {
    const titleIndex = html.indexOf('Tu pedido va en camino</h1>')
    const headerCloseIndex = html.indexOf('</td></tr>', titleIndex)
    const greetingIndex = html.indexOf('Hola <strong>', headerCloseIndex)

    expect(titleIndex).toBeGreaterThan(-1)
    expect(headerCloseIndex).toBeGreaterThan(titleIndex)
    expect(greetingIndex).toBeGreaterThan(headerCloseIndex)
    expect((html.match(/🚚/g) ?? [])).toHaveLength(1)
    expect(html).toContain('href="https://www.nurei.mx/pedido/order-id?token=access-token"')
    expect(html).toContain('>Ver mi pedido</a>')
    expect(html).toContain('border:none;border-radius:14px')
    expect(html).toContain('box-shadow:0 9px 24px rgba(255,193,7,.38)')
    expect(html).not.toContain('padding:14px 28px;border:2px solid #111827')
  })

  it('does not use flex layout for the status card', () => {
    expect(html).not.toContain('display:flex')
  })

  it('uses the Nurei palette without the legacy shipping blue', () => {
    expect(html).toContain('#FFC107')
    expect(html).toContain('#FFFBEB')
    expect(html).not.toContain('#0284C7')
    expect(html).not.toContain('#F0F9FF')
  })

  it('keeps confirmation totals in two columns aligned to the right edge', () => {
    const confirmation = renderCustomerOrderConfirmationHtml({
      brandName: 'nurei',
      shortId: 'NR-1042',
      customerName: 'María',
      orderUrl: 'https://www.nurei.mx/pedido/order-id',
      orderDate: '18 jul 2026',
      items: [{ name: 'Pocky', quantity: 1, subtotal: 12900 }],
      subtotal: 12900,
      shippingFee: 9900,
      couponDiscount: 1000,
      couponCode: 'NUREI10',
      pointsDiscount: 0,
      total: 21800,
      deliveryAddress: 'Roma Norte, CDMX',
    })

    expect(confirmation).toContain('table-layout:fixed')
    expect(confirmation).toContain('Subtotal</td><td width="40%" align="right"')
    expect(confirmation).toContain('Envío</td><td width="40%" align="right"')
    expect(confirmation).toContain('padding:6px 12px 6px 0;text-align:right')
    expect(confirmation).toContain('padding:8px 12px 8px 0;text-align:right')
    expect(confirmation).toContain('padding:12px 12px 8px 0;border-top:2px')
    expect(confirmation).not.toContain('colspan="2"')
  })

  it('renders the internal order email with clear operational sections and time', () => {
    const internal = renderAdminNewOrderHtml({
      brandName: 'nurei',
      shortId: 'NUR-11001',
      orderDate: '18 jul 2026',
      orderTime: '08:53 a. m.',
      adminOrderUrl: 'https://nurei.mx/admin/pedidos/order-id',
      customerName: 'María López',
      customerEmail: 'maria@example.com',
      customerPhone: '+52 55 1234 5678',
      items: [{ name: 'Pocky Matcha', quantity: 2, subtotal: 25800 }],
      total: 25800,
      deliveryAddress: 'Roma Norte, CDMX',
    })

    expect(internal).toContain('Nuevo pedido recibido')
    expect(internal).toContain('18 jul 2026')
    expect(internal).toContain('08:53 a. m.')
    expect(internal).toContain('>Cliente</td>')
    expect(internal).toContain('>Datos de entrega</td>')
    expect(internal).toContain('>Productos</th>')
    expect(internal).toContain('Abrir pedido en admin')
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
