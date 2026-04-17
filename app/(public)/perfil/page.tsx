'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Mail, Phone, LogOut, Heart, Package, ChevronRight,
  MapPin, Plus, Edit2, Trash2, Star, Check, X, Ticket,
  ArrowLeft, Clock, Truck, CheckCircle2, XCircle, AlertCircle,
  Copy, ExternalLink, ShoppingBag, Calendar, Tag, CreditCard, RotateCcw,
  ChevronUp, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/auth'
import { useFavoritesStore } from '@/lib/stores/favorites'
import { formatPrice, formatDate } from '@/lib/utils/format'
import { ORDER_STATUS_MAP } from '@/lib/utils/constants'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'
import type { Order, OrderStatus, OrderUpdate, Address, UserCoupon } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

const STATUS_TAB_ITEMS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'shipped', label: 'En camino' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'cancelled', label: 'Cancelados' },
]

const STATUS_FLOW: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered']

/** Timeline from real order timestamps (no mock data). */
function buildSyntheticOrderUpdates(order: Order): OrderUpdate[] {
  const out: OrderUpdate[] = []
  const mk = (status: OrderStatus, at: string | null, message: string | null) => {
    if (!at) return
    out.push({
      id: `${order.id}-${status}-${at}`,
      order_id: order.id,
      status,
      message,
      updated_by: null,
      metadata: null,
      created_at: at,
    })
  }
  if (order.status === 'cancelled' || order.status === 'refunded' || order.status === 'failed') {
    mk(
      order.status,
      order.cancelled_at ?? order.updated_at ?? order.created_at,
      order.cancellation_reason ?? order.failure_reason ?? null,
    )
    return out
  }
  mk('pending', order.created_at, 'Pedido registrado')
  if (order.paid_at) mk('paid', order.paid_at, 'Pago recibido')
  if (order.confirmed_at) mk('confirmed', order.confirmed_at, null)
  else if (order.paid_at) mk('confirmed', order.paid_at, 'Pedido confirmado')
  mk('shipped', order.shipped_at, order.operator_notes ?? null)
  mk('delivered', order.delivered_at, null)
  return out.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

const STATUS_ICONS: Partial<Record<OrderStatus, React.ReactNode>> = {
  pending: <Clock className="w-4 h-4" />,
  pending_payment: <Clock className="w-4 h-4" />,
  paid: <CreditCard className="w-4 h-4" />,
  confirmed: <CheckCircle2 className="w-4 h-4" />,
  preparing: <Package className="w-4 h-4" />,
  ready_to_ship: <Truck className="w-4 h-4" />,
  shipped: <Truck className="w-4 h-4" />,
  delivered: <CheckCircle2 className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
  refunded: <RotateCcw className="w-4 h-4" />,
  failed: <AlertCircle className="w-4 h-4" />,
}

// ─── Order line thumbnail ───────────────────────────────────────────────────

function OrderLineThumb({ url, label }: { url?: string | null; label: string }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return (
      <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center text-lg shrink-0" title={label}>
        🍘
      </div>
    )
  }
  return (
    <img
      src={url}
      alt=""
      className="w-8 h-8 rounded-lg object-cover shrink-0 bg-gray-50"
      onError={() => setFailed(true)}
    />
  )
}

// ─── Order Detail Panel/Modal ────────────────────────────────────────────────

