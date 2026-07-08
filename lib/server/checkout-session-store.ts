import crypto from 'crypto'

type StoredOrder = {
  id: string
  shortId: string
  createdAt: string
  publicAccessToken: string
  customerName: string
  customerEmail: string | null
  customerPhone: string
  shippingAddress: {
    fullName: string
    email: string
    phone: string
    address: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  shippingMethod: {
    id: string
    label: string
    price: number
    etaLabel: string
    estimatedDate: string
  }
  paymentMethod: string
  items: Array<{
    productId: string
    name: string
    quantity: number
    unitPrice: number
    subtotal: number
  }>
  couponCode: string | null
  couponDiscount: number
  subtotal: number
  total: number
}

const orderStore = new Map<string, StoredOrder>()
const MAX_AGE_MS = 60 * 60 * 1000 // 1 hour — this is only a short-lived grace cache for the confirmation page

function isExpired(order: StoredOrder): boolean {
  return Date.now() - new Date(order.createdAt).getTime() > MAX_AGE_MS
}

function pruneExpired() {
  for (const [id, order] of orderStore) {
    if (isExpired(order)) orderStore.delete(id)
  }
}

function safeEqualToken(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false
  const leftBuf = Buffer.from(left)
  const rightBuf = Buffer.from(right)
  if (leftBuf.length !== rightBuf.length) return false
  return crypto.timingSafeEqual(leftBuf, rightBuf)
}

export function saveCheckoutOrder(order: StoredOrder) {
  pruneExpired()
  orderStore.set(order.id, order)
}

export function getCheckoutOrder(id: string, publicToken?: string | null) {
  const order = orderStore.get(id)
  if (!order) return undefined
  if (isExpired(order)) {
    orderStore.delete(id)
    return undefined
  }
  if (!safeEqualToken(order.publicAccessToken, publicToken)) return undefined
  return order
}
