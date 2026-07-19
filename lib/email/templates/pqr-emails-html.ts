import { escapeHtml } from '@/lib/email/escape-html'
import { BRAND_BG, BRAND_AMBER, TEXT_DARK, TEXT_MUTED, CARD_BORDER } from '@/lib/email/templates/order-emails-html'

const CANVAS_GRADIENT = 'background-color:#F3F4F6;background-image:linear-gradient(180deg,#F8F7F2 0%,#ECEAE3 100%);'
const HEADER_GRADIENT = `background-color:${BRAND_AMBER};background-image:linear-gradient(135deg,#FFC107 0%,#FFD75A 58%,#FFF0A6 100%);`

const TIPO_LABELS: Record<string, string> = {
  peticion: 'Petición',
  queja: 'Queja',
  reclamo: 'Reclamo',
  sugerencia: 'Sugerencia',
}

const PRIORIDAD_LABELS: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
}

function shell(title: string, headerEmoji: string, headerText: string, bodyHtml: string, footer: string): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;${CANVAS_GRADIENT}font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${CANVAS_GRADIENT}padding:24px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:22px;border:1px solid ${CARD_BORDER};overflow:hidden;box-shadow:0 14px 44px rgba(17,24,39,.10);">
        <tr><td style="${HEADER_GRADIENT}padding:26px 24px;text-align:center;border-bottom:3px solid ${TEXT_DARK};">
          <h1 style="margin:0;font-size:23px;line-height:1.25;font-weight:900;color:${TEXT_DARK};letter-spacing:-.02em;"><span style="display:inline-block;margin-right:8px;">${headerEmoji}</span>${escapeHtml(headerText)}</h1>
        </td></tr>
        <tr><td style="padding:22px 22px 26px;">${bodyHtml}</td></tr>
        <tr><td style="padding:14px 24px;background:#FAFAFA;border-top:1px solid ${CARD_BORDER};text-align:center;font-size:11px;color:${TEXT_MUTED};">${escapeHtml(footer)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export type PqrAdminNotificationProps = {
  brandName: string
  ticketNumber: string
  tipo: string
  prioridad: string
  asunto: string
  mensaje: string
  clienteNombre: string | null
  clienteEmail: string
  orderShortId: string | null
  adminPqrUrl: string
}

export function renderPqrAdminNotificationHtml(p: PqrAdminNotificationProps): string {
  const orderRow = p.orderShortId
    ? `<tr><td style="padding:11px 12px;border-bottom:1px solid ${CARD_BORDER};font-size:13px;color:${TEXT_MUTED};"><strong style="color:${TEXT_DARK};">Pedido asociado:</strong> ${escapeHtml(p.orderShortId)}</td></tr>`
    : ''

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid ${CARD_BORDER};border-radius:14px;overflow:hidden;table-layout:fixed;">
      <tr style="background:#FAFAFA;">
        <td width="33%" style="padding:13px 8px;text-align:center;border-right:1px solid ${CARD_BORDER};vertical-align:top;"><p style="margin:0 0 4px;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${TEXT_MUTED};">Folio</p><p style="margin:0;font-family:ui-monospace,monospace;font-size:12px;font-weight:900;color:${TEXT_DARK};">${escapeHtml(p.ticketNumber)}</p></td>
        <td width="33%" style="padding:13px 8px;text-align:center;border-right:1px solid ${CARD_BORDER};vertical-align:top;"><p style="margin:0 0 4px;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${TEXT_MUTED};">Tipo</p><p style="margin:0;font-size:11px;font-weight:800;color:${TEXT_DARK};">${escapeHtml(TIPO_LABELS[p.tipo] ?? p.tipo)}</p></td>
        <td width="34%" style="padding:13px 8px;text-align:center;vertical-align:top;"><p style="margin:0 0 4px;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${TEXT_MUTED};">Prioridad</p><p style="margin:0;font-size:11px;font-weight:800;color:${TEXT_DARK};">${escapeHtml(PRIORIDAD_LABELS[p.prioridad] ?? p.prioridad)}</p></td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border:1px solid #FDE68A;border-radius:14px;overflow:hidden;background-color:${BRAND_BG};background-image:linear-gradient(135deg,#FFFBEB 0%,#FFFFFF 100%);">
      <tr><td style="padding:10px 14px;border-bottom:1px solid #FDE68A;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:${TEXT_DARK};">Cliente</td></tr>
      <tr><td style="padding:14px;">
        <p style="margin:0 0 7px;font-size:15px;font-weight:900;color:${TEXT_DARK};">${escapeHtml(p.clienteNombre || 'Sin nombre')}</p>
        <p style="margin:0;font-size:13px;color:${TEXT_MUTED};"><strong style="color:${TEXT_DARK};">Correo:</strong> <a href="mailto:${escapeHtml(p.clienteEmail)}" style="color:${TEXT_DARK};text-decoration:underline;">${escapeHtml(p.clienteEmail)}</a></p>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid ${CARD_BORDER};border-radius:14px;overflow:hidden;">
      <tr><td style="padding:10px 14px;border-bottom:1px solid ${CARD_BORDER};background:#FAFAFA;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:${TEXT_DARK};">${escapeHtml(p.asunto)}</td></tr>
      ${orderRow}
      <tr><td style="padding:14px;font-size:13px;line-height:1.6;color:${TEXT_DARK};white-space:pre-wrap;">${escapeHtml(p.mensaje)}</td></tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto 0;"><tr><td align="center" bgcolor="${BRAND_AMBER}" style="border-radius:14px;"><a href="${escapeHtml(p.adminPqrUrl)}" style="display:inline-block;padding:14px 30px;background-color:${BRAND_AMBER};background-image:linear-gradient(135deg,#FFC107 0%,#FFD75A 100%);box-shadow:0 9px 24px rgba(255,193,7,.38);color:${TEXT_DARK};text-decoration:none;border:none;border-radius:14px;font-weight:900;font-size:14px;">Abrir ticket en admin</a></td></tr></table>`

  return shell(
    `Nuevo PQR ${p.ticketNumber}`,
    '📮',
    'Nuevo PQR recibido',
    body,
    `Notificación interna · ${p.brandName}`
  )
}

export type PqrCustomerAckProps = {
  brandName: string
  ticketNumber: string
  asunto: string
}

export function renderPqrCustomerAckHtml(p: PqrCustomerAckProps): string {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${TEXT_DARK};">
      Recibimos tu mensaje y nuestro equipo lo revisará lo antes posible.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid ${CARD_BORDER};border-radius:14px;overflow:hidden;">
      <tr><td style="padding:14px;">
        <p style="margin:0 0 6px;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:${TEXT_MUTED};">Folio de seguimiento</p>
        <p style="margin:0 0 12px;font-family:ui-monospace,monospace;font-size:16px;font-weight:900;color:${TEXT_DARK};">${escapeHtml(p.ticketNumber)}</p>
        <p style="margin:0;font-size:13px;color:${TEXT_MUTED};"><strong style="color:${TEXT_DARK};">Asunto:</strong> ${escapeHtml(p.asunto)}</p>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.6;color:${TEXT_MUTED};">
      Guarda este folio por si necesitas darle seguimiento a tu caso.
    </p>`

  return shell(
    `Recibimos tu mensaje — ${p.ticketNumber}`,
    '✅',
    'Recibimos tu mensaje',
    body,
    `${p.brandName} · Atención al cliente`
  )
}

export type PqrReplyProps = {
  brandName: string
  ticketNumber: string
  asunto: string
  respuesta: string
  estado: string
}

const ESTADO_LABELS: Record<string, string> = {
  abierto: 'Abierto',
  en_proceso: 'En proceso',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
}

export function renderPqrReplyHtml(p: PqrReplyProps): string {
  const body = `
    <p style="margin:0 0 16px;font-size:13px;color:${TEXT_MUTED};">
      Folio <strong style="color:${TEXT_DARK};font-family:ui-monospace,monospace;">${escapeHtml(p.ticketNumber)}</strong> · ${escapeHtml(p.asunto)}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid ${CARD_BORDER};border-radius:14px;overflow:hidden;">
      <tr><td style="padding:10px 14px;border-bottom:1px solid ${CARD_BORDER};background:#FAFAFA;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:${TEXT_DARK};">Respuesta de nuestro equipo</td></tr>
      <tr><td style="padding:14px;font-size:14px;line-height:1.6;color:${TEXT_DARK};white-space:pre-wrap;">${escapeHtml(p.respuesta)}</td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:${TEXT_MUTED};">
      Estado actual: <strong style="color:${TEXT_DARK};">${escapeHtml(ESTADO_LABELS[p.estado] ?? p.estado)}</strong>
    </p>`

  return shell(
    `Respuesta a tu PQR ${p.ticketNumber}`,
    '💬',
    'Tenemos una respuesta para ti',
    body,
    `${p.brandName} · Atención al cliente`
  )
}
