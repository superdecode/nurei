import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePublicUrl } from '@/lib/utils/resolve-origin'
import { getCheckoutOrder } from '@/lib/server/checkout-session-store'
import { formatPrice } from '@/lib/utils/format'
import type { OrderItem } from '@/types'
import {
  renderAdminNewOrderHtml,
  renderCustomerOrderConfirmationHtml,
  renderOrderPreparingHtml,
  renderOrderShippedHtml,
  renderOrderDeliveredHtml,
  renderOrderRefundedHtml,
  type OrderEmailLineItem,
} from '@/lib/email/templates/order-emails-html'

async function sendResendEmail(
  resend: Resend,
  message: Parameters<Resend['emails']['send']>[0],
  context: string,
  options?: Parameters<Resend['emails']['send']>[1],
): Promise<{ ok: boolean }> {
  const { error } = await resend.emails.send(message, options)
  if (error) {
    // Resend reports API rejections in its result instead of throwing. Treat
    // them as failures so a bad sender/template is visible in function logs.
    console.error(`[email] Resend rechazó ${context}:`, error)
    return { ok: false }
  }
  return { ok: true }
}

function safeAttrUrl(url: string): string {
  try {
    return new URL(url).href
  } catch {
    return url.replace(/"/g, '&quot;')
  }
}

export type OrderEmailOptions = {
  /** Nota extra si pago OXXO / transferencia aún pendiente. */
  pendingPaymentNote?: string | null
}

type NormalizedPayload = {
  shortId: string
  publicAccessToken: string | null
  customerName: string
  customerEmail: string
  customerPhone: string
  deliveryAddress: string
  subtotal: number
  shippingFee: number
  couponDiscount: number
  couponCode: string | null
  total: number
  createdAt: string
  items: OrderEmailLineItem[]
}

function formatOrderDate(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

async function getInternalRecipientsByPreference(supabase = createServiceClient()): Promise<string[]> {
  try {
    const { data: admins } = await supabase
      .from('user_profiles')
      .select('id, is_active, role, notification_prefs, admin_role:admin_roles(permissions)')
      .eq('role', 'admin')
      .eq('is_active', true)

    const enabledAdminIds = (admins ?? [])
      .filter((row) => {
        const prefs = (row.notification_prefs ?? {}) as Record<string, unknown>
        const perms =
          (row.admin_role as { permissions?: Record<string, string> } | null)?.permissions ?? {}
        const pedidosLevel = perms.pedidos ?? 'sin_acceso'
        return prefs.email_on_new_order !== false && pedidosLevel !== 'sin_acceso'
      })
      .map((row) => row.id)

    if (enabledAdminIds.length === 0) return []

    const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const emails =
      authData.users
        .filter((u) => enabledAdminIds.includes(u.id))
        .map((u) => u.email?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e)) ?? []

    return Array.from(new Set(emails))
  } catch (e) {
    console.error('[email] Could not load internal recipients by preference:', e)
    return []
  }
}

async function loadOrderPayload(orderId: string): Promise<NormalizedPayload | null> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from('orders')
        .select(
          'short_id, public_access_token, customer_email, customer_name, customer_phone, delivery_address, subtotal, shipping_fee, coupon_discount, coupon_code, total, created_at, items'
        )
        .eq('id', orderId)
        .maybeSingle()

      if (!error && data?.customer_email) {
        const raw = (data.items ?? []) as OrderItem[]
        return {
          shortId: data.short_id,
          publicAccessToken: data.public_access_token ?? null,
          customerName: data.customer_name?.trim() || 'Cliente',
          customerEmail: data.customer_email,
          customerPhone: data.customer_phone ?? '',
          deliveryAddress: data.delivery_address ?? '',
          subtotal: data.subtotal,
          shippingFee: data.shipping_fee ?? 0,
          couponDiscount: data.coupon_discount ?? 0,
          couponCode: data.coupon_code,
          total: data.total,
          createdAt: data.created_at,
          items: raw.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            subtotal: i.subtotal,
          })),
        }
      }
    } catch (e) {
      console.warn('[email] No se pudo leer el pedido en BD:', e)
    }
  }

  const cached = getCheckoutOrder(orderId)
  if (!cached) return null
  const email = cached.shippingAddress.email?.trim() || cached.customerEmail?.trim()
  if (!email) return null

  const address = [
    cached.shippingAddress.address,
    cached.shippingAddress.city,
    cached.shippingAddress.state,
    cached.shippingAddress.zipCode,
    cached.shippingAddress.country,
  ]
    .filter(Boolean)
    .join(', ')

  return {
    shortId: cached.shortId,
    publicAccessToken: null,
    customerName: cached.customerName,
    customerEmail: email,
    customerPhone: cached.customerPhone,
    deliveryAddress: address,
    subtotal: cached.subtotal,
    shippingFee: cached.shippingMethod.price,
    couponDiscount: cached.couponDiscount,
    couponCode: cached.couponCode,
    total: cached.total,
    createdAt: new Date().toISOString(),
    items: cached.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      subtotal: i.subtotal,
    })),
  }
}

