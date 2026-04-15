// ============================================
// DATABASE TYPES
// ============================================

export type ProductCategory = 'crunchy' | 'spicy' | 'limited_edition' | 'drinks'

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'failed'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export type CouponType = 'percentage' | 'fixed'

export type NotificationType = 'order_confirmed' | 'order_shipped' | 'order_delivered' | 'payment_failed' | 'coupon_received' | 'general'

export type UserRole = 'customer' | 'admin'

export interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  category: ProductCategory
  subcategory: string | null
  sku: string
  origin: string
  spice_level: number // 0-5 scale
  weight_g: number
  price: number // centavos MXN
  compare_at_price: number | null
  cost_estimate: number | null
  availability_score: number
  is_active: boolean
  is_featured: boolean
  is_limited: boolean
  image_url: string | null
  image_thumbnail_url: string | null
  views_count: number
  purchases_count: number
  meta_title: string | null
  meta_description: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  emoji: string | null
  color: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface OrderItem {
  product_id: string
  name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface Order {
  id: string
  short_id: string
  user_id: string | null
  customer_name: string | null
  customer_phone: string
  customer_email: string | null
  delivery_address: string
  delivery_instructions: string | null
  items: OrderItem[]
  subtotal: number
  shipping_fee: number
  coupon_code: string | null
  coupon_discount: number
  discount: number
  total: number
  status: OrderStatus
  confirmed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  payment_status: PaymentStatus
  paid_at: string | null
  cancellation_reason: string | null
  failure_reason: string | null
  operator_notes: string | null
  source: string
  created_at: string
  updated_at: string
}

export interface OrderUpdate {
  id: string
  order_id: string
  status: OrderStatus
  message: string | null
  updated_by: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Coupon {
  id: string
  code: string
  type: CouponType
  value: number // percentage (0-100) or fixed amount in centavos
  min_order_amount: number
  max_uses: number | null
  used_count: number
  expires_at: string | null
  is_active: boolean
  description: string | null
  created_at: string
  updated_at: string
}

export interface Favorite {
  id: string
  user_id: string
  product_id: string
  created_at: string
}

export interface UserProfile {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Address {
  id: string
  label: string // 'Casa', 'Trabajo', etc.
  recipient_name: string
  street: string
  exterior_number: string
  interior_number: string | null
  colonia: string
  city: string
  state: string
  zip_code: string
  phone: string
  instructions: string | null
  is_default: boolean
  created_at: string
}

export interface UserCoupon {
  id: string
  coupon: Coupon
  received_at: string
  used_at: string | null
  order_id: string | null
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  read_at: string | null
  data: Record<string, unknown> | null
  created_at: string
}

export interface MediaItem {
  id: string
  filename: string
  url: string
  thumbnail_url: string | null
  size_bytes: number
  mime_type: string
  alt_text: string | null
  uploaded_by: string | null
  created_at: string
}

export interface ProductMedia {
  product_id: string
  media_id: string
  sort_order: number
  is_primary: boolean
}

export interface AppConfig {
  key: string
  value: unknown
  description: string | null
  updated_at: string
}

// ============================================
// API TYPES
// ============================================

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface CreateOrderRequest {
  customer_phone: string
  customer_email?: string
  customer_name?: string
  delivery_address: string
  delivery_instructions?: string
  coupon_code?: string
  items: Array<{
    product_id: string
    quantity: number
  }>
}

export interface CreateCheckoutRequest {
  order_id: string
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus
  notes?: string
}

export interface ValidateCouponRequest {
  code: string
  subtotal: number
}

export interface ValidateCouponResponse {
  valid: boolean
  discount_amount?: number
  coupon?: Coupon
  error?: string
}

// ============================================
// CART TYPES
// ============================================

export interface CartItem {
  product: Product
  quantity: number
}

export interface CartState {
  items: CartItem[]
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getSubtotal: () => number
  getTotal: (shippingFee: number, discount?: number) => number
  getItemCount: () => number
}
