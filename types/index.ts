// ============================================
// DATABASE TYPES
// ============================================

export type ProductCategory = string

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'failed'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export type CouponType = 'percentage' | 'fixed'

export type NotificationType = 'order_confirmed' | 'order_shipped' | 'order_delivered' | 'payment_failed' | 'coupon_received' | 'general'

export type ProductStatus = 'draft' | 'active' | 'archived'

export type UnitOfMeasure = 'ml' | 'g' | 'kg' | 'L' | 'oz' | 'units' | 'box' | 'pack'

export type UserRole = 'customer' | 'admin'

export type PermissionLevel = 'total' | 'escritura' | 'lectura' | 'sin_acceso'

export type AdminModule =
  | 'dashboard' | 'pedidos' | 'productos' | 'categorias'
  | 'inventario' | 'cupones' | 'multimedia' | 'clientes'
  | 'usuarios' | 'roles' | 'configuracion' | 'analytics' | 'pagos'

export type InventoryMovementType = 'entrada' | 'salida' | 'ajuste' | 'venta' | 'devolucion'

export interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  category: ProductCategory
  subcategory: string | null
  sku: string
  brand: string | null
  origin: string
  origin_country: string | null
  unit_of_measure: UnitOfMeasure
  spice_level: number
  weight_g: number
  base_price: number // centavos MXN
  price: number // centavos MXN (kept for compat)
  compare_at_price: number | null
  cost_estimate: number | null
  availability_score: number
  is_active: boolean
  is_featured: boolean
  is_limited: boolean
  has_variants: boolean
  requires_spice_level: boolean
  status: ProductStatus
  campaign: string | null
  image_url: string | null
  image_thumbnail_url: string | null
  images: string[]
  primary_image_index: number
  tags: string[]
  dimensions_cm: { length?: number; width?: number; height?: number } | null
  stock_quantity: number
  low_stock_threshold: number
  track_inventory: boolean
  allow_backorder: boolean
  views_count: number
  purchases_count: number
  meta_title: string | null
  meta_description: string | null
  created_at: string
  updated_at: string
  // Joined
  variants?: ProductVariant[]
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  sku_suffix: string | null
  price: number
  compare_at_price: number | null
  stock: number
  attributes: Record<string, string>
  image: string | null
  status: 'active' | 'inactive'
  sort_order: number
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
  admin_role_id: string | null
  admin_role?: AdminRole | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface AdminRole {
  id: string
  name: string
  description: string | null
  color: string
  permissions: Record<AdminModule, PermissionLevel>
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InventoryMovement {
  id: string
  product_id: string
  product?: Product
  type: InventoryMovementType
  quantity: number
  reason: string | null
  reference: string | null
  created_by: string | null
  created_at: string
}

export interface PaymentMethod {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  is_active: boolean
  config: Record<string, unknown>
  sort_order: number
  created_at: string
  updated_at: string
}

export interface StoreSettings {
  store_info: {
    name: string
    phone: string
    whatsapp: string
    email: string
    address: string
    description: string
  }
  shipping: {
    fee_cents: number
    free_shipping_min_cents: number
    estimated_time: string
    enabled: boolean
    zones: string[]
  }
  checkout: {
    require_account: boolean
    guest_checkout: boolean
    min_order_cents: number
    max_items_per_order: number
  }
  notifications: {
    email_admin: string
    email_on_new_order: boolean
    email_on_payment: boolean
    whatsapp_customer: boolean
    sound_alerts: boolean
  }
  appearance: {
    primary_color: string
    logo_url: string | null
    favicon_url: string | null
    social_links: { instagram: string; facebook: string; tiktok: string }
  }
  seo: {
    meta_title: string
    meta_description: string
    og_image: string | null
  }
  legal: {
    terms_url: string
    privacy_url: string
    return_policy: string
    tax_rate: number
  }
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
