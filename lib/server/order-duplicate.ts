import type { SupabaseClient } from '@supabase/supabase-js'

const DUPLICATE_LOOKBACK_MS = 30 * 60 * 1000
const BLOCKING_DUPLICATE_MS = 10 * 60 * 1000
const IMMEDIATE_DUPLICATE_MS = 60 * 1000

type DuplicateCandidate = {
  id: string
  short_id: string
  created_at: string
  total: number
  items: unknown
  status: string
  payment_status: string
  user_id: string | null
  customer_email: string | null
  customer_phone: string
}

export type DuplicateOrderMatch = {
  id: string
  shortId: string
  createdAt: string
  ageSeconds: number
  severity: 'immediate' | 'recent' | 'warning'
  canOpen: boolean
}

export type DuplicateOrderInput = {
  userId?: string | null
  email?: string | null
  phone?: string | null
  items: Array<{ productId: string; quantity: number }>
  total: number
}

function normalizedEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null
}

function normalizedPhone(value: string | null | undefined) {
  return value?.replace(/\D/g, '') || null
}

function itemSignature(items: unknown) {
  if (!Array.isArray(items)) return ''

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const row = item as Record<string, unknown>
      const productId = typeof row.product_id === 'string' ? row.product_id : ''
      const quantity = typeof row.quantity === 'number' ? row.quantity : 0
      return `${productId}:${quantity}`
    })
    .filter(Boolean)
    .sort()
    .join('|')
}

/**
 * Finds an active order from the same customer with the exact same basket and
 * total in the last 30 minutes. The caller must require explicit confirmation
 * before inserting when this returns a match.
 */
export async function findRecentDuplicateOrder(
  supabase: SupabaseClient,
  input: DuplicateOrderInput,
): Promise<DuplicateOrderMatch | null> {
  const since = new Date(Date.now() - DUPLICATE_LOOKBACK_MS).toISOString()
  const email = normalizedEmail(input.email)
  const phone = normalizedPhone(input.phone)
  const queries: Array<PromiseLike<{ data: DuplicateCandidate[] | null }>> = []

  if (input.userId) {
    queries.push(
      supabase
        .from('orders')
        .select('id, short_id, created_at, total, items, status, payment_status, user_id, customer_email, customer_phone')
        .eq('user_id', input.userId)
        .gte('created_at', since),
    )
  }
  if (email) {
    queries.push(
      supabase
        .from('orders')
        .select('id, short_id, created_at, total, items, status, payment_status, user_id, customer_email, customer_phone')
        .ilike('customer_email', email)
        .gte('created_at', since),
    )
  }
  if (phone) {
    queries.push(
      supabase
        .from('orders')
        .select('id, short_id, created_at, total, items, status, payment_status, user_id, customer_email, customer_phone')
        .gte('created_at', since),
    )
  }

  const results = await Promise.all(queries)
  const expectedItems = itemSignature(
    input.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
  )
  const unique = new Map<string, DuplicateCandidate>()

  for (const result of results) {
    for (const order of result.data ?? []) {
      // Phone formats vary in stored historic orders, so normalize it after a
      // small time-bounded query instead of relying on a fragile exact filter.
      unique.set(order.id, order)
    }
  }

  const now = Date.now()
  const candidate = [...unique.values()]
    .filter((order) => {
      const age = now - new Date(order.created_at).getTime()
      return (
        age >= 0
        && age <= DUPLICATE_LOOKBACK_MS
        && !['cancelled', 'failed'].includes(order.status)
        && order.payment_status !== 'failed'
        && (
          (Boolean(input.userId) && order.user_id === input.userId)
          || (Boolean(email) && normalizedEmail(order.customer_email) === email)
          || (Boolean(phone) && normalizedPhone(order.customer_phone) === phone)
        )
        && order.total === input.total
        && itemSignature(order.items) === expectedItems
      )
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  if (!candidate) return null

  const ageSeconds = Math.max(0, Math.floor((now - new Date(candidate.created_at).getTime()) / 1000))
  return {
    id: candidate.id,
    shortId: candidate.short_id,
    createdAt: candidate.created_at,
    ageSeconds,
    severity:
      ageSeconds * 1000 <= IMMEDIATE_DUPLICATE_MS
        ? 'immediate'
        : ageSeconds * 1000 <= BLOCKING_DUPLICATE_MS
          ? 'recent'
          : 'warning',
    canOpen: Boolean(input.userId && candidate.user_id === input.userId),
  }
}
