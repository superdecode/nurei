'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Package,
  Phone, Mail, MapPin, Copy, Send, Printer, Loader2,
  Clock, CreditCard, Truck, CheckCircle2, XCircle, AlertTriangle,
  RotateCcw, Ban, MessageSquare, ArrowRight, CalendarDays,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

import type { Order, OrderStatus, OrderItem, OrderUpdate } from '@/types'
import { ORDER_STATUS_MAP, VALID_STATUS_TRANSITIONS, PAYMENT_METHOD_LABELS, CANCELLABLE_STATUSES } from '@/lib/utils/constants'
import type { StatusMeta } from '@/lib/utils/constants'
import { formatPrice, formatDate, formatPhone } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

// ── Helpers ──────────────────────────────────────────────────────────────

function sMeta(status: OrderStatus): StatusMeta {
  return ORDER_STATUS_MAP[status] ?? { label: status, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-300' }
}

function sIcon(status: OrderStatus) {
  const map: Partial<Record<OrderStatus, React.ReactNode>> = {
    pending_payment: <Clock className="h-3.5 w-3.5" />,
    pending: <Clock className="h-3.5 w-3.5" />,
    paid: <CreditCard className="h-3.5 w-3.5" />,
    confirmed: <CheckCircle2 className="h-3.5 w-3.5" />,
    preparing: <Package className="h-3.5 w-3.5" />,
    ready_to_ship: <Truck className="h-3.5 w-3.5" />,
    shipped: <Send className="h-3.5 w-3.5" />,
    delivered: <CheckCircle2 className="h-3.5 w-3.5" />,
    cancelled: <XCircle className="h-3.5 w-3.5" />,
    refunded: <RotateCcw className="h-3.5 w-3.5" />,
    failed: <AlertTriangle className="h-3.5 w-3.5" />,
  }
  return map[status] ?? <Package className="h-3.5 w-3.5" />
}

function StatusBadge({ status, size = 'sm' }: { status: OrderStatus; size?: 'sm' | 'md' }) {
  const m = sMeta(status)
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-semibold',
      m.color, m.bgColor, m.borderColor,
      size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2.5 py-1 text-[11px]'
    )}>
      {sIcon(status)} {m.label}
    </span>
  )
}

