type StoredOrder = {
  id: string
  shortId: string
  createdAt: string
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

export function saveCheckoutOrder(order: StoredOrder) {
  orderStore.set(order.id, order)
}

export function getCheckoutOrder(id: string) {
  return orderStore.get(id)
}
