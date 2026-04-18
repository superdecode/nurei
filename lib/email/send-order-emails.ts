import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { getCheckoutOrder } from '@/lib/server/checkout-session-store'
import { formatPrice } from '@/lib/utils/format'
import type { OrderItem } from '@/types'
import {
  renderAdminNewOrderHtml,
  renderCustomerOrderConfirmationHtml,
  renderOrderPreparingHtml,
  renderOrderDeliveredHtml,
  type OrderEmailLineItem,
} from '@/lib/email/templates/order-emails-html'

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
  customerName: string
  customerEmail: string
  customerPhone: string
  deliveryAddress: string
  subtotal: number
  shippingFee: number
  couponDiscount: number
  couponCode: string | null
  total: number
  items: OrderEmailLineItem[]
}

async function loadOrderPayload(orderId: string): Promise<NormalizedPayload | null> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from('orders')
        .select(
          'short_id, customer_email, customer_name, customer_phone, delivery_address, subtotal, shipping_fee, coupon_discount, coupon_code, total, items'
        )
        .eq('id', orderId)
        .maybeSingle()

      if (!error && data?.customer_email) {
        const raw = (data.items ?? []) as OrderItem[]
        return {
          shortId: data.short_id,
          customerName: data.customer_name?.trim() || 'Cliente',
          customerEmail: data.customer_email,
          customerPhone: data.customer_phone ?? '',
          deliveryAddress: data.delivery_address ?? '',
          subtotal: data.subtotal,
          shippingFee: data.shipping_fee ?? 0,
          couponDiscount: data.coupon_discount ?? 0,
          couponCode: data.coupon_code,
          total: data.total,
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
    customerName: cached.customerName,
    customerEmail: email,
    customerPhone: cached.customerPhone,
    deliveryAddress: address,
    subtotal: cached.subtotal,
    shippingFee: cached.shippingMethod.price,
    couponDiscount: cached.couponDiscount,
    couponCode: cached.couponCode,
    total: cached.total,
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
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const orderUrl = safeAttrUrl(`${baseUrl}/pedido/${orderId}`)
  const adminBase = process.env.ADMIN_APP_URL ?? baseUrl
  const adminOrderUrl = safeAttrUrl(`${adminBase.replace(/\/$/, '')}/admin/pedidos/${orderId}`)

  const resend = new Resend(apiKey)
  const from = process.env.EMAIL_FROM ?? `${brandName} <onboarding@resend.dev>`

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
    deliveryAddress: payload.deliveryAddress,
    pendingPaymentNote: options?.pendingPaymentNote ?? null,
  })

  try {
    await resend.emails.send({
      from,
      to: [payload.customerEmail],
      subject: `¡Tu pedido ${payload.shortId} está en marcha!`,
      html: customerHtml,
    })
  } catch (e) {
    console.error('[email] Error enviando correo al cliente:', e)
    return { sent: false, reason: 'resend_customer_failed' }
  }

  const notifyAdmin = process.env.ORDERS_NOTIFY_EMAIL?.trim()
  if (notifyAdmin) {
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
      await resend.emails.send({
        from,
        to: [notifyAdmin],
        subject: `[${brandName}] Nuevo pedido ${payload.shortId} · ${formatPrice(payload.total)}`,
        html: adminHtml,
      })
    } catch (e) {
      console.error('[email] Error enviando correo interno:', e)
    }
  }

  return { sent: true }
}

type StatusEmailType = 'preparing' | 'delivered'

/**
 * Envía correo de actualización de estatus al cliente.
 * Solo para 'preparing' (pedido listo para envío) y 'delivered' (entregado).
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
    .select('short_id, customer_email, customer_name, delivery_address')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !data?.customer_email) return { sent: false, reason: 'order_not_found' }

  const brandName = process.env.NEXT_PUBLIC_APP_NAME ?? 'nurei'
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const orderUrl = safeAttrUrl(`${baseUrl}/pedido/${orderId}`)
  const from = process.env.EMAIL_FROM ?? `${brandName} <onboarding@resend.dev>`

  const resend = new Resend(apiKey)

  const props = {
    brandName,
    shortId: data.short_id,
    customerName: (data.customer_name ?? 'Cliente').trim() || 'Cliente',
    orderUrl,
    deliveryAddress: data.delivery_address ?? undefined,
  }

  const { subject, html } =
    status === 'preparing'
      ? {
          subject: `Tu pedido ${data.short_id} está siendo preparado 📦`,
          html: renderOrderPreparingHtml(props),
        }
      : {
          subject: `¡Tu pedido ${data.short_id} fue entregado! 🎉`,
          html: renderOrderDeliveredHtml(props),
        }

  try {
    await resend.emails.send({ from, to: [data.customer_email], subject, html })
    return { sent: true }
  } catch (e) {
    console.error(`[email] Error enviando correo de estatus (${status}):`, e)
    return { sent: false, reason: 'resend_failed' }
  }
}