function ElapsedTimeBadge({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(createdAt).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [createdAt])

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  const isUrgent = elapsed > 3600
  const isWarning = elapsed > 1200

  return (
    <div className={cn(
      'rounded-2xl border p-4 flex flex-col items-center gap-2 text-center',
      isUrgent ? 'bg-red-50 border-red-200' : isWarning ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
    )}>
      <p className={cn(
        'text-[10px] font-bold uppercase tracking-widest',
        isUrgent ? 'text-red-500' : isWarning ? 'text-amber-600' : 'text-emerald-600'
      )}>
        Tiempo transcurrido
      </p>
      <p className={cn(
        'font-mono text-2xl font-bold tabular-nums tracking-tight',
        isUrgent ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-emerald-700'
      )}>
        {h > 0 && <><span>{pad(h)}</span><span className="opacity-50 text-lg">h</span>{' '}</>}
        <span>{pad(m)}</span><span className="opacity-50 text-lg">m</span>{' '}
        <span>{pad(s)}</span><span className="opacity-50 text-lg">s</span>
      </p>
      <p className={cn(
        'text-[10px]',
        isUrgent ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-emerald-500'
      )}>
        {isUrgent ? '⚠️ Requiere atención' : isWarning ? 'En espera' : 'Recién creado'}
      </p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [order, setOrder] = useState<Order | null>(null)
  const [adjacent, setAdjacent] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null })
  const [loading, setLoading] = useState(true)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [note, setNote] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  const fetchOrder = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${id}`)
      const json = await res.json() as { data?: { order: Order; adjacent: { prev: string | null; next: string | null } }; error?: string }
      if (!res.ok || !json.data) { toast.error(json.error ?? 'Pedido no encontrado'); return }
      setOrder(json.data.order)
      setAdjacent(json.data.adjacent)
    } catch { toast.error('Error de conexión') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetchOrder() }, [fetchOrder])

  const confirmOrder = async (nextStatus: OrderStatus) => {
    if (!order) return
    setConfirmLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const json = await res.json() as { error?: string; data?: { order: Order } }
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(`Pedido actualizado: ${sMeta(nextStatus).label}`)
      if (json.data?.order) setOrder(json.data.order)
    } catch { toast.error('Error') }
    finally { setConfirmLoading(false) }
  }

  const doCancelOrder = async () => {
    if (!order) return
    setCancelLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', note: cancelReason || 'Cancelado por administrador' }),
      })
      const json = await res.json() as { error?: string; data?: { order: Order } }
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success('Pedido cancelado')
      setCancelOpen(false)
      if (json.data?.order) setOrder(json.data.order)
    } catch { toast.error('Error') }
    finally { setCancelLoading(false) }
  }

  const addNote = async () => {
    if (!order || !note.trim()) return
    setNoteLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: note.trim() }),
      })
      if (!res.ok) { toast.error('Error al agregar nota'); return }
      toast.success('Nota agregada')
      setNote('')
      fetchOrder()
    } catch { toast.error('Error') }
    finally { setNoteLoading(false) }
  }

  const copyAddress = () => {
    if (!order?.delivery_address) return
    navigator.clipboard.writeText(order.delivery_address)
    toast.success('Dirección copiada')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-32">
        <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">Pedido no encontrado</p>
        <Link href="/admin/pedidos" className="text-sm text-primary-cyan hover:underline mt-2 inline-block">Volver al listado</Link>
      </div>
    )
  }

  const items = (order.items ?? []) as OrderItem[]
  const updates = (order.updates ?? []) as OrderUpdate[]
  const canCancel = CANCELLABLE_STATUSES.includes(order.status)
  const nextStatuses = (VALID_STATUS_TRANSITIONS[order.status] ?? []).filter(
    (s) => s !== 'cancelled' && s !== 'refunded'
  ) as OrderStatus[]
  const nextStatus = nextStatuses[0] ?? null

  const createdDate = new Date(order.created_at)
  const createdDateStr = createdDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  const createdTimeStr = createdDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <div className="space-y-4">
      {/* Top navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/pedidos" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition">
            <ArrowLeft className="h-4 w-4" /> Pedidos
          </Link>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-sm font-bold text-primary-dark">{order.short_id}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {adjacent.prev && (
            <Link href={`/admin/pedidos/${adjacent.prev}`} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition" title="Pedido anterior">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          )}
          {adjacent.next && (
            <Link href={`/admin/pedidos/${adjacent.next}`} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition" title="Pedido siguiente">
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-gray-100 bg-white shadow-sm px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={order.status} size="md" />
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {createdDateStr} · {createdTimeStr}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/admin/pedidos/print?ids=${order.id}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            <Printer className="h-4 w-4" /> Imprimir
          </a>

          {nextStatus && (
            <button
              type="button"
              onClick={() => { void confirmOrder(nextStatus) }}
              disabled={confirmLoading}
              className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-primary-dark px-4 text-sm font-semibold text-white hover:bg-primary-dark/90 transition disabled:opacity-60"
            >
              {confirmLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <>{sIcon(nextStatus)} Confirmar pedido</>
              }
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={() => { setCancelReason(''); setCancelOpen(true) }}
              className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-red-200 bg-white px-3 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition"
            >
              <Ban className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">

        {/* LEFT — order details, client, address, payment */}
        <div className="space-y-4">

          {/* Products table + totals */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Detalle del pedido</p>
              <span className="text-xs text-gray-400 tabular-nums">{items.length} {items.length === 1 ? 'producto' : 'productos'}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                  <TableHead className="w-12" />
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">Producto</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-center">Cant.</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Precio</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={i} className="border-b">
                    <TableCell>
                      <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                        {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="h-5 w-5 text-gray-300" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      {item.sku && <p className="text-[11px] text-gray-400 mt-0.5">{item.sku}</p>}
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatPrice(item.unit_price)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">{formatPrice(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-gray-100 px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="tabular-nums">{formatPrice(order.subtotal)}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Descuento</span><span className="tabular-nums text-red-600">-{formatPrice(order.discount)}</span></div>}
              {order.coupon_discount > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Cupón {order.coupon_code && `(${order.coupon_code})`}</span><span className="tabular-nums text-red-600">-{formatPrice(order.coupon_discount)}</span></div>}
              <div className="flex justify-between text-sm"><span className="text-gray-500">Envío</span><span className="tabular-nums">{order.shipping_fee === 0 ? 'Gratis' : formatPrice(order.shipping_fee)}</span></div>
              {(order.tax ?? 0) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Impuestos</span><span className="tabular-nums">{formatPrice(order.tax ?? 0)}</span></div>}
              <Separator />
              <div className="flex justify-between text-base font-bold"><span>Total</span><span className="tabular-nums">{formatPrice(order.total)}</span></div>
            </div>
          </div>

          {/* Client info */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Información del cliente</p>
            <p className="text-sm font-semibold text-gray-900">{order.customer_name ?? '—'}</p>
            <div className="flex flex-col gap-2">
              {order.customer_email && (
                <a href={`mailto:${order.customer_email}`} className="flex items-center gap-2 text-xs text-gray-600 hover:text-primary-cyan transition">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" /> {order.customer_email}
                </a>
              )}
              {order.customer_phone && (
                <a href={`tel:${order.customer_phone}`} className="flex items-center gap-2 text-xs text-gray-600 hover:text-primary-cyan transition">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" /> {formatPhone(order.customer_phone)}
                </a>
              )}
            </div>
          </div>

          {/* Shipping address */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Dirección de envío</p>
              <button type="button" onClick={copyAddress} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition" title="Copiar dirección">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-700 leading-relaxed">{order.delivery_address ?? '—'}</p>
                {order.delivery_instructions && <p className="text-[11px] text-gray-400 mt-1 italic">{order.delivery_instructions}</p>}
              </div>
            </div>
            {order.shipping_method && (
              <p className="text-xs text-gray-500"><span className="font-medium">Método:</span> {order.shipping_method}</p>
            )}
          </div>

          {/* Payment */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Método de pago</p>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                {PAYMENT_METHOD_LABELS[order.payment_method ?? ''] ?? order.payment_method ?? '—'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                order.payment_status === 'paid' ? 'text-emerald-700 bg-emerald-50 border-emerald-300'
                  : order.payment_status === 'refunded' ? 'text-gray-600 bg-gray-50 border-gray-300'
                  : 'text-yellow-700 bg-yellow-50 border-yellow-300'
              )}>
                {order.payment_status === 'paid' ? 'Pagado' : order.payment_status === 'refunded' ? 'Reembolsado' : 'Pendiente'}
              </span>
              {order.paid_at && <span className="text-[10px] text-gray-400">{formatDate(order.paid_at)}</span>}
            </div>
            {order.payment_reference && (
              <p className="text-[11px] text-gray-400 font-mono truncate">Ref: {order.payment_reference}</p>
            )}
            {order.stripe_payment_intent_id && (
              <p className="text-[11px] text-gray-400 font-mono truncate">PI: {order.stripe_payment_intent_id}</p>
            )}
          </div>
        </div>

        {/* RIGHT — elapsed time + history + notes */}
        <div className="space-y-4">

          {/* Elapsed time badge */}
          <ElapsedTimeBadge createdAt={order.created_at} />

          {/* Activity history / timeline */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Historial de actividad</p>
            </div>
            <div className="p-5">
              {updates.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Sin actividad registrada</p>
              ) : (
                <div className="relative pl-7 space-y-4">
                  <div className="absolute left-2.5 top-1 bottom-1 w-px bg-gray-200" />
                  {updates.map((u) => {
                    const isNote = (u.metadata as Record<string, unknown> | null)?.type === 'note'
                    return (
                      <div key={u.id} className="relative">
                        <div className={cn(
                          'absolute -left-7 top-0.5 flex h-5 w-5 items-center justify-center rounded-full',
                          isNote ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'
                        )}>
                          {isNote ? <MessageSquare className="h-2.5 w-2.5" /> : sIcon(u.status as OrderStatus)}
                        </div>
                        <div>
                          <p className="text-xs text-gray-800 leading-snug">{u.message}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(u.created_at)} · {u.updated_by ?? 'sistema'}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Notas internas</p>
            <div className="flex gap-2">
              <Input
                className="flex-1 h-9 text-sm rounded-xl border-gray-200"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Escribir nota…"
                onKeyDown={(e) => { if (e.key === 'Enter') { void addNote() } }}
              />
              <Button onClick={() => { void addNote() }} disabled={noteLoading || !note.trim()} className="h-9 rounded-xl text-sm px-3">
                {noteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            {updates.filter((u) => (u.metadata as Record<string, unknown> | null)?.type === 'note').length > 0 && (
              <div className="space-y-2 pt-1">
                {updates.filter((u) => (u.metadata as Record<string, unknown> | null)?.type === 'note').map((u) => (
                  <div key={u.id} className="rounded-lg bg-amber-50/50 border border-amber-100 p-2.5">
                    <p className="text-xs text-gray-700">{u.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{formatDate(u.created_at)} · {u.updated_by ?? 'admin'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel order confirmation */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-2xl duration-200">
          <div className="p-5 space-y-4">
            <DialogTitle className="text-base font-semibold text-red-700">Cancelar pedido</DialogTitle>
            <p className="text-sm text-gray-600">
              Esta acción no se puede deshacer. El pedido <span className="font-mono font-bold">{order.short_id}</span> será cancelado.
            </p>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Motivo de cancelación</label>
              <Input
                className="h-9 text-sm rounded-xl border-gray-200"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Explica el motivo…"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setCancelOpen(false)} className="flex-1 h-9 rounded-xl text-sm">Volver</Button>
              <Button
                onClick={() => { void doCancelOrder() }}
                disabled={cancelLoading}
                className="flex-1 h-9 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white"
              >
                {cancelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancelar pedido'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
