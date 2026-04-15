'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  closestCorners,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  Package, Phone, Clock, MapPin, ChevronDown,
  Search, Calendar, Filter, LayoutGrid, List, MoreVertical,
  MessageSquare, AlertTriangle, Truck, CheckCircle2, XCircle,
  ExternalLink, Timer, Hash, ShoppingCart, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { formatPrice, formatRelativeTime, formatPhone } from '@/lib/utils/format'
import { ORDER_STATUS_MAP, VALID_STATUS_TRANSITIONS } from '@/lib/utils/constants'
import type { Order, OrderStatus, OrderItem } from '@/types'
import { cn } from '@/lib/utils'

// ============================================
// KANBAN COLUMN DEFINITIONS
// ============================================

type KanbanColumnId = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'problem'

interface KanbanColumn {
  id: KanbanColumnId
  label: string
  statuses: OrderStatus[]
  color: string
  bgColor: string
  borderColor: string
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'pending',
    label: 'Pendientes',
    statuses: ['pending'],
    color: 'text-primary-cyan',
    bgColor: 'bg-primary-cyan/10',
    borderColor: 'border-primary-cyan/30',
  },
  {
    id: 'confirmed',
    label: 'Confirmados',
    statuses: ['confirmed'],
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    id: 'shipped',
    label: 'Enviados',
    statuses: ['shipped'],
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  {
    id: 'delivered',
    label: 'Entregados',
    statuses: ['delivered'],
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
  },
  {
    id: 'problem',
    label: 'Problemas',
    statuses: ['cancelled', 'failed'],
    color: 'text-error',
    bgColor: 'bg-error/10',
    borderColor: 'border-error/30',
  },
]

// ============================================
// MOCK DATA
// ============================================

const now = new Date()
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000).toISOString()

const makeOrder = (overrides: Partial<Order> & Pick<Order, 'id' | 'short_id' | 'status' | 'items' | 'subtotal' | 'total'>): Order => ({
  user_id: null,
  customer_name: null,
  customer_phone: '5500000000',
  customer_email: null,
  delivery_address: '',
  delivery_instructions: null,
  shipping_fee: 9900,
  coupon_code: null,
  coupon_discount: 0,
  discount: 0,
  confirmed_at: null,
  shipped_at: null,
  delivered_at: null,
  cancelled_at: null,
  stripe_payment_intent_id: null,
  stripe_checkout_session_id: null,
  payment_status: 'paid',
  paid_at: minutesAgo(3),
  cancellation_reason: null,
  failure_reason: null,
  operator_notes: null,
  source: 'web',
  created_at: minutesAgo(3),
  updated_at: minutesAgo(3),
  ...overrides,
})

