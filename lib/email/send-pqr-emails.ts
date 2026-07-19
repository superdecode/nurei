import { createHash } from 'node:crypto'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePublicUrl } from '@/lib/utils/resolve-origin'
import {
  renderPqrAdminNotificationHtml,
  renderPqrCustomerAckHtml,
  renderPqrReplyHtml,
} from '@/lib/email/templates/pqr-emails-html'

async function sendResendEmail(
  resend: Resend,
  message: Parameters<Resend['emails']['send']>[0],
  context: string,
  options?: Parameters<Resend['emails']['send']>[1]
): Promise<{ ok: boolean }> {
  const { error } = await resend.emails.send(message, options)
  if (error) {
    console.error(`[email] Resend rechazó ${context}:`, error)
    return { ok: false }
  }
  return { ok: true }
}

/** Mirrors send-order-emails.ts's recipient logic, gated on the 'pqr' module instead of 'pedidos'. */
async function getPqrInternalRecipients(): Promise<string[]> {
  try {
    const supabase = createServiceClient()
    const { data: admins } = await supabase
      .from('user_profiles')
      .select('id, is_active, role, admin_role:admin_roles(permissions)')
      .eq('role', 'admin')
      .eq('is_active', true)

    const enabledAdminIds = (admins ?? [])
      .filter((row) => {
        const perms =
          (row.admin_role as { permissions?: Record<string, string> } | null)?.permissions ?? {}
        return (perms.pqr ?? 'sin_acceso') !== 'sin_acceso'
      })
      .map((row) => row.id)

    if (enabledAdminIds.length === 0) return []

    const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const emails = authData.users
      .filter((u) => enabledAdminIds.includes(u.id))
      .map((u) => u.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e))

    return Array.from(new Set(emails))
  } catch (e) {
    console.error('[email] Could not load PQR internal recipients:', e)
    return []
  }
}

type PqrTicketForEmail = {
  id: string
  ticket_number: string
  tipo: string
  prioridad: string
  asunto: string
  mensaje: string
  cliente_nombre: string | null
  cliente_email: string
  order_short_id: string | null
}

/** Sends the admin notification + customer acknowledgement for a newly created PQR ticket. */
export async function sendPqrCreatedEmails(ticket: PqrTicketForEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY no configurada — omitiendo envío de correos de PQR.')
    return
  }

  const resend = new Resend(apiKey)
  const brandName = 'nurei'
  const from = process.env.EMAIL_FROM ?? `${brandName} <onboarding@resend.dev>`
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined
  const base = resolvePublicUrl()
  const adminPqrUrl = base ? `${base}/admin/pqr?id=${ticket.id}` : `/admin/pqr?id=${ticket.id}`

  const recipients = await getPqrInternalRecipients()
  const envAdminEmail = process.env.PQR_NOTIFY_EMAIL?.trim().toLowerCase()
  const notifyRecipients = Array.from(new Set([...(envAdminEmail ? [envAdminEmail] : []), ...recipients]))

  if (notifyRecipients.length > 0) {
    const adminHtml = renderPqrAdminNotificationHtml({
      brandName,
      ticketNumber: ticket.ticket_number,
      tipo: ticket.tipo,
      prioridad: ticket.prioridad,
      asunto: ticket.asunto,
      mensaje: ticket.mensaje,
      clienteNombre: ticket.cliente_nombre,
      clienteEmail: ticket.cliente_email,
      orderShortId: ticket.order_short_id,
      adminPqrUrl,
    })

    await sendResendEmail(
      resend,
      {
        from,
        to: notifyRecipients,
        replyTo: ticket.cliente_email,
        subject: `Nuevo PQR ${ticket.ticket_number} — ${ticket.asunto}`,
        html: adminHtml,
      },
      `PQR admin ${ticket.ticket_number}`,
      { idempotencyKey: `pqr-created-${ticket.id}-admin` }
    )
  }

  const customerHtml = renderPqrCustomerAckHtml({
    brandName,
    ticketNumber: ticket.ticket_number,
    asunto: ticket.asunto,
  })

  await sendResendEmail(
    resend,
    {
      from,
      to: ticket.cliente_email,
      replyTo,
      subject: `Recibimos tu mensaje — folio ${ticket.ticket_number}`,
      html: customerHtml,
    },
    `PQR ack ${ticket.ticket_number}`,
    { idempotencyKey: `pqr-created-${ticket.id}-customer` }
  )
}

/** Notifies the customer when an admin adds/updates the response on their ticket. */
export async function sendPqrReplyEmail(ticket: {
  id: string
  ticket_number: string
  asunto: string
  respuesta: string
  estado: string
  cliente_email: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY no configurada — omitiendo envío de respuesta de PQR.')
    return
  }

  const resend = new Resend(apiKey)
  const brandName = 'nurei'
  const from = process.env.EMAIL_FROM ?? `${brandName} <onboarding@resend.dev>`
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined

  const html = renderPqrReplyHtml({
    brandName,
    ticketNumber: ticket.ticket_number,
    asunto: ticket.asunto,
    respuesta: ticket.respuesta,
    estado: ticket.estado,
  })

  await sendResendEmail(
    resend,
    {
      from,
      to: ticket.cliente_email,
      replyTo,
      subject: `Respuesta a tu PQR — folio ${ticket.ticket_number}`,
      html,
    },
    `PQR reply ${ticket.ticket_number}`,
    {
      idempotencyKey: `pqr-reply-${ticket.id}-${createHash('sha1').update(ticket.respuesta).digest('hex').slice(0, 12)}`,
    }
  )
}
