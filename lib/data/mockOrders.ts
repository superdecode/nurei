import type { Order, OrderUpdate, UserCoupon } from '@/types'

export const MOCK_USER_ORDERS: Order[] = [
  {
    id: 'ord-001', short_id: 'NUR-001', user_id: null,
    customer_name: 'Usuario Demo', customer_phone: '5512345678', customer_email: 'demo@nurei.mx',
    delivery_address: 'Av. Insurgentes Sur 1234, Col. Del Valle, CDMX, CP 03100',
    delivery_instructions: 'Dejar en recepción',
    items: [
      { product_id: 'MZ-001', name: 'Aloe Vera Pera 500ml', quantity: 2, unit_price: 6500, subtotal: 13000 },
      { product_id: 'MZ-002', name: 'Pepero Chocolate Original', quantity: 1, unit_price: 4500, subtotal: 4500 },
    ],
    subtotal: 17500, shipping_fee: 9900, coupon_code: 'BIENVENIDO10', coupon_discount: 1750,
    discount: 0, total: 25650, status: 'delivered', payment_status: 'paid',
    confirmed_at: '2026-04-10T14:30:00Z', shipped_at: '2026-04-11T09:15:00Z',
    delivered_at: '2026-04-13T16:45:00Z', cancelled_at: null,
    stripe_payment_intent_id: 'pi_mock_001', stripe_checkout_session_id: null,
    paid_at: '2026-04-10T13:55:00Z', cancellation_reason: null, failure_reason: null,
    operator_notes: null, source: 'web',
    created_at: '2026-04-10T13:50:00Z', updated_at: '2026-04-13T16:45:00Z',
  },
  {
    id: 'ord-002', short_id: 'NUR-007', user_id: null,
    customer_name: 'Usuario Demo', customer_phone: '5512345678', customer_email: 'demo@nurei.mx',
    delivery_address: 'Av. Insurgentes Sur 1234, Col. Del Valle, CDMX, CP 03100',
    delivery_instructions: null,
    items: [
      { product_id: 'MZ-003', name: 'Choco Pie Strawberry', quantity: 3, unit_price: 3500, subtotal: 10500 },
      { product_id: 'MZ-004', name: 'Takis Fuego 280g', quantity: 1, unit_price: 7900, subtotal: 7900 },
      { product_id: 'MZ-005', name: 'Pocky Matcha 72g', quantity: 2, unit_price: 4200, subtotal: 8400 },
    ],
    subtotal: 26800, shipping_fee: 0, coupon_code: null, coupon_discount: 0,
    discount: 0, total: 26800, status: 'shipped', payment_status: 'paid',
    confirmed_at: '2026-04-12T10:00:00Z', shipped_at: '2026-04-13T08:30:00Z',
    delivered_at: null, cancelled_at: null,
    stripe_payment_intent_id: 'pi_mock_002', stripe_checkout_session_id: null,
    paid_at: '2026-04-12T09:45:00Z', cancellation_reason: null, failure_reason: null,
    operator_notes: 'Paquete enviado por Estafeta, guía 7823459012', source: 'web',
    created_at: '2026-04-12T09:40:00Z', updated_at: '2026-04-13T08:30:00Z',
  },
  {
    id: 'ord-003', short_id: 'NUR-012', user_id: null,
    customer_name: 'Usuario Demo', customer_phone: '5512345678', customer_email: 'demo@nurei.mx',
    delivery_address: 'Calle Durango 180, Col. Roma Norte, CDMX, CP 06700',
    delivery_instructions: 'Piso 3, depto 302',
    items: [
      { product_id: 'MZ-006', name: 'Ramune Strawberry 200ml', quantity: 4, unit_price: 5500, subtotal: 22000 },
    ],
    subtotal: 22000, shipping_fee: 9900, coupon_code: null, coupon_discount: 0,
    discount: 0, total: 31900, status: 'confirmed', payment_status: 'paid',
    confirmed_at: '2026-04-14T08:20:00Z', shipped_at: null,
    delivered_at: null, cancelled_at: null,
    stripe_payment_intent_id: 'pi_mock_003', stripe_checkout_session_id: null,
    paid_at: '2026-04-14T08:15:00Z', cancellation_reason: null, failure_reason: null,
    operator_notes: null, source: 'web',
    created_at: '2026-04-14T08:10:00Z', updated_at: '2026-04-14T08:20:00Z',
  },
  {
    id: 'ord-004', short_id: 'NUR-004', user_id: null,
    customer_name: 'Usuario Demo', customer_phone: '5512345678', customer_email: 'demo@nurei.mx',
    delivery_address: 'Av. Insurgentes Sur 1234, Col. Del Valle, CDMX, CP 03100',
    delivery_instructions: null,
    items: [
      { product_id: 'MZ-007', name: 'Indomie Mi Goreng Original', quantity: 5, unit_price: 2900, subtotal: 14500 },
    ],
    subtotal: 14500, shipping_fee: 9900, coupon_code: null, coupon_discount: 0,
    discount: 0, total: 24400, status: 'cancelled', payment_status: 'refunded',
    confirmed_at: null, shipped_at: null,
    delivered_at: null, cancelled_at: '2026-04-05T14:00:00Z',
    stripe_payment_intent_id: null, stripe_checkout_session_id: null,
    paid_at: '2026-04-05T10:00:00Z', cancellation_reason: 'Producto sin stock al confirmar', failure_reason: null,
    operator_notes: null, source: 'web',
    created_at: '2026-04-05T09:55:00Z', updated_at: '2026-04-05T14:00:00Z',
  },
]