/**
 * Envía correo de confirmación al cliente y, si está configurado, aviso al equipo.
 * No lanza si falta RESEND_API_KEY (solo log).
 */
export async function sendOrderConfirmationEmails(
  orderId: string,
  options?: OrderEmailOptions
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY no configurada — omitiendo envío de correos.')
    return { sent: false, reason: 'no_api_key' }
  }

  const payload = await loadOrderPayload(orderId)
  if (!payload) {
    console.warn('[email] Pedido no encontrado para correo:', orderId)
    return { sent: false, reason: 'order_not_found' }
  }

  const brandName = process.env.NEXT_PUBLIC_APP_NAME ?? 'nurei'
  const baseUrl = resolvePublicUrl()
  const orderUrl = safeAttrUrl(`${baseUrl}/pedido/${orderId}${payload.publicAccessToken ? `?token=${encodeURIComponent(payload.publicAccessToken)}` : ''}`)
  const adminBase = process.env.ADMIN_APP_URL ?? baseUrl
  const adminOrderUrl = safeAttrUrl(`${adminBase.replace(/\/$/, '')}/admin/pedidos/${orderId}`)

  const resend = new Resend(apiKey)
  const from = process.env.EMAIL_FROM ?? `${brandName} <onboarding@resend.dev>`
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined

  const customerHtml = renderCustomerOrderConfirmationHtml({
    brandName,
    shortId: payload.shortId,
    customerName: payload.customerName,
    orderUrl,
    items: payload.items,
    subtotal: payload.subtotal,
    shippingFee: payload.shippingFee,
    couponDiscount: payload.couponDiscount,
    couponCode: payload.couponCode,
    total: payload.total,
    orderDate: formatOrderDate(payload.createdAt),
    deliveryAddress: payload.deliveryAddress,
    pendingPaymentNote: options?.pendingPaymentNote ?? null,
  })

  try {
    const result = await sendResendEmail(resend, {
      from,
      to: [payload.customerEmail],
      replyTo,
      subject: `¡Tu pedido ${payload.shortId} está en marcha!`,
      html: customerHtml,
    }, 'confirmación al cliente')
    if (!result.ok) return { sent: false, reason: 'resend_customer_failed' }
  } catch (e) {
    console.error('[email] Error enviando correo al cliente:', e)
    return { sent: false, reason: 'resend_customer_failed' }
  }

  const envAdminEmail = process.env.ORDERS_NOTIFY_EMAIL?.trim().toLowerCase()
  const preferredRecipients = await getInternalRecipientsByPreference()
  const notifyRecipients = Array.from(new Set([...(envAdminEmail ? [envAdminEmail] : []), ...preferredRecipients]))
  if (notifyRecipients.length > 0) {
    const adminHtml = renderAdminNewOrderHtml({
      brandName,
      shortId: payload.shortId,
      adminOrderUrl,
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      customerPhone: payload.customerPhone,
      items: payload.items,
      total: payload.total,
      deliveryAddress: payload.deliveryAddress,
    })
    try {
      await sendResendEmail(resend, {
        from,
        to: notifyRecipients,
        replyTo,
        subject: `[${brandName}] Nuevo pedido ${payload.shortId} · ${formatPrice(payload.total)}`,
        html: adminHtml,
      }, 'aviso interno de pedido')
    } catch (e) {
      console.error('[email] Error enviando correo interno:', e)
    }
  }

  return { sent: true }
}

type StatusEmailType = 'preparing' | 'shipped' | 'delivered'

