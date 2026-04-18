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
  deliveryAddress: string
  /** Instrucciones si el pago está pendiente (OXXO / transferencia). */
  pendingPaymentNote?: string | null
}

const BRAND_BG = '#FFFBEB'
const BRAND_AMBER = '#FFC107'
const TEXT_DARK = '#111827'
const TEXT_MUTED = '#6B7280'
const GREEN = '#10B981'
const CARD_BORDER = '#E5E7EB'

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

        <!-- Header divertido -->
        <tr><td style="background:linear-gradient(135deg, ${BRAND_BG} 0%, #FFF 50%, #ECFEFF 100%);padding:28px 24px;text-align:center;border-bottom:3px solid ${BRAND_AMBER};">
          <div style="font-size:36px;line-height:1;margin-bottom:8px;">🎉🍘✨</div>
          <p style="margin:0;font-size:22px;font-weight:800;color:${TEXT_DARK};letter-spacing:-0.02em;">¡Recibimos tu pedido!</p>
          <p style="margin:10px 0 0;font-size:15px;color:${TEXT_MUTED};line-height:1.5;">Hola <strong style="color:${TEXT_DARK};">${escapeHtml(p.customerName)}</strong>, gracias por elegir <strong style="color:${TEXT_DARK};">${escapeHtml(p.brandName)}</strong>. Tu snack ya está en fila.</p>
          <div style="margin-top:16px;display:inline-block;background:${TEXT_DARK};color:#FFFFFF;font-family:ui-monospace,monospace;font-size:13px;font-weight:700;padding:8px 14px;border-radius:999px;letter-spacing:0.05em;">${escapeHtml(p.shortId)}</div>
        </td></tr>

        <tr><td style="padding:24px;">
          ${pendingBox}

          <p style="margin:0 0 16px;font-size:15px;color:${TEXT_DARK};line-height:1.55;">
            Aquí tienes el resumen. Puedes seguir el estado cuando quieras:
          </p>

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
  deliveryAddress?: string
  estimatedDelivery?: string | null
}