export const MOCK_ORDER_UPDATES: Record<string, OrderUpdate[]> = {
  'ord-001': [
    { id: 'u1', order_id: 'ord-001', status: 'pending', message: 'Pedido recibido, procesando pago.', updated_by: 'system', metadata: null, created_at: '2026-04-10T13:50:00Z' },
    { id: 'u2', order_id: 'ord-001', status: 'confirmed', message: 'Pago confirmado. Tu pedido está siendo preparado.', updated_by: 'sistema', metadata: null, created_at: '2026-04-10T14:30:00Z' },
    { id: 'u3', order_id: 'ord-001', status: 'shipped', message: 'Tu pedido fue enviado con DHL. Guía: 1234567890.', updated_by: 'operador', metadata: null, created_at: '2026-04-11T09:15:00Z' },
    { id: 'u4', order_id: 'ord-001', status: 'delivered', message: '¡Pedido entregado! Gracias por tu compra en nurei.', updated_by: 'sistema', metadata: null, created_at: '2026-04-13T16:45:00Z' },
  ],
  'ord-002': [
    { id: 'u5', order_id: 'ord-002', status: 'pending', message: 'Pedido recibido, procesando pago.', updated_by: 'system', metadata: null, created_at: '2026-04-12T09:40:00Z' },
    { id: 'u6', order_id: 'ord-002', status: 'confirmed', message: 'Pago confirmado. Tu pedido está siendo preparado.', updated_by: 'sistema', metadata: null, created_at: '2026-04-12T10:00:00Z' },
    { id: 'u7', order_id: 'ord-002', status: 'shipped', message: 'Enviado por Estafeta. Guía: 7823459012. Entrega estimada: 2-3 días hábiles.', updated_by: 'operador', metadata: null, created_at: '2026-04-13T08:30:00Z' },
  ],
  'ord-003': [
    { id: 'u8', order_id: 'ord-003', status: 'pending', message: 'Pedido recibido, procesando pago.', updated_by: 'system', metadata: null, created_at: '2026-04-14T08:10:00Z' },
    { id: 'u9', order_id: 'ord-003', status: 'confirmed', message: 'Pago confirmado. Tu pedido está siendo preparado, lo enviaremos pronto.', updated_by: 'sistema', metadata: null, created_at: '2026-04-14T08:20:00Z' },
  ],
  'ord-004': [
    { id: 'u10', order_id: 'ord-004', status: 'pending', message: 'Pedido recibido, procesando pago.', updated_by: 'system', metadata: null, created_at: '2026-04-05T09:55:00Z' },
    { id: 'u11', order_id: 'ord-004', status: 'cancelled', message: 'Lo sentimos, el producto no está disponible. Tu reembolso se procesará en 3-5 días hábiles.', updated_by: 'operador', metadata: null, created_at: '2026-04-05T14:00:00Z' },
  ],
}

export const MOCK_USER_COUPONS: UserCoupon[] = [
  {
    id: 'uc-1',
    coupon: {
      id: 'c1', code: 'BIENVENIDO10', type: 'percentage', value: 10,
      min_order_amount: 20000, max_uses: 100, used_count: 24,
      expires_at: '2026-06-01T00:00:00Z', is_active: true,
      description: '10% en tu primer pedido',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    },
    received_at: '2026-04-10T13:00:00Z',
    used_at: '2026-04-10T13:50:00Z',
    order_id: 'ord-001',
  },
  {
    id: 'uc-2',
    coupon: {
      id: 'c2', code: 'VERANO15', type: 'percentage', value: 15,
      min_order_amount: 30000, max_uses: 50, used_count: 5,
      expires_at: '2026-07-31T00:00:00Z', is_active: true,
      description: '15% descuento de verano',
      created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z',
    },
    received_at: '2026-04-13T16:45:00Z',
    used_at: null,
    order_id: null,
  },
  {
    id: 'uc-3',
    coupon: {
      id: 'c3', code: 'FLETE99', type: 'fixed', value: 9900,
      min_order_amount: 25000, max_uses: null, used_count: 1,
      expires_at: '2026-05-15T00:00:00Z', is_active: true,
      description: 'Envío gratis en tu próxima compra',
      created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z',
    },
    received_at: '2026-04-13T16:45:00Z',
    used_at: null,
    order_id: null,
  },
]