const MOCK_ORDERS: Order[] = [
  makeOrder({
    id: 'ord-001',
    short_id: 'NR-4821',
    customer_name: 'Carlos Mendez',
    customer_phone: '5512345678',
    customer_email: 'carlos@email.com',
    delivery_address: 'Calle Durango 210, Roma Norte',
    delivery_instructions: 'Edificio azul, 3er piso',
    items: [
      { product_id: 'MZ-001', name: 'Aloe Vera Pera 500ml', quantity: 2, unit_price: 4500, subtotal: 9000 },
      { product_id: 'MZ-004', name: 'Samyang Buldak Carbonara', quantity: 1, unit_price: 8500, subtotal: 8500 },
    ],
    subtotal: 17500,
    shipping_fee: 9900,
    total: 27400,
    status: 'pending',
  }),
  makeOrder({
    id: 'ord-002',
    short_id: 'NR-4822',
    customer_name: 'Maria Lopez',
    customer_phone: '5587654321',
    delivery_address: 'Av. Amsterdam 45, Condesa',
    items: [
      { product_id: 'MZ-007', name: 'Honey Butter Chips 60g', quantity: 3, unit_price: 9500, subtotal: 28500 },
    ],
    subtotal: 28500,
    shipping_fee: 9900,
    discount: 5000,
    total: 33400,
    status: 'confirmed',
    confirmed_at: minutesAgo(8),
    operator_notes: 'Cliente frecuente',
    created_at: minutesAgo(12),
    updated_at: minutesAgo(8),
  }),
  makeOrder({
    id: 'ord-003',
    short_id: 'NR-4823',
    customer_name: 'Roberto Diaz',
    customer_phone: '5543219876',
    customer_email: 'roberto@email.com',
    delivery_address: 'Calle Orizaba 78, Roma Sur',
    delivery_instructions: 'Dejar con el portero',
    items: [
      { product_id: 'MZ-002', name: 'Ramune Original 200ml', quantity: 2, unit_price: 6500, subtotal: 13000 },
      { product_id: 'MZ-005', name: 'Pocky Chocolate 40g', quantity: 4, unit_price: 4000, subtotal: 16000 },
      { product_id: 'MZ-009', name: 'Shin Ramyun Stir Fry 131g', quantity: 2, unit_price: 7500, subtotal: 15000 },
    ],
    subtotal: 44000,
    shipping_fee: 9900,
    total: 53900,
    status: 'shipped',
    confirmed_at: minutesAgo(20),
    shipped_at: minutesAgo(10),
    source: 'whatsapp',
    created_at: minutesAgo(25),
    updated_at: minutesAgo(10),
  }),
  makeOrder({
    id: 'ord-004',
    short_id: 'NR-4824',
    customer_name: 'Ana Garcia',
    customer_phone: '5598765432',
    customer_email: 'ana.garcia@mail.com',
    delivery_address: 'Calle Nuevo Leon 152, Condesa',
    delivery_instructions: 'Casa con puerta verde',
    items: [
      { product_id: 'MZ-008', name: 'Mogu Mogu Lychee 320ml', quantity: 6, unit_price: 4200, subtotal: 25200 },
    ],
    subtotal: 25200,
    shipping_fee: 9900,
    total: 35100,
    status: 'delivered',
    confirmed_at: minutesAgo(120),
    shipped_at: minutesAgo(60),
    delivered_at: minutesAgo(5),
    created_at: minutesAgo(130),
    updated_at: minutesAgo(5),
  }),
  makeOrder({
    id: 'ord-005',
    short_id: 'NR-4825',
    customer_name: 'Luis Torres',
    customer_phone: '5567891234',
    delivery_address: 'Av. Sonora 180, Roma Norte',
    items: [
      { product_id: 'MZ-010', name: 'Calbee Shrimp Chips 75g', quantity: 2, unit_price: 6000, subtotal: 12000 },
    ],
    subtotal: 12000,
    shipping_fee: 9900,
    discount: 0,
    total: 21900,
    status: 'cancelled',
    confirmed_at: minutesAgo(60),
    cancelled_at: minutesAgo(45),
    stripe_payment_intent_id: 'pi_test_005',
    stripe_checkout_session_id: 'cs_test_005',
    payment_status: 'refunded',
    cancellation_reason: 'Cliente solicitó cancelación',
    operator_notes: 'Reembolso procesado',
    created_at: minutesAgo(65),
    updated_at: minutesAgo(45),
  }),
]

// ============================================
// HELPER FUNCTIONS
// ============================================

function getColumnForStatus(status: OrderStatus): KanbanColumnId {
  const col = KANBAN_COLUMNS.find((c) => c.statuses.includes(status))
  return col ? col.id : 'problem'
}

function getStatusForColumn(columnId: KanbanColumnId): OrderStatus {
  const col = KANBAN_COLUMNS.find((c) => c.id === columnId)
  return col ? col.statuses[0] : 'pending'
}

function getOrderUrgency(order: Order): 'urgent' | 'delayed' | 'normal' {
  if (order.status === 'cancelled' || order.status === 'failed') return 'normal'
  if (order.status === 'delivered') return 'normal'
  const createdMs = new Date(order.created_at).getTime()
  const diffMin = (Date.now() - createdMs) / 60000
  if (order.status === 'pending' && diffMin > 5) return 'urgent'
  if (diffMin > 60) return 'delayed'
  return 'normal'
}