/** Correo al cliente cuando su pedido está siendo preparado. */
export function renderOrderPreparingHtml(p: OrderStatusEmailProps): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>Pedido ${escapeHtml(p.shortId)} en preparación</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 10px 40px rgba(17,24,39,0.08);border:1px solid ${CARD_BORDER};">
        <tr><td style="background:linear-gradient(135deg,${BRAND_BG} 0%,#FFF 60%);padding:28px 24px;text-align:center;border-bottom:3px solid ${BRAND_AMBER};">
          <div style="font-size:40px;line-height:1;margin-bottom:8px;">👨‍🍳📦</div>
          <p style="margin:0;font-size:22px;font-weight:800;color:${TEXT_DARK};letter-spacing:-0.02em;">¡Tu pedido está en preparación!</p>
          <p style="margin:10px 0 0;font-size:15px;color:${TEXT_MUTED};">Hola <strong style="color:${TEXT_DARK};">${escapeHtml(p.customerName)}</strong>, ya estamos alistando tus productos.</p>
          <div style="margin-top:16px;display:inline-block;background:${TEXT_DARK};color:#FFFFFF;font-family:ui-monospace,monospace;font-size:13px;font-weight:700;padding:8px 14px;border-radius:999px;letter-spacing:0.05em;">${escapeHtml(p.shortId)}</div>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_BG};border-radius:16px;border:2px solid #FDE68A;margin-bottom:24px;">
            <tr><td style="padding:20px 22px;">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;background:${BRAND_AMBER};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;text-align:center;line-height:40px;">📦</div>
                <div>
                  <p style="margin:0;font-size:15px;font-weight:800;color:${TEXT_DARK};">En preparación</p>
                  <p style="margin:4px 0 0;font-size:13px;color:${TEXT_MUTED};">Tu pedido está siendo alistado con mucho cariño.</p>
                </div>
              </div>
            </td></tr>
          </table>
          ${p.estimatedDelivery ? `<p style="margin:0 0 20px;font-size:14px;color:${TEXT_MUTED};"><strong style="color:${TEXT_DARK};">Entrega estimada:</strong> ${escapeHtml(p.estimatedDelivery)}</p>` : ''}
          ${p.deliveryAddress ? `<p style="margin:0 0 20px;font-size:14px;color:${TEXT_MUTED};"><strong style="color:${TEXT_DARK};">Dirección de entrega:</strong> ${escapeHtml(p.deliveryAddress)}</p>` : ''}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr><td align="center" bgcolor="${BRAND_AMBER}" style="border-radius:14px;">
              <a href="${escapeHtml(p.orderUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:800;color:${TEXT_DARK};text-decoration:none;border-radius:14px;background:${BRAND_AMBER};border:2px solid ${TEXT_DARK};box-shadow:0 4px 0 ${TEXT_DARK};">Seguir mi pedido →</a>
            </td></tr>
          </table>
          <p style="margin:28px 0 0;text-align:center;font-size:13px;color:${TEXT_MUTED};">¡Gracias por tu paciencia! El equipo de <strong style="color:${TEXT_DARK};">${escapeHtml(p.brandName)}</strong> 💛</p>
        </td></tr>
        <tr><td style="padding:14px 24px;background:#FAFAFA;border-top:1px solid ${CARD_BORDER};text-align:center;font-size:11px;color:${TEXT_MUTED};">© ${new Date().getFullYear()} ${escapeHtml(p.brandName)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

/** Correo al cliente cuando su pedido fue entregado. */
export function renderOrderDeliveredHtml(p: OrderStatusEmailProps): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>Pedido ${escapeHtml(p.shortId)} entregado</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 10px 40px rgba(17,24,39,0.08);border:1px solid ${CARD_BORDER};">
        <tr><td style="background:linear-gradient(135deg,#F0FDF4 0%,#FFF 50%,${BRAND_BG} 100%);padding:28px 24px;text-align:center;border-bottom:3px solid #10B981;">
          <div style="font-size:40px;line-height:1;margin-bottom:8px;">🎉✅🍘</div>
          <p style="margin:0;font-size:22px;font-weight:800;color:${TEXT_DARK};letter-spacing:-0.02em;">¡Pedido entregado!</p>
          <p style="margin:10px 0 0;font-size:15px;color:${TEXT_MUTED};">Hola <strong style="color:${TEXT_DARK};">${escapeHtml(p.customerName)}</strong>, ¡esperamos que disfrutes tus snacks!</p>
          <div style="margin-top:16px;display:inline-block;background:${TEXT_DARK};color:#FFFFFF;font-family:ui-monospace,monospace;font-size:13px;font-weight:700;padding:8px 14px;border-radius:999px;letter-spacing:0.05em;">${escapeHtml(p.shortId)}</div>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF4;border-radius:16px;border:2px solid #6EE7B7;margin-bottom:24px;">
            <tr><td style="padding:20px 22px;text-align:center;">
              <div style="font-size:36px;margin-bottom:8px;">📬</div>
              <p style="margin:0;font-size:15px;font-weight:800;color:#065F46;">¡Tu pedido llegó a casa!</p>
              <p style="margin:8px 0 0;font-size:13px;color:#047857;">Esperamos que todo esté perfecto. ¡Buen provecho!</p>
            </td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr><td align="center" bgcolor="${BRAND_AMBER}" style="border-radius:14px;">
              <a href="${escapeHtml(p.orderUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:800;color:${TEXT_DARK};text-decoration:none;border-radius:14px;background:${BRAND_AMBER};border:2px solid ${TEXT_DARK};box-shadow:0 4px 0 ${TEXT_DARK};">Ver mi pedido →</a>
            </td></tr>
          </table>
          <p style="margin:0;text-align:center;font-size:13px;line-height:1.6;color:${TEXT_MUTED};">¿Algo no estuvo bien? Escríbenos por WhatsApp.<br/>Con cariño, el equipo de <strong style="color:${TEXT_DARK};">${escapeHtml(p.brandName)}</strong> 💛</p>
        </td></tr>
        <tr><td style="padding:14px 24px;background:#FAFAFA;border-top:1px solid ${CARD_BORDER};text-align:center;font-size:11px;color:${TEXT_MUTED};">© ${new Date().getFullYear()} ${escapeHtml(p.brandName)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
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
      <a href="mailto:${escapeHtml(p.customerEmail)}" style="color:#2563EB;">${escapeHtml(p.customerEmail)}</a><br/>
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