function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const updates = buildSyntheticOrderUpdates(order)
  const statusInfo = ORDER_STATUS_MAP[order.status]
  const isCancelled = order.status === 'cancelled' || order.status === 'failed'

  const copyShortId = () => {
    navigator.clipboard.writeText(order.short_id)
    toast.success('ID copiado')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-gray-900">{order.short_id}</h2>
            <button onClick={copyShortId} className="text-gray-300 hover:text-gray-500 transition-colors">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-gray-400">{formatDateTime(order.created_at)}</p>
        </div>
        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
          {statusInfo.icon} {statusInfo.label}
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

        {/* Status timeline */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Historial de estado</h3>
          {isCancelled ? (
            <div className="space-y-3">
              {updates.map((upd, i) => {
                const info = ORDER_STATUS_MAP[upd.status as OrderStatus]
                const isLast = i === updates.length - 1
                return (
                  <div key={upd.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isLast ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {STATUS_ICONS[upd.status as OrderStatus]}
                      </div>
                      {i < updates.length - 1 && <div className="w-px h-full min-h-[16px] bg-gray-100 mt-1" />}
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <p className={`text-sm font-bold ${isLast ? 'text-red-500' : 'text-gray-500'}`}>
                        {info?.label}
                      </p>
                      {upd.message && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{upd.message}</p>}
                      <p className="text-[10px] text-gray-300 mt-1">{formatDateTime(upd.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-0">
              {STATUS_FLOW.map((step, i) => {
                const info = ORDER_STATUS_MAP[step]
                const update = updates.find((u) => u.status === step)
                const isCompleted = update != null
                const isActive = order.status === step
                const isLast = i === STATUS_FLOW.length - 1

                return (
                  <div key={step} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                        isCompleted
                          ? 'bg-green-500 border-green-500 text-white'
                          : isActive
                          ? 'bg-nurei-cta border-nurei-cta text-gray-900'
                          : 'bg-white border-gray-200 text-gray-300'
                      }`}>
                        {isCompleted ? <Check className="w-3.5 h-3.5" /> : STATUS_ICONS[step]}
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 h-8 mt-1 ${isCompleted ? 'bg-green-300' : 'bg-gray-100'}`} />
                      )}
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <p className={`text-sm font-bold ${
                        isCompleted ? 'text-gray-900' : isActive ? 'text-nurei-cta' : 'text-gray-300'
                      }`}>
                        {info.label}
                      </p>
                      {update?.message && (
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{update.message}</p>
                      )}
                      {update && (
                        <p className="text-[10px] text-gray-300 mt-1">{formatDateTime(update.created_at)}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Products */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Productos</h3>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <OrderLineThumb url={item.image_url} label={item.name} />
                  <div>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.quantity}x {formatPrice(item.unit_price)}</p>
                  </div>
                </div>
                <span className="text-sm font-black text-gray-900 tabular-nums shrink-0">
                  {formatPrice(item.subtotal)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span><span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>Envío</span>
            <span>{order.shipping_fee === 0 ? 'Gratis' : formatPrice(order.shipping_fee)}</span>
          </div>
          {order.coupon_discount > 0 && (
            <div className="flex justify-between text-sm text-green-500 font-bold">
              <span>Cupón {order.coupon_code}</span>
              <span>-{formatPrice(order.coupon_discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-gray-900 pt-2 border-t border-gray-200">
            <span>Total</span><span>{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Delivery address */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Dirección de entrega</h3>
          <div className="flex gap-2.5">
            <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-700 leading-relaxed">{order.delivery_address}</p>
              {order.delivery_instructions && (
                <p className="text-xs text-gray-400 mt-1 italic">{order.delivery_instructions}</p>
              )}
            </div>
          </div>
        </div>

        {/* Cancellation info */}
        {order.cancellation_reason && (
          <div className="bg-red-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-red-500 uppercase mb-1">Motivo de cancelación</p>
            <p className="text-sm text-red-700">{order.cancellation_reason}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Pedidos ─────────────────────────────────────────────────────────────

function TabPedidos({
  orders,
  loading,
}: {
  orders: Order[]
  loading: boolean
}) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const filtered = orders.filter((o) =>
    statusFilter === 'all' ? true : o.status === statusFilter
  )

  const openDetail = (order: Order) => setSelectedOrder(order)
  const closeDetail = () => setSelectedOrder(null)

  return (
    <div className="relative">
      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide">
        {STATUS_TAB_ITEMS.map((tab) => {
          const count = tab.value === 'all'
            ? orders.length
            : orders.filter((o) => o.status === tab.value).length
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === tab.value
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  statusFilter === tab.value ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Orders list */}
      {filtered.length === 0 ? (
        <div className="text-center py-14">
          <ShoppingBag className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-400">Sin pedidos en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const status = ORDER_STATUS_MAP[order.status]
            return (
              <motion.button
                key={order.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => openDetail(order)}
                className="w-full text-left bg-white border border-gray-100 rounded-2xl p-4 hover:border-gray-200 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-black text-gray-900">{order.short_id}</p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDateShort(order.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${status.bgColor} ${status.color}`}>
                      {status.icon} {status.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {order.items.slice(0, 2).map((item, i) => (
                    <span key={i} className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-lg">
                      {item.quantity}x {item.name.length > 20 ? item.name.slice(0, 20) + '…' : item.name}
                    </span>
                  ))}
                  {order.items.length > 2 && (
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                      +{order.items.length - 2} más
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[180px]">{order.delivery_address.split(',')[0]}</span>
                  </div>
                  <span className="text-sm font-black text-gray-900">{formatPrice(order.total)}</span>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Mobile: full-screen drawer */}
      <AnimatePresence>
        {selectedOrder && isMobile && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-white"
          >
            <OrderDetail order={selectedOrder} onClose={closeDetail} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop: side panel */}
      <AnimatePresence>
        {selectedOrder && !isMobile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDetail}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl"
            >
              <OrderDetail order={selectedOrder} onClose={closeDetail} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Address form ─────────────────────────────────────────────────────────────

const EMPTY_ADDRESS: Omit<Address, 'id' | 'created_at'> = {
  label: 'Casa', recipient_name: '', street: '', exterior_number: '',
  interior_number: null, colonia: '', city: 'Ciudad de México',
  state: 'CDMX', zip_code: '', phone: '', instructions: null, is_default: false,
}

function AddressForm({
  initial, onSave, onCancel,
}: {
  initial?: Partial<Address>
  onSave: (data: Omit<Address, 'id' | 'created_at'>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Omit<Address, 'id' | 'created_at'>>({
    ...EMPTY_ADDRESS, ...(initial ?? {}),
  })

  const set = (key: keyof typeof form, value: string | boolean | null) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.recipient_name || !form.street || !form.exterior_number || !form.colonia || !form.zip_code || !form.phone) {
      toast.error('Completa los campos obligatorios')
      return
    }
    onSave(form)
  }

  const LABEL_OPTIONS = ['Casa', 'Trabajo', 'Otro']

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Label */}
      <div>
        <label className="block text-xs font-bold text-gray-500 mb-2">Etiqueta</label>
        <div className="flex gap-2">
          {LABEL_OPTIONS.map((opt) => (
            <button
              key={opt} type="button"
              onClick={() => set('label', opt)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                form.label === opt ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >{opt}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 mb-1">Nombre del destinatario *</label>
        <input value={form.recipient_name} onChange={(e) => set('recipient_name', e.target.value)}
          placeholder="Juan Pérez" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-bold text-gray-500 mb-1">Calle *</label>
          <input value={form.street} onChange={(e) => set('street', e.target.value)}
            placeholder="Av. Insurgentes Sur" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Núm. exterior *</label>
          <input value={form.exterior_number} onChange={(e) => set('exterior_number', e.target.value)}
            placeholder="1234" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Núm. interior</label>
          <input value={form.interior_number || ''} onChange={(e) => set('interior_number', e.target.value || null)}
            placeholder="Depto 3" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Colonia *</label>
          <input value={form.colonia} onChange={(e) => set('colonia', e.target.value)}
            placeholder="Del Valle" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">C.P. *</label>
          <input value={form.zip_code} onChange={(e) => set('zip_code', e.target.value)}
            placeholder="03100" maxLength={5} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Ciudad</label>
          <input value={form.city} onChange={(e) => set('city', e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Estado</label>
          <input value={form.state} onChange={(e) => set('state', e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Teléfono *</label>
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
            type="tel" placeholder="5512345678" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 mb-1">Instrucciones de entrega</label>
        <textarea value={form.instructions || ''} onChange={(e) => set('instructions', e.target.value || null)}
          placeholder="Dejar en recepción, tocar timbre..." rows={2}
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta" />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <div
          onClick={() => set('is_default', !form.is_default)}
          className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${form.is_default ? 'bg-nurei-cta' : 'bg-gray-200'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_default ? 'translate-x-5' : 'translate-x-0'}`} />
        </div>
        <span className="text-sm font-bold text-gray-700">Establecer como dirección predeterminada</span>
      </label>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
          Cancelar
        </button>
        <button type="submit"
          className="flex-1 py-3 text-sm font-bold text-gray-900 bg-nurei-cta rounded-xl shadow-lg shadow-nurei-cta/25 hover:shadow-xl transition-all">
          Guardar dirección
        </button>
      </div>
    </form>
  )
}

// ─── Tab: Direcciones ─────────────────────────────────────────────────────────

function TabDirecciones() {
  const { addresses, addAddress, updateAddress, deleteAddress, setDefaultAddress } = useAuthStore()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleAdd = (data: Omit<Address, 'id' | 'created_at'>) => {
    addAddress(data)
    setShowForm(false)
    toast.success('Dirección guardada', { icon: '📍' })
  }

  const handleUpdate = (data: Omit<Address, 'id' | 'created_at'>) => {
    if (!editingId) return
    updateAddress(editingId, data)
    setEditingId(null)
    toast.success('Dirección actualizada')
  }

  const handleDelete = (id: string) => {
    deleteAddress(id)
    toast.success('Dirección eliminada')
  }

  const handleSetDefault = (id: string) => {
    setDefaultAddress(id)
    toast.success('Dirección predeterminada actualizada')
  }

  if (editingId) {
    const addr = addresses.find((a) => a.id === editingId)
    return (
      <div>
        <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-5">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <h3 className="text-base font-black text-gray-900 mb-5">Editar dirección</h3>
        <AddressForm initial={addr} onSave={handleUpdate} onCancel={() => setEditingId(null)} />
      </div>
    )
  }

  if (showForm) {
    return (
      <div>
        <button onClick={() => setShowForm(false)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-5">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <h3 className="text-base font-black text-gray-900 mb-5">Nueva dirección</h3>
        <AddressForm onSave={handleAdd} onCancel={() => setShowForm(false)} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-400">{addresses.length} {addresses.length === 1 ? 'dirección' : 'direcciones'}</p>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-nurei-cta text-gray-900 rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition-all">
          <Plus className="w-3.5 h-3.5" /> Nueva dirección
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-14">
          <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-400 mb-1">Sin direcciones guardadas</p>
          <p className="text-xs text-gray-300">Agrega una para agilizar tus compras</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <motion.div key={addr.id} layout
              className={`relative bg-white border-2 rounded-2xl p-4 transition-all ${
                addr.is_default ? 'border-nurei-cta shadow-sm shadow-nurei-cta/10' : 'border-gray-100'
              }`}
            >
              {addr.is_default && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-nurei-cta/10 text-nurei-cta px-2 py-0.5 rounded-full">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="text-[10px] font-bold">Predeterminada</span>
                </div>
              )}

              <div className="flex items-start gap-3 pr-28">
                <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-gray-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full">{addr.label}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{addr.recipient_name}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {addr.street} {addr.exterior_number}
                    {addr.interior_number ? ` Int. ${addr.interior_number}` : ''},{' '}
                    {addr.colonia}, {addr.city}, {addr.state}, CP {addr.zip_code}
                  </p>
                  {addr.instructions && (
                    <p className="text-[11px] text-gray-400 mt-1 italic">{addr.instructions}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {addr.phone}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50">
                {!addr.is_default && (
                  <button onClick={() => handleSetDefault(addr.id)}
                    className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-nurei-cta px-2 py-1.5 rounded-lg hover:bg-yellow-50 transition-colors">
                    <Star className="w-3.5 h-3.5" /> Predeterminar
                  </button>
                )}
                <button onClick={() => setEditingId(addr.id)}
                  className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors ml-auto">
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={() => handleDelete(addr.id)}
                  className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Cupones ─────────────────────────────────────────────────────────────

function TabCupones() {
  const [copied, setCopied] = useState<string | null>(null)
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([])

  useEffect(() => {
    fetchWithCredentials('/api/profile/coupons')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setUserCoupons(json.data)
      })
      .catch(() => {})
  }, [])

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    toast.success(`Código ${code} copiado`, { icon: '🎟️' })
    setTimeout(() => setCopied(null), 2000)
  }

  const active = userCoupons.filter((uc) => !uc.used_at)
  const used = userCoupons.filter((uc) => uc.used_at)

  const CouponCard = ({ uc }: { uc: UserCoupon }) => {
    const isUsed = !!uc.used_at
    const isExpired = uc.coupon.expires_at ? new Date(uc.coupon.expires_at) < new Date() : false
    const daysLeft = uc.coupon.expires_at && !isUsed ? daysUntil(uc.coupon.expires_at) : null

    return (
      <motion.div layout
        className={`relative overflow-hidden bg-white border-2 rounded-2xl ${
          isUsed || isExpired ? 'border-gray-100 opacity-60' : 'border-yellow-200 shadow-sm shadow-yellow-100'
        }`}
      >
        {/* Dashed left border decoration */}
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isUsed || isExpired ? 'bg-gray-200' : 'bg-nurei-cta'}`} />

        <div className="pl-5 pr-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isUsed || isExpired ? 'bg-gray-100' : 'bg-yellow-50'
              }`}>
                <Ticket className={`w-4 h-4 ${isUsed || isExpired ? 'text-gray-300' : 'text-yellow-500'}`} />
              </div>
              <div>
                <p className="font-mono text-sm font-black text-gray-900">{uc.coupon.code}</p>
                {uc.coupon.description && (
                  <p className="text-xs text-gray-500">{uc.coupon.description}</p>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className={`text-lg font-black ${isUsed || isExpired ? 'text-gray-400' : 'text-gray-900'}`}>
                {uc.coupon.type === 'percentage' ? `${uc.coupon.value}%` : formatPrice(uc.coupon.value)}
              </p>
              <p className="text-[10px] text-gray-400">
                {uc.coupon.type === 'percentage' ? 'descuento' : 'de descuento'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-3 flex-wrap">
            <span className="flex items-center gap-1">
              <ShoppingBag className="w-3 h-3" />
              Mín. {formatPrice(uc.coupon.min_order_amount)}
            </span>
            {uc.coupon.expires_at && (
              <span className={`flex items-center gap-1 ${
                !isUsed && daysLeft !== null && daysLeft <= 7 ? 'text-red-400 font-bold' : ''
              }`}>
                <Clock className="w-3 h-3" />
                {isUsed || isExpired
                  ? `Venció ${formatDateShort(uc.coupon.expires_at)}`
                  : daysLeft !== null && daysLeft <= 0
                  ? 'Expiró hoy'
                  : daysLeft !== null && daysLeft <= 7
                  ? `Vence en ${daysLeft} días`
                  : `Vence ${formatDateShort(uc.coupon.expires_at)}`}
              </span>
            )}
          </div>

          {isUsed ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Check className="w-3.5 h-3.5 text-green-400" />
              Usado el {formatDateShort(uc.used_at!)}
              {uc.order_id && (
                <span className="text-gray-300">· Pedido asociado</span>
              )}
            </div>
          ) : isExpired ? (
            <p className="text-xs text-red-400 font-bold">Cupón expirado</p>
          ) : (
            <button
              onClick={() => copyCoupon(uc.coupon.code)}
              className="flex items-center gap-1.5 w-full justify-center py-2 text-xs font-bold text-gray-900 bg-nurei-cta/90 hover:bg-nurei-cta rounded-xl transition-colors"
            >
              {copied === uc.coupon.code ? (
                <><Check className="w-3.5 h-3.5" /> Copiado</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copiar código</>
              )}
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            Disponibles ({active.length})
          </h3>
          <div className="space-y-3">
            {active.map((uc) => <CouponCard key={uc.id} uc={uc} />)}
          </div>
        </div>
      )}

      {used.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            Usados ({used.length})
          </h3>
          <div className="space-y-3">
            {used.map((uc) => <CouponCard key={uc.id} uc={uc} />)}
          </div>
        </div>
      )}

      {active.length === 0 && used.length === 0 && (
        <div className="text-center py-14">
          <Ticket className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-400">Sin cupones disponibles</p>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Cuenta ──────────────────────────────────────────────────────────────

function TabCuenta() {
  const { user, email, updateProfile, logout } = useAuthStore()
  const router = useRouter()
  const [name, setName] = useState(user?.full_name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [saving, setSaving] = useState(false)
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null)
  const [acceptingTerms, setAcceptingTerms] = useState(false)
  const termsConsentRef = useRef<HTMLInputElement>(null)
  const [acceptsMarketing, setAcceptsMarketing] = useState(false)
  const [acceptsEmail, setAcceptsEmail] = useState(false)
  const [acceptsSms, setAcceptsSms] = useState(false)
  const [acceptsWhatsapp, setAcceptsWhatsapp] = useState(false)
  const [prefsLoading, setPrefsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchWithCredentials('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json?.data) return
        const d = json.data as {
          full_name?: string | null
          phone?: string | null
          customer?: {
            first_name?: string | null
            last_name?: string | null
            full_name?: string | null
            accepts_marketing?: boolean
            accepts_email_marketing?: boolean
            accepts_sms_marketing?: boolean
            accepts_whatsapp_marketing?: boolean
          } | null
          legal_terms_accepted_at?: string | null
        }
        const c = d.customer
        if (c) {
          setAcceptsMarketing(!!c.accepts_marketing)
          setAcceptsEmail(!!c.accepts_email_marketing)
          setAcceptsSms(!!c.accepts_sms_marketing)
          setAcceptsWhatsapp(!!c.accepts_whatsapp_marketing)
        }
        const profileName = (d.full_name ?? '').trim()
        const fromCustomer = [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim()
          || (c?.full_name ?? '').trim()
        if (profileName) setName(profileName)
        else if (fromCustomer) setName(fromCustomer)
        if (d.phone !== undefined) setPhone(d.phone ?? '')
        const ta = d.legal_terms_accepted_at
        setTermsAcceptedAt(typeof ta === 'string' ? ta : null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPrefsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setName(user?.full_name || '')
    setPhone(user?.phone || '')
  }, [user?.full_name, user?.phone])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile({
        full_name: name,
        phone: phone || null,
        accepts_marketing: acceptsMarketing,
        accepts_email_marketing: acceptsEmail,
        accepts_sms_marketing: acceptsSms,
        accepts_whatsapp_marketing: acceptsWhatsapp,
      })
      toast.success('Perfil actualizado', { icon: '✅' })
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleAcceptTerms = async (): Promise<boolean> => {
    try {
      const res = await fetchWithCredentials('/api/profile/accept-terms', { method: 'POST' })
      if (!res.ok) throw new Error()
      setTermsAcceptedAt(new Date().toISOString())
      toast.success('Gracias. Preferencias y envíos se rigen por nuestros documentos legales.')
      return true
    } catch {
      toast.error('No se pudo registrar la aceptación')
      return false
    }
  }

  const handleLogout = async () => {
    await logout()
    toast.success('Sesión cerrada')
    router.push('/')
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">Nombre</label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta transition-all" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="email" value={email || ''} disabled
              className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-400 cursor-not-allowed" />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">El email no se puede cambiar</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">Teléfono</label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+52 55 1234 5678"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nurei-cta/50 focus:border-nurei-cta transition-all" />
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 space-y-3">
          <p className="text-xs font-bold text-gray-500">Comunicaciones (LFPDPPP)</p>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Puedes retirar tu consentimiento en cualquier momento desde aquí. Los envíos transaccionales (pedido, envío) pueden seguir enviándose según la ley.
          </p>
          {prefsLoading ? (
            <p className="text-xs text-gray-400">Cargando preferencias…</p>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300" checked={acceptsMarketing} onChange={(e) => setAcceptsMarketing(e.target.checked)} />
                Acepto recibir novedades y promociones (marketing general)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300" checked={acceptsEmail} onChange={(e) => setAcceptsEmail(e.target.checked)} />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300" checked={acceptsSms} onChange={(e) => setAcceptsSms(e.target.checked)} />
                SMS
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300" checked={acceptsWhatsapp} onChange={(e) => setAcceptsWhatsapp(e.target.checked)} />
                WhatsApp
              </label>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-gray-100">
          {termsAcceptedAt ? (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
              Términos y política de privacidad aceptados el {formatDateShort(termsAcceptedAt)}.
            </p>
          ) : (
            <label className="flex items-start gap-2.5 cursor-pointer text-sm text-gray-600">
              <input
                ref={termsConsentRef}
                type="checkbox"
                disabled={acceptingTerms}
                className="mt-1 rounded border-gray-300 disabled:opacity-50"
                onChange={async (e) => {
                  if (!e.target.checked) return
                  setAcceptingTerms(true)
                  const ok = await handleAcceptTerms()
                  setAcceptingTerms(false)
                  if (!ok && termsConsentRef.current) termsConsentRef.current.checked = false
                }}
              />
              <span className="leading-snug">
                Confirmo que he leído y acepto los{' '}
                <Link href="/legal/terminos" target="_blank" rel="noopener noreferrer" className="text-nurei-cta font-bold underline-offset-2 hover:underline">términos y condiciones</Link>
                {' '}y el{' '}
                <Link href="/legal/privacidad" target="_blank" rel="noopener noreferrer" className="text-nurei-cta font-bold underline-offset-2 hover:underline">aviso de privacidad</Link>
                {' '}de {typeof window !== 'undefined' ? window.location.hostname : 'nurei'}.
              </span>
            </label>
          )}
        </div>

        <motion.button whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving}
          className="w-full py-3 bg-nurei-cta text-gray-900 font-bold rounded-xl shadow-lg shadow-nurei-cta/25 transition-all hover:shadow-xl disabled:opacity-60">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </motion.button>
      </div>

      <button onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-red-100">
        <LogOut className="w-4 h-4" /> Cerrar sesión
      </button>
    </div>
  )
}

// ─── Main Profile Page ────────────────────────────────────────────────────────

type TabId = 'pedidos' | 'cupones' | 'direcciones' | 'cuenta'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'pedidos', label: 'Pedidos', icon: <Package className="w-4 h-4" /> },
  { id: 'cupones', label: 'Cupones', icon: <Ticket className="w-4 h-4" /> },
  { id: 'direcciones', label: 'Direcciones', icon: <MapPin className="w-4 h-4" /> },
  { id: 'cuenta', label: 'Cuenta', icon: <User className="w-4 h-4" /> },
]

export default function PerfilPage() {
  const router = useRouter()
  const { user, email, isAuthenticated, refreshUser, loadAddresses } = useAuthStore()
  const favCount = useFavoritesStore((s) => s.favoriteIds.length)
  const [activeTab, setActiveTab] = useState<TabId>('pedidos')
  const [mounted, setMounted] = useState(false)
  const [activeOrderCount, setActiveOrderCount] = useState(0)
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [couponActiveCount, setCouponActiveCount] = useState(0)
  const [showAccountSummary, setShowAccountSummary] = useState(true)

  useEffect(() => { setMounted(true) }, [])

  const loadOrders = useCallback(() => {
    setOrdersLoading(true)
    fetchWithCredentials('/api/orders')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const list = (json?.data ?? []) as Order[]
        setOrders(list)
        setActiveOrderCount(
          list.filter((o) => ['pending', 'confirmed', 'shipped', 'paid', 'preparing', 'ready_to_ship'].includes(o.status)).length,
        )
      })
      .catch(() => {
        setOrders([])
        setActiveOrderCount(0)
      })
      .finally(() => setOrdersLoading(false))
  }, [])

  useEffect(() => {
    if (mounted && !isAuthenticated) { router.push('/login'); return }
    if (mounted && isAuthenticated) {
      refreshUser()
      loadAddresses()
      loadOrders()
      fetchWithCredentials('/api/profile/coupons')
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          const arr = (json?.data ?? []) as UserCoupon[]
          setCouponActiveCount(arr.filter((uc) => !uc.used_at).length)
        })
        .catch(() => setCouponActiveCount(0))
    }
  }, [mounted, isAuthenticated, router, refreshUser, loadAddresses, loadOrders])

  if (!mounted || !isAuthenticated || !user) return null

  const pendingOrders = activeOrderCount

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-nurei-cta to-yellow-300 flex items-center justify-center shrink-0">
              <span className="text-2xl font-black text-gray-900">
                {(user.full_name || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-gray-900 truncate">
                {user.full_name || 'Mi cuenta'}
              </h1>
              <p className="text-sm text-gray-400 truncate">{email || user.id}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAccountSummary((v) => !v)}
              className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-50"
              aria-expanded={showAccountSummary}
            >
              {showAccountSummary ? (
                <>Ocultar resumen <ChevronUp className="w-3.5 h-3.5" /></>
              ) : (
                <>Mostrar resumen <ChevronDown className="w-3.5 h-3.5" /></>
              )}
            </button>
          </div>

          {/* Quick stats */}
          {showAccountSummary && (
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-gray-50 rounded-2xl p-3 text-center">
              <p className="text-xl font-black text-gray-900">{orders.length}</p>
              <p className="text-[11px] text-gray-400 font-bold mt-0.5">Pedidos</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 text-center">
              <Link href="/favoritos" className="block">
                <p className="text-xl font-black text-gray-900">{favCount}</p>
                <p className="text-[11px] text-gray-400 font-bold mt-0.5">Favoritos</p>
              </Link>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 text-center">
              <p className="text-xl font-black text-nurei-cta">
                {couponActiveCount}
              </p>
              <p className="text-[11px] text-gray-400 font-bold mt-0.5">Cupones</p>
            </div>
          </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-bold whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'pedidos' && pendingOrders > 0 && (
                  <span className="ml-0.5 text-[10px] px-1.5 py-0.5 bg-nurei-cta text-gray-900 rounded-full font-black">
                    {pendingOrders}
                  </span>
                )}
                {activeTab === tab.id && (
                  <motion.div layoutId="tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'pedidos' && (
              <TabPedidos orders={orders} loading={ordersLoading} />
            )}
            {activeTab === 'cupones' && <TabCupones />}
            {activeTab === 'direcciones' && <TabDirecciones />}
            {activeTab === 'cuenta' && <TabCuenta />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