function truncatePhone(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.length >= 6) return `${clean.slice(0, 2)}...${clean.slice(-4)}`
  return phone
}

function isNewOrder(order: Order): boolean {
  const createdMs = new Date(order.created_at).getTime()
  return Date.now() - createdMs < 2 * 60000
}

// ============================================
// DRAGGABLE ORDER CARD
// ============================================

interface OrderCardProps {
  order: Order
  onClick: (order: Order) => void
  isDragOverlay?: boolean
}

function DraggableOrderCard({ order, onClick }: OrderCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { order },
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(isDragging && 'opacity-30')}
    >
      <OrderCard order={order} onClick={onClick} />
    </div>
  )
}

function OrderCard({ order, onClick, isDragOverlay }: OrderCardProps) {
  const urgency = getOrderUrgency(order)
  const isNew = isNewOrder(order)
  const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

  const borderClass = {
    urgent: 'border-error/60 shadow-error/10',
    delayed: 'border-warning/60 shadow-warning/10',
    normal: 'border-gray-200',
  }[urgency]

  return (
    <motion.div
      layout={!isDragOverlay}
      initial={isDragOverlay ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick(order)}
      className={cn(
        'group relative cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition-shadow hover:shadow-md',
        borderClass,
        isDragOverlay && 'shadow-xl ring-2 ring-primary-cyan/30 rotate-2',
        isNew && 'ring-2 ring-primary-cyan/40'
      )}
    >
      {/* Pulse on new orders */}
      {isNew && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-cyan opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-primary-cyan" />
        </span>
      )}

      {/* Urgent indicator bar */}
      {urgency === 'urgent' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-error" />
      )}
      {urgency === 'delayed' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-warning" />
      )}

      {/* Header: ID + Time */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold font-mono text-primary-dark">
          {order.short_id}
        </span>
        <span className="text-[11px] text-gray-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatRelativeTime(order.created_at)}
        </span>
      </div>

      {/* Customer phone */}
      <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-500">
        <Phone className="w-3 h-3 shrink-0" />
        <span>{truncatePhone(order.customer_phone)}</span>
        {order.customer_name && (
          <>
            <span className="text-gray-300">|</span>
            <span className="truncate">{order.customer_name.split(' ')[0]}</span>
          </>
        )}
      </div>

      {/* Total + Items */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-primary-dark">
          {formatPrice(order.total)}
        </span>
        <span className="text-[11px] text-gray-400 flex items-center gap-1">
          <ShoppingCart className="w-3 h-3" />
          {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Source badge */}
      {order.source !== 'web' && (
        <span className="text-[11px] text-gray-400 italic capitalize">{order.source}</span>
      )}
    </motion.div>
  )
}

// ============================================
// DROPPABLE COLUMN
// ============================================

interface DroppableColumnProps {
  column: KanbanColumn
  orders: Order[]
  onCardClick: (order: Order) => void
  index: number
}

