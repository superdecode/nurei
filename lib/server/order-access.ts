import crypto from 'crypto'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import type { Order } from '@/types'

export function createPublicOrderAccessToken() {
  return crypto.randomBytes(32).toString('hex')
}

function safeEqualToken(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false
  const leftBuf = Buffer.from(left)
  const rightBuf = Buffer.from(right)
  if (leftBuf.length !== rightBuf.length) return false
  return crypto.timingSafeEqual(leftBuf, rightBuf)
}

export async function getAccessibleOrder(orderId: string, publicToken?: string | null): Promise<Order | null> {
  const service = createServiceClient()
  const { data: order, error } = await service
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !order) return null

  if (safeEqualToken(order.public_access_token as string | undefined, publicToken)) {
    return order as Order
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user && order.user_id === user.id) {
    return order as Order
  }

  // Guest checkout under the same (unverified) email — only while still unpaid.
  if (
    user?.email &&
    !order.user_id &&
    order.payment_status === 'pending' &&
    order.customer_email &&
    order.customer_email.toLowerCase() === user.email.toLowerCase()
  ) {
    return order as Order
  }

  return null
}
