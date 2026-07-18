import { escapeHtml } from '@/lib/email/escape-html'
import { formatPrice } from '@/lib/utils/format'

export type OrderEmailLineItem = {
  name: string
  quantity: number
  subtotal: number
}

export type CustomerOrderEmailProps = {
  brandName: string
  shortId: string
  customerName: string
  orderUrl: string
  items: OrderEmailLineItem[]
  subtotal: number
  shippingFee: number
  couponDiscount: number
  couponCode: string | null
  total: number
  orderDate: string
  deliveryAddress: string
  /** Instrucciones si el pago está pendiente (OXXO / transferencia). */
  pendingPaymentNote?: string | null
}

export const BRAND_BG = '#FFFBEB'
export const BRAND_AMBER = '#FFC107'
export const TEXT_DARK = '#111827'
export const TEXT_MUTED = '#6B7280'
export const GREEN = '#10B981'
export const CARD_BORDER = '#E5E7EB'

/** Correo de confirmación al cliente: moderno, amable y con toque juguetón. */
export function renderCustomerOrderConfirmationHtml(p: CustomerOrderEmailProps): string {
  const rows = p.items
    .map(
      (it) => `
      <tr>
        <td style="padding:12px 8px;border-bottom:1px solid ${CARD_BORDER};font-size:15px;color:${TEXT_DARK};">${escapeHtml(it.name)}</td>
        <td style="padding:12px 8px;border-bottom:1px solid ${CARD_BORDER};text-align:center;font-size:14px;color:${TEXT_MUTED};">${it.quantity}</td>
        <td style="padding:12px 8px;border-bottom:1px solid ${CARD_BORDER};text-align:right;font-size:14px;font-weight:600;color:${TEXT_DARK};">${formatPrice(it.subtotal)}</td>
      </tr>`
    )
    .join('')

  const couponRow =
    p.couponDiscount > 0
      ? `<tr>
          <td colspan="2" style="padding:8px;font-size:13px;color:${GREEN};font-weight:600;">Cupón ${escapeHtml(p.couponCode ?? '')}</td>
          <td style="padding:8px;text-align:right;font-size:14px;color:${GREEN};font-weight:600;">-${formatPrice(p.couponDiscount)}</td>
        </tr>`
      : ''

  const pendingBox = p.pendingPaymentNote
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#FFF7ED;border:2px dashed #F59E0B;border-radius:16px;">
      <tr><td style="padding:18px 20px;font-size:14px;line-height:1.5;color:${TEXT_DARK};">
        <strong style="display:block;margin-bottom:8px;color:#D97706;">💡 Siguiente paso — pago pendiente</strong>
        ${escapeHtml(p.pendingPaymentNote)}
      </td></tr>
    </table>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>Pedido ${escapeHtml(p.shortId)}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 10px 40px rgba(17,24,39,0.08);border:1px solid ${CARD_BORDER};">

        <!-- Encabezado: únicamente el mensaje principal -->
        <tr><td style="background:${BRAND_AMBER};padding:28px 24px;text-align:center;border-bottom:3px solid ${TEXT_DARK};">
          <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:900;color:${TEXT_DARK};letter-spacing:-0.02em;">¡Recibimos tu pedido!</h1>
        </td></tr>

        <tr><td style="padding:24px;">
          <p style="margin:0 0 8px;font-size:16px;line-height:1.55;color:${TEXT_DARK};">
            Hola <strong>${escapeHtml(p.customerName)}</strong>,
          </p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${TEXT_MUTED};">
            Gracias por elegir <strong style="color:${TEXT_DARK};">${escapeHtml(p.brandName)}</strong>. Tu pedido ya quedó registrado y aquí puedes consultar todos sus detalles.
          </p>

          ${pendingBox}

          ${renderOrderSummary(p.shortId, p.orderDate, p.total)}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${CARD_BORDER};border-radius:16px;overflow:hidden;margin-bottom:20px;">
            <thead><tr style="background:#FAFAFA;">
              <th align="left" style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${TEXT_MUTED};">Producto</th>
              <th style="padding:10px 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${TEXT_MUTED};">Cant.</th>
              <th align="right" style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${TEXT_MUTED};">Subtotal</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${TEXT_DARK};">
            <tr><td style="padding:6px 0;color:${TEXT_MUTED};">Subtotal</td><td align="right" style="padding:6px 0;font-weight:600;">${formatPrice(p.subtotal)}</td></tr>
            <tr><td style="padding:6px 0;color:${TEXT_MUTED};">Envío</td><td align="right" style="padding:6px 0;font-weight:600;">${p.shippingFee === 0 ? '<span style="color:' + GREEN + ';">¡Gratis!</span>' : formatPrice(p.shippingFee)}</td></tr>
            ${couponRow}
            <tr><td colspan="2" style="padding:12px 0 8px;border-top:2px solid ${CARD_BORDER};font-size:16px;font-weight:800;color:${TEXT_DARK};">Total</td><td align="right" style="padding:12px 0 8px;border-top:2px solid ${CARD_BORDER};font-size:18px;font-weight:800;color:${TEXT_DARK};">${formatPrice(p.total)}</td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:${BRAND_BG};border-radius:16px;border:1px solid #FDE68A;">
            <tr><td style="padding:16px 18px;font-size:13px;line-height:1.55;color:${TEXT_DARK};">
              <strong style="color:${TEXT_MUTED};font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Envío a</strong><br/>
              <span style="display:block;margin-top:6px;">${escapeHtml(p.deliveryAddress)}</span>
            </td></tr>
          </table>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
            <tr><td align="center" bgcolor="${BRAND_AMBER}" style="border-radius:14px;mso-padding-alt:14px 28px;">
              <a href="${escapeHtml(p.orderUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:800;color:${TEXT_DARK};text-decoration:none;border-radius:14px;background:${BRAND_AMBER};border:2px solid ${TEXT_DARK};box-shadow:0 4px 0 ${TEXT_DARK};">Ver mi pedido →</a>
            </td></tr>
          </table>

          <p style="margin:28px 0 0;text-align:center;font-size:13px;line-height:1.6;color:${TEXT_MUTED};">
            ¿Dudas? Escríbenos por WhatsApp desde la web.<br/>
            Con cariño, el equipo de <strong style="color:${TEXT_DARK};">${escapeHtml(p.brandName)}</strong> 💛
          </p>
        </td></tr>

        <tr><td style="padding:16px 24px;background:#FAFAFA;border-top:1px solid ${CARD_BORDER};text-align:center;font-size:11px;color:${TEXT_MUTED};line-height:1.5;">
          © ${new Date().getFullYear()} ${escapeHtml(p.brandName)} · Hecho con hambre de snacks buenos.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export type AdminNewOrderEmailProps = {
  brandName: string
  shortId: string
  adminOrderUrl: string
  customerName: string
  customerEmail: string
  customerPhone: string
  items: OrderEmailLineItem[]
  total: number
  deliveryAddress: string
}

export type OrderStatusEmailProps = {
  brandName: string
  shortId: string
  customerName: string
  orderUrl: string
  orderDate: string
  total: number
  deliveryAddress?: string
  estimatedDelivery?: string | null
  trackingNumber?: string | null
  carrier?: string | null
}

function renderOrderSummary(shortId: string, orderDate: string, total: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid ${CARD_BORDER};border-radius:14px;overflow:hidden;">
    <tr style="background:#FAFAFA;">
      <td width="33.33%" style="padding:13px 10px;border-right:1px solid ${CARD_BORDER};text-align:center;vertical-align:top;"><p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${TEXT_MUTED};">Pedido</p><p style="margin:0;font-family:ui-monospace,monospace;font-size:13px;font-weight:800;color:${TEXT_DARK};">${escapeHtml(shortId)}</p></td>
      <td width="33.33%" style="padding:13px 10px;border-right:1px solid ${CARD_BORDER};text-align:center;vertical-align:top;"><p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${TEXT_MUTED};">Fecha</p><p style="margin:0;font-size:12px;font-weight:700;color:${TEXT_DARK};">${escapeHtml(orderDate)}</p></td>
      <td width="33.33%" style="padding:13px 10px;text-align:center;vertical-align:top;"><p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${TEXT_MUTED};">Total</p><p style="margin:0;font-size:13px;font-weight:800;color:${TEXT_DARK};">${formatPrice(total)}</p></td>
    </tr>
  </table>`
}

function renderOrderStatusHtml(p: OrderStatusEmailProps, content: { title: string; message: string; status: string; details?: string }): string {
  const address = p.deliveryAddress
    ? `<tr><td style="padding:13px 16px;border-top:1px solid ${CARD_BORDER};"><p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${TEXT_MUTED};">Dirección de entrega</p><p style="margin:5px 0 0;font-size:13px;line-height:1.5;color:${TEXT_DARK};">${escapeHtml(p.deliveryAddress)}</p></td></tr>`
    : ''
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${escapeHtml(content.title)} · ${escapeHtml(p.shortId)}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${CARD_BORDER};border-radius:20px;overflow:hidden;">
<tr><td style="padding:28px 24px;text-align:center;background:${BRAND_AMBER};border-bottom:3px solid ${TEXT_DARK};"><h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:900;letter-spacing:-.02em;color:${TEXT_DARK};">${escapeHtml(content.title)}</h1></td></tr>
<tr><td style="padding:24px;"><p style="margin:0 0 8px;font-size:16px;line-height:1.55;color:${TEXT_DARK};">Hola <strong>${escapeHtml(p.customerName)}</strong>,</p><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${TEXT_MUTED};">${escapeHtml(content.message)}</p>${renderOrderSummary(p.shortId, p.orderDate, p.total)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #FDE68A;border-left:4px solid ${BRAND_AMBER};border-radius:12px;overflow:hidden;background:${BRAND_BG};"><tr><td style="padding:14px 16px;background:${BRAND_BG};"><p style="margin:0;font-size:14px;font-weight:800;color:${TEXT_DARK};">${escapeHtml(content.status)}</p>${content.details ?? ''}</td></tr>${address}</table><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td align="center" bgcolor="${BRAND_AMBER}" style="border-radius:12px;"><a href="${escapeHtml(p.orderUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;border:2px solid ${TEXT_DARK};border-radius:12px;background:${BRAND_AMBER};color:${TEXT_DARK};font-size:15px;font-weight:800;text-decoration:none;">Ver mi pedido</a></td></tr></table><p style="margin:26px 0 0;text-align:center;font-size:13px;line-height:1.6;color:${TEXT_MUTED};">¿Tienes dudas? Estamos para ayudarte.<br/>El equipo de <strong style="color:${TEXT_DARK};">${escapeHtml(p.brandName)}</strong></p></td></tr>
<tr><td style="padding:14px 24px;background:#FAFAFA;border-top:1px solid ${CARD_BORDER};text-align:center;font-size:11px;color:${TEXT_MUTED};">© ${new Date().getFullYear()} ${escapeHtml(p.brandName)}</td></tr></table></td></tr></table></body></html>`
}

/** Notificaciones de pedido con una jerarquía uniforme y segura para clientes de correo. */
export function renderOrderPreparingHtml(p: OrderStatusEmailProps): string {
  return renderOrderStatusHtml(p, { title: 'Tu pedido está en preparación', message: 'Ya estamos alistando tus productos con cuidado. Te avisaremos en cuanto salgan rumbo a tu dirección.', status: 'Estamos preparando tu pedido', details: p.estimatedDelivery ? `<p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:${TEXT_MUTED};">Entrega estimada: <strong style="color:${TEXT_DARK};">${escapeHtml(p.estimatedDelivery)}</strong></p>` : undefined })
}

export function renderOrderShippedHtml(p: OrderStatusEmailProps): string {
  const guide = p.trackingNumber ? `Guía: <strong style="color:${TEXT_DARK};">${escapeHtml(p.trackingNumber)}</strong>${p.carrier ? ` · ${escapeHtml(p.carrier)}` : ''}` : 'Tu pedido ya salió rumbo a tu dirección.'
  return renderOrderStatusHtml(p, { title: 'Tu pedido va en camino', message: 'Tus productos ya salieron y avanzan rumbo a la dirección registrada en tu pedido.', status: 'En camino', details: `<p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:${TEXT_MUTED};">${guide}</p>${p.estimatedDelivery ? `<p style="margin:6px 0 0;font-size:13px;color:${TEXT_MUTED};">Entrega estimada: <strong style="color:${TEXT_DARK};">${escapeHtml(p.estimatedDelivery)}</strong></p>` : ''}` })
}

export function renderOrderDeliveredHtml(p: OrderStatusEmailProps): string {
  return renderOrderStatusHtml(p, { title: 'Tu pedido fue entregado', message: 'La entrega quedó registrada correctamente. Esperamos que disfrutes mucho tus snacks.', status: 'Pedido entregado', details: `<p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:${GREEN};">Gracias por elegirnos. ¡Buen provecho!</p>` })
}

export type OrderRefundEmailProps = OrderStatusEmailProps & {
  amountCents: number
  reason: string
  remainingCents: number
}

/** Correo al cliente cuando se procesa un reembolso (total o parcial) de su pedido. */
export function renderOrderRefundedHtml(p: OrderRefundEmailProps): string {
  const isPartial = p.remainingCents > 0
  const amountLabel = formatPrice(p.amountCents)
  return renderOrderStatusHtml(p, {
    title: isPartial ? 'Reembolso parcial procesado' : 'Reembolso procesado',
    message: 'Procesamos correctamente el reembolso asociado con tu pedido. A continuación encontrarás el detalle.',
    status: `Monto reembolsado: ${amountLabel}`,
    details: `<p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:${TEXT_MUTED};">Motivo: ${escapeHtml(p.reason)}</p>${isPartial ? '<p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:${TEXT_MUTED};">El resto de tu pedido sigue vigente.</p>' : ''}`,
  })
}

/** Correo corto para el equipo interno cuando entra un pedido nuevo. */
export function renderAdminNewOrderHtml(p: AdminNewOrderEmailProps): string {
  const lines = p.items
    .slice(0, 12)
    .map((it) => `<li style="margin-bottom:6px;"><strong>${escapeHtml(it.name)}</strong> × ${it.quantity} · ${formatPrice(it.subtotal)}</li>`)
    .join('')
  const more = p.items.length > 12 ? `<li style="color:${TEXT_MUTED};">… y ${p.items.length - 12} líneas más</li>` : ''

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:20px;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:16px;border:1px solid ${CARD_BORDER};overflow:hidden;">
    <tr><td style="background:${BRAND_AMBER};padding:14px 18px;font-weight:800;color:${TEXT_DARK};font-size:16px;">🛒 Nuevo pedido · ${escapeHtml(p.shortId)}</td></tr>
    <tr><td style="padding:18px;font-size:14px;color:${TEXT_DARK};line-height:1.5;">
      <p style="margin:0 0 12px;"><strong>${escapeHtml(p.customerName)}</strong><br/>
      <a href="mailto:${escapeHtml(p.customerEmail)}" style="color:${TEXT_DARK};text-decoration:underline;">${escapeHtml(p.customerEmail)}</a><br/>
      ${escapeHtml(p.customerPhone)}</p>
      <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;color:${TEXT_MUTED};letter-spacing:0.06em;">Productos</p>
      <ul style="margin:0;padding-left:18px;">${lines}${more}</ul>
      <p style="margin:16px 0 8px;"><strong>Total:</strong> ${formatPrice(p.total)}</p>
      <p style="margin:0;font-size:13px;color:${TEXT_MUTED};">${escapeHtml(p.deliveryAddress)}</p>
      <p style="margin:20px 0 0;"><a href="${escapeHtml(p.adminOrderUrl)}" style="display:inline-block;padding:10px 18px;background:${TEXT_DARK};color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:700;font-size:13px;">Abrir en admin</a></p>
    </td></tr>
  </table>
  <p style="text-align:center;font-size:11px;color:#9CA3AF;margin-top:12px;">${escapeHtml(p.brandName)}</p>
</body></html>`
}