function DroppableColumn({ column, orders, onCardClick, index }: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
    data: { column },
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="flex flex-col min-w-[280px] w-[280px] lg:w-full lg:min-w-0 shrink-0"
    >
      {/* Column header */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2.5 rounded-xl mb-3',
        column.bgColor,
      )}>
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', column.color.replace('text-', 'bg-'))} />
          <h3 className={cn('text-sm font-semibold', column.color)}>{column.label}</h3>
        </div>
        <span className={cn(
          'text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center',
          column.color,
          column.bgColor,
        )}>
          {orders.length}
        </span>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2.5 rounded-xl p-2 min-h-[200px] transition-colors duration-200',
          isOver
            ? `bg-primary-cyan/5 ring-2 ring-primary-cyan/20 ring-dashed`
            : 'bg-gray-50/50',
        )}
      >
        <AnimatePresence mode="popLayout">
          {orders.map((order) => (
            <DraggableOrderCard
              key={order.id}
              order={order}
              onClick={onCardClick}
            />
          ))}
        </AnimatePresence>

        {orders.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-gray-300">
            Sin pedidos
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ============================================
// TABLE ROW VIEW
// ============================================

interface TableViewProps {
  orders: Order[]
  onCardClick: (order: Order) => void
}

function TableView({ orders, onCardClick }: TableViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl border shadow-sm overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Items</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Total</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((order) => {
              const statusInfo = ORDER_STATUS_MAP[order.status]
              const urgency = getOrderUrgency(order)
              const itemsCount = order.items.reduce((s, i) => s + i.quantity, 0)

              return (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => onCardClick(order)}
                  className={cn(
                    'cursor-pointer hover:bg-gray-50 transition-colors',
                    urgency === 'urgent' && 'bg-error/5',
                    urgency === 'delayed' && 'bg-warning/5',
                  )}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-primary-dark">{order.short_id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-gray-700 truncate max-w-[140px]">{order.customer_name || 'Sin nombre'}</span>
                      <span className="text-xs text-gray-400">{truncatePhone(order.customer_phone)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className={cn('text-[10px]', statusInfo.bgColor, statusInfo.color)}
                    >
                      {statusInfo.icon} {statusInfo.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{itemsCount}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary-dark">
                    {formatPrice(order.total)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {formatRelativeTime(order.created_at)}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {orders.length === 0 && (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
          No se encontraron pedidos
        </div>
      )}
    </motion.div>
  )
}

// ============================================
// ORDER DETAIL MODAL
// ============================================

interface OrderDetailModalProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void
  onNoteSave: (orderId: string, note: string) => void
}

function OrderDetailModal({
  order,
  open,
  onOpenChange,
  onStatusChange,
  onNoteSave,
}: OrderDetailModalProps) {
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    if (order) {
      setNoteText(order.operator_notes || '')
    }
  }, [order])

  if (!order) return null

  const statusInfo = ORDER_STATUS_MAP[order.status]
  const validTransitions = VALID_STATUS_TRANSITIONS[order.status] || []
  const itemsCount = order.items.reduce((s, i) => s + i.quantity, 0)
  const whatsappUrl = `https://wa.me/52${order.customer_phone.replace(/\D/g, '')}`

  // Build timeline
  const timeline: Array<{ label: string; time: string | null; icon: React.ReactNode; done: boolean }> = [
    {
      label: 'Pedido creado',
      time: order.created_at,
      icon: <Package className="w-3.5 h-3.5" />,
      done: true,
    },
    {
      label: 'Confirmado',
      time: order.confirmed_at,
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      done: !!order.confirmed_at,
    },
    {
      label: 'Enviado',
      time: order.shipped_at,
      icon: <Truck className="w-3.5 h-3.5" />,
      done: !!order.shipped_at,
    },
    {
      label: 'Entregado',
      time: order.delivered_at,
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      done: !!order.delivered_at,
    },
  ]

  if (order.cancelled_at) {
    timeline.push({
      label: 'Cancelado',
      time: order.cancelled_at,
      icon: <XCircle className="w-3.5 h-3.5" />,
      done: true,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto p-0">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-primary-dark to-[#0D3050] px-6 py-5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-cyan/20 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-primary-cyan" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white text-lg">{order.short_id}</span>
                  <Badge
                    variant="secondary"
                    className={cn('text-[10px] border-0', statusInfo.bgColor, statusInfo.color)}
                  >
                    {statusInfo.icon} {statusInfo.label}
                  </Badge>
                </div>
                <p className="text-xs text-white/50 mt-0.5">Creado {formatRelativeTime(order.created_at)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">

        {/* Customer info */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</h4>
          <div className="space-y-2">
            {order.customer_name && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-400" />
                <span>{order.customer_name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="font-mono">{formatPhone(order.customer_phone)}</span>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
              >
                <MessageSquare className="w-3 h-3" />
                WhatsApp
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <span>{order.delivery_address}</span>
                {order.delivery_instructions && (
                  <p className="text-xs text-gray-400 mt-0.5">{order.delivery_instructions}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Order items */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Productos ({itemsCount})
          </h4>
          <div className="space-y-2">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400 w-5 text-right shrink-0">{item.quantity}x</span>
                  <span className="truncate text-gray-700">{item.name}</span>
                </div>
                <span className="text-gray-500 shrink-0 ml-2">{formatPrice(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Envio</span>
              <span>{formatPrice(order.shipping_fee)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-success">
                <span>Descuento</span>
                <span>-{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-primary-dark pt-1">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Timeline del pedido</h4>
          <div className="space-y-0">
            {timeline.map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 relative">
                {/* Vertical line */}
                {idx < timeline.length - 1 && (
                  <div className={cn(
                    'absolute left-[9px] top-5 w-0.5 h-full',
                    step.done ? 'bg-primary-cyan/30' : 'bg-gray-200'
                  )} />
                )}
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10',
                  step.done ? 'bg-primary-cyan/20 text-primary-cyan' : 'bg-gray-100 text-gray-300'
                )}>
                  {step.icon}
                </div>
                <div className="pb-4">
                  <p className={cn('text-sm', step.done ? 'text-gray-700' : 'text-gray-400')}>
                    {step.label}
                  </p>
                  {step.time && (
                    <p className="text-[11px] text-gray-400">{formatRelativeTime(step.time)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cancellation reason */}
        {order.cancellation_reason && (
          <>
            <div className="p-3 rounded-xl bg-error/5 border border-error/20">
              <div className="flex items-center gap-2 text-sm font-medium text-error mb-1">
                <AlertTriangle className="w-4 h-4" />
                Motivo de cancelación
              </div>
              <p className="text-sm text-gray-600">{order.cancellation_reason}</p>
            </div>
          </>
        )}

        {/* Notes */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notas del operador</h4>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Agregar nota interna sobre este pedido..."
            className="text-sm min-h-[60px] bg-white border-gray-200 shadow-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNoteSave(order.id, noteText)}
            className="text-xs rounded-lg"
          >
            Guardar nota
          </Button>
        </div>

        {/* Actions footer */}
        <div className="flex flex-wrap gap-2 pt-1">
          {validTransitions.map((newStatus) => {
            const info = ORDER_STATUS_MAP[newStatus as OrderStatus]
            if (!info) return null
            const isDestructive = newStatus === 'cancelled' || newStatus === 'failed'
            return (
              <Button
                key={newStatus}
                variant={isDestructive ? 'destructive' : 'outline'}
                size="sm"
                className="text-xs rounded-lg"
                onClick={() => {
                  onStatusChange(order.id, newStatus as OrderStatus)
                  onOpenChange(false)
                }}
              >
                {info.icon} {info.label}
              </Button>
            )
          })}
        </div>

        </div>{/* end p-6 wrapper */}
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS)
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Sensors for drag
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  })
  const sensors = useSensors(pointerSensor, touchSensor)

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesId = order.short_id.toLowerCase().includes(q)
        const matchesPhone = order.customer_phone.includes(q)
        const matchesName = order.customer_name?.toLowerCase().includes(q)
        if (!matchesId && !matchesPhone && !matchesName) return false
      }
      if (filterStatus !== 'all' && order.status !== filterStatus) return false
      return true
    })
  }, [orders, searchQuery, filterStatus])

  // Group orders by kanban column
  const columnOrders = useMemo(() => {
    const map: Record<KanbanColumnId, Order[]> = {
      pending: [],
      confirmed: [],
      shipped: [],
      delivered: [],
      problem: [],
    }
    filteredOrders.forEach((order) => {
      const colId = getColumnForStatus(order.status)
      map[colId].push(order)
    })
    return map
  }, [filteredOrders])

  // Active drag order
  const activeOrder = useMemo(() => {
    if (!activeId) return null
    return orders.find((o) => o.id === activeId) || null
  }, [activeId, orders])

  // Handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const orderId = active.id as string
    const targetColumnId = over.id as KanbanColumnId

    const order = orders.find((o) => o.id === orderId)
    if (!order) return

    const currentColumn = getColumnForStatus(order.status)
    if (currentColumn === targetColumnId) return

    const targetStatus = getStatusForColumn(targetColumnId)
    const validTransitions = VALID_STATUS_TRANSITIONS[order.status] || []

    // Check if the target column has any valid status we can transition to
    const targetCol = KANBAN_COLUMNS.find((c) => c.id === targetColumnId)
    if (!targetCol) return

    const validTarget = targetCol.statuses.find((s) => validTransitions.includes(s))
    if (!validTarget) return

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: validTarget, updated_at: new Date().toISOString() }
          : o
      )
    )
  }, [orders])

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  const handleCardClick = useCallback((order: Order) => {
    setSelectedOrder(order)
    setDetailOpen(true)
  }, [])

  const handleStatusChange = useCallback((orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: newStatus, updated_at: new Date().toISOString() }
          : o
      )
    )
    // Update selected order if it's the same
    setSelectedOrder((prev) =>
      prev && prev.id === orderId
        ? { ...prev, status: newStatus, updated_at: new Date().toISOString() }
        : prev
    )
  }, [])

  const handleNoteSave = useCallback((orderId: string, note: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, operator_notes: note, updated_at: new Date().toISOString() }
          : o
      )
    )
    setSelectedOrder((prev) =>
      prev && prev.id === orderId
        ? { ...prev, operator_notes: note }
        : prev
    )
  }, [])

  // Summary counts
  const totalActive = orders.filter(
    (o) => !['delivered', 'cancelled', 'failed'].includes(o.status)
  ).length

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Pedidos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {totalActive} pedidos activos &middot; {orders.length} total
          </p>
        </div>

        {/* View toggle + Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === 'kanban'
                  ? 'bg-white text-primary-dark shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === 'table'
                  ? 'bg-white text-primary-dark shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <List className="w-3.5 h-3.5" />
              Lista
            </button>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por ID, telefono, nombre..."
            className="pl-9 h-9 text-sm"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-background text-sm font-medium text-gray-600 hover:bg-muted transition-colors">
            <Filter className="w-3.5 h-3.5" />
            {filterStatus === 'all' ? 'Todos los estados' : ORDER_STATUS_MAP[filterStatus as OrderStatus]?.label ?? filterStatus}
            <ChevronDown className="w-3.5 h-3.5 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Estado</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setFilterStatus('all')}>Todos</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterStatus('pending')}>Pendientes</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterStatus('confirmed')}>Confirmados</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterStatus('shipped')}>Enviados</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterStatus('delivered')}>Entregados</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterStatus('cancelled')}>Cancelados</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-background text-sm font-medium text-gray-600 hover:bg-muted transition-colors">
            <Calendar className="w-3.5 h-3.5" />
            Hoy
            <ChevronDown className="w-3.5 h-3.5 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Periodo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Hoy</DropdownMenuItem>
            <DropdownMenuItem>Ayer</DropdownMenuItem>
            <DropdownMenuItem>Ultimos 7 dias</DropdownMenuItem>
            <DropdownMenuItem>Ultimos 30 dias</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {viewMode === 'kanban' ? (
          <motion.div
            key="kanban"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              {/* Scrollable horizontal on mobile */}
              <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-6 lg:overflow-x-visible">
                {KANBAN_COLUMNS.map((column, index) => (
                  <DroppableColumn
                    key={column.id}
                    column={column}
                    orders={columnOrders[column.id]}
                    onCardClick={handleCardClick}
                    index={index}
                  />
                ))}
              </div>

              {/* Drag overlay */}
              <DragOverlay dropAnimation={null}>
                {activeOrder ? (
                  <OrderCard
                    order={activeOrder}
                    onClick={() => {}}
                    isDragOverlay
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TableView orders={filteredOrders} onCardClick={handleCardClick} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order detail modal */}
      <OrderDetailModal
        order={selectedOrder}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusChange={handleStatusChange}
        onNoteSave={handleNoteSave}
      />
    </div>
  )
}