/**
 * Envía correo de actualización de estatus al cliente.
 * 'preparing' (procesando), 'shipped' (en camino) y 'delivered' (entregado).
 */
export async function sendOrderStatusEmail(
  orderId: string,
  status: StatusEmailType
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, reason: 'no_api_key' }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('orders')
    .select('short_id, public_access_token, customer_email, customer_name, delivery_address, tracking_number, carrier, total, created_at')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !data?.customer_email) return { sent: false, reason: 'order_not_found' }

  const brandName = process.env.NEXT_PUBLIC_APP_NAME ?? 'nurei'
  const baseUrl = resolvePublicUrl()
  const orderUrl = safeAttrUrl(`${baseUrl}/pedido/${orderId}${data.public_access_token ? `?token=${encodeURIComponent(data.public_access_token)}` : ''}`)
  const from = process.env.EMAIL_FROM ?? `${brandName} <onboarding@resend.dev>`
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined

  const resend = new Resend(apiKey)

  const props = {
    brandName,
    shortId: data.short_id,
    customerName: (data.customer_name ?? 'Cliente').trim() || 'Cliente',
    orderUrl,
    orderDate: formatOrderDate(data.created_at),
    total: data.total ?? 0,
    deliveryAddress: data.delivery_address ?? undefined,
    trackingNumber: data.tracking_number ?? null,
    carrier: data.carrier ?? null,
  }

  const templates: Record<StatusEmailType, { subject: string; html: string }> = {
    preparing: {
      subject: `Tu pedido ${data.short_id} está siendo preparado 📦`,
      html: renderOrderPreparingHtml(props),
    },
    shipped: {
      subject: `Tu pedido ${data.short_id} va en camino 🚚`,
      html: renderOrderShippedHtml(props),
    },
    delivered: {
      subject: `¡Tu pedido ${data.short_id} fue entregado! 🎉`,
      html: renderOrderDeliveredHtml(props),
    },
  }

  const { subject, html } = templates[status]

  try {
    const result = await sendResendEmail(
      resend,
      { from, to: [data.customer_email], replyTo, subject, html },
      `actualización de estatus (${status})`,
      // A double click or concurrent retry must not send the same lifecycle
      // notification twice. Resend keeps idempotency keys for safe retries.
      { idempotencyKey: `order-status-${orderId}-${status}` },
    )
    return result.ok ? { sent: true } : { sent: false, reason: 'resend_failed' }
  } catch (e) {
    console.error(`[email] Error enviando correo de estatus (${status}):`, e)
    return { sent: false, reason: 'resend_failed' }
  }
}

export async function sendOrderRefundEmail(
  orderId: string,
  details: { amountCents: number; reason: string; refundMethod: string }
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, reason: 'no_api_key' }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('orders')
    .select('short_id, public_access_token, customer_email, customer_name, total, refunded_amount_cents, created_at')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !data?.customer_email) return { sent: false, reason: 'order_not_found' }

  const brandName = process.env.NEXT_PUBLIC_APP_NAME ?? 'nurei'
  const baseUrl = resolvePublicUrl()
  const orderUrl = safeAttrUrl(`${baseUrl}/pedido/${orderId}${data.public_access_token ? `?token=${encodeURIComponent(data.public_access_token)}` : ''}`)
  const from = process.env.EMAIL_FROM ?? `${brandName} <onboarding@resend.dev>`
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined

  const resend = new Resend(apiKey)
  const remainingCents = Math.max(0, (data.total ?? 0) - (data.refunded_amount_cents ?? 0))

  const html = renderOrderRefundedHtml({
    brandName,
    shortId: data.short_id,
    customerName: (data.customer_name ?? 'Cliente').trim() || 'Cliente',
    orderUrl,
    orderDate: formatOrderDate(data.created_at),
    total: data.total ?? 0,
    amountCents: details.amountCents,
    reason: details.reason,
    remainingCents,
  })

  try {
    const result = await sendResendEmail(resend, {
      from,
      to: [data.customer_email],
      replyTo,
      subject: `Reembolso procesado: pedido ${data.short_id}`,
      html,
    }, 'reembolso')
    return result.ok ? { sent: true } : { sent: false, reason: 'resend_failed' }
  } catch (e) {
    console.error('[email] Error enviando correo de reembolso:', e)
    return { sent: false, reason: 'resend_failed' }
  }
}
