// lib/server/meta-capi.ts
import { createHash } from 'crypto'

const GRAPH_API_VERSION = 'v25.0'

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '')
  return digits.length === 10 ? `52${digits}` : digits
}

export function hashEmail(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex')
}

export function hashPhone(phone: string): string {
  return createHash('sha256').update(normalizePhone(phone)).digest('hex')
}

export interface MetaCapiUserData {
  email?: string | null
  phone?: string | null
  clientIpAddress?: string | null
  clientUserAgent?: string | null
  fbp?: string | null
  fbc?: string | null
}

export interface MetaCapiPurchaseInput {
  orderId: string
  eventId: string
  eventSourceUrl: string
  valuePesos: number
  currency: string
  contentIds: string[]
  userData: MetaCapiUserData
}

export async function sendMetaPurchaseEvent(
  input: MetaCapiPurchaseInput
): Promise<{ ok: boolean; error?: string }> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN?.trim()
  if (!pixelId || !accessToken) return { ok: true }

  const { orderId, eventId, eventSourceUrl, valuePesos, currency, contentIds, userData } = input

  try {
    const user_data: Record<string, unknown> = {}
    if (userData.email) user_data.em = [hashEmail(userData.email)]
    if (userData.phone) user_data.ph = [hashPhone(userData.phone)]
    if (userData.clientIpAddress) user_data.client_ip_address = userData.clientIpAddress
    if (userData.clientUserAgent) user_data.client_user_agent = userData.clientUserAgent
    if (userData.fbp) user_data.fbp = userData.fbp
    if (userData.fbc) user_data.fbc = userData.fbc

    const body = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          event_source_url: eventSourceUrl,
          action_source: 'website',
          user_data,
          custom_data: {
            currency,
            value: valuePesos,
            content_ids: contentIds,
            order_id: orderId,
          },
        },
      ],
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      return { ok: false, error: `Meta CAPI ${response.status}: ${await response.text()}` }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Meta CAPI request failed' }
  }
}
