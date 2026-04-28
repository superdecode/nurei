'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Search, X, RefreshCcw, Download, ChevronLeft, ChevronRight,
  Package, Eye, MoreHorizontal, Printer, ChevronDown, ChevronUp,
  MessageSquare, MapPin, Phone, Mail, Clock, FileText, Loader2,
  Check, Minus, CreditCard, Truck, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, Copy, Send, Ban, RotateCcw, Filter,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'

import type { Order, OrderStatus, OrderItem, OrderUpdate } from '@/types'
import { ORDER_STATUS_MAP, VALID_STATUS_TRANSITIONS, PAYMENT_METHOD_LABELS, CANCELLABLE_STATUSES } from '@/lib/utils/constants'
import type { StatusMeta } from '@/lib/utils/constants'
import { formatPrice, formatDate, formatRelativeTime, formatPhone } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { AnchoredFilterPanel } from '@/components/admin/AnchoredFilterPanel'

// ── Status-aware primary action label ───────────────────────────────────
const STATUS_PRIMARY_ACTION: Partial<Record<OrderStatus, string>> = {
  paid: 'Aceptar pedido',
  preparing: 'Marcar en camino',
  shipped: 'Marcar entregado',
}

function playSuccessAudio(): void {
  const el = document.getElementById('nurei-success-sound') as HTMLAudioElement | null
  if (!el) return
  el.currentTime = 0
  el.play().catch(() => {/* blocked by browser policy */})
}

// ── Helpers ──────────────────────────────────────────────────────────────

function statusMeta(status: OrderStatus): StatusMeta {
  return ORDER_STATUS_MAP[status] ?? { label: status, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-300' }
}

function statusIcon(status: OrderStatus) {
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

function StatusBadge({ status }: { status: OrderStatus }) {
  const m = statusMeta(status)
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', m.color, m.bgColor, m.borderColor)}>
      {statusIcon(status)}
      {m.label}
    </span>
  )
}

const ALL_STATUSES: OrderStatus[] = [
  'pending_payment', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded',
]

// Tab groups: "active" statuses that need operator attention vs. done/cancelled
const STATUS_TABS: Array<{ key: OrderStatus | 'all'; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'pending_payment', label: 'Pendiente de pago' },
  { key: 'paid', label: 'Pendiente' },
  { key: 'preparing', label: 'Procesando' },
  { key: 'shipped', label: 'En camino' },
  { key: 'delivered', label: 'Entregado' },
  { key: 'cancelled', label: 'Cancelado' },
  { key: 'refunded', label: 'Reembolsado' },
]

// ── Types ────────────────────────────────────────────────────────────────

interface ApiList {
  orders: Order[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ── Component ────────────────────────────────────────────────────────────

export default function PedidosAdminPage() {
  // Data
  const [data, setData] = useState<ApiList>({ orders: [], total: 0, page: 1, pageSize: 20, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})

  // Filters
  const [search, setSearch] = useState('')
  const [searchApplied, setSearchApplied] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [orderTypeFilter, setOrderTypeFilter] = useState('') // 'single' | 'multi'
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Smart filter panel open state
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (filterRef.current?.contains(t)) return
      if (filterPanelRef.current?.contains(t)) return
      setFilterOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Applied filter chips (for header display)
  const activeFilters = useMemo(() => {
    const f: Array<{ id: string; label: string; onRemove: () => void }> = []
    if (statusFilter) f.push({ id: 'status', label: statusMeta(statusFilter as OrderStatus).label, onRemove: () => { setStatusFilter(''); setPage(1) } })
    if (paymentFilter) f.push({ id: 'pay', label: PAYMENT_METHOD_LABELS[paymentFilter] ?? paymentFilter, onRemove: () => { setPaymentFilter(''); setPage(1) } })
    if (orderTypeFilter) f.push({ id: 'otype', label: orderTypeFilter === 'single' ? 'Producto único' : 'Multi-producto', onRemove: () => { setOrderTypeFilter(''); setPage(1) } })
    if (searchApplied) f.push({ id: 'search', label: `"${searchApplied}"`, onRemove: () => { setSearch(''); setSearchApplied(''); setPage(1) } })
    return f
  }, [statusFilter, paymentFilter, orderTypeFilter, searchApplied])

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerOrder, setDrawerOrder] = useState<Order | null>(null)
  const [drawerNote, setDrawerNote] = useState('')
  const [drawerNoteLoading, setDrawerNoteLoading] = useState(false)

  // Status change confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null)
  const [confirmNewStatus, setConfirmNewStatus] = useState<OrderStatus | ''>('')
  const [confirmNote, setConfirmNote] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Export
  const [exportOpen, setExportOpen] = useState(false)
  const [exportStatus, setExportStatus] = useState('')
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exporting, setExporting] = useState(false)

  // Selected for bulk print
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ── Fetch ────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(p))
      params.set('pageSize', '20')
      params.set('sortBy', sortBy)
      params.set('sortDir', sortDir)
      if (searchApplied) params.set('search', searchApplied)
      if (statusFilter) params.set('status', statusFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const res = await fetch(`/api/admin/orders?${params}`)
      const json = await res.json() as { data?: ApiList; error?: string }
      if (!res.ok || !json.data) {
        toast.error(json.error ?? 'Error al cargar pedidos')
        return
      }
      setData(json.data)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [searchApplied, statusFilter, dateFrom, dateTo, sortBy, sortDir, page])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetchWithCredentials('/api/admin/orders/counts')
      const json = await res.json() as { data?: Record<string, number> }
      if (json.data) setStatusCounts(json.data)
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchCounts() }, [fetchCounts])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setSearchApplied(search.trim()); setPage(1) }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
    setPage(1)
  }

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => {
    const active = sortBy === col
    return (
      <button type="button" onClick={() => toggleSort(col)} className={cn('flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider', active ? 'text-primary-cyan' : 'text-gray-500 hover:text-gray-700')}>
        {children}
        {active ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
      </button>
    )
  }

  // ── Inline status change (from table) ─────────────────────────────

  const openStatusConfirm = (order: Order, newStatus: OrderStatus) => {
    setConfirmOrder(order)
    setConfirmNewStatus(newStatus)
    setConfirmNote('')
    setConfirmOpen(true)
  }

  const executeStatusChange = async () => {
    if (!confirmOrder || !confirmNewStatus) return
    setConfirmLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${confirmOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: confirmNewStatus, note: confirmNote || undefined }),
      })
      const json = await res.json() as { error?: string; data?: { order: Order } }
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(`Estatus cambiado a ${statusMeta(confirmNewStatus as OrderStatus).label}`)
      playSuccessAudio()
      setConfirmOpen(false)
      if (drawerOrder?.id === confirmOrder.id && json.data?.order) setDrawerOrder(json.data.order)
      fetchOrders()
      fetchCounts()
    } catch { toast.error('Error de conexión') }
    finally { setConfirmLoading(false) }
  }

  // ── Drawer ────────────────────────────────────────────────────────

  const openDrawer = async (order: Order) => {
    setDrawerOpen(true)
    setDrawerNote('')
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`)
      const json = await res.json() as { data?: { order: Order } }
      setDrawerOrder(json.data?.order ?? order)
    } catch {
      setDrawerOrder(order)
    }
  }

  const addDrawerNote = async () => {
    if (!drawerOrder || !drawerNote.trim()) return
    setDrawerNoteLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${drawerOrder.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: drawerNote.trim() }),
      })
      if (!res.ok) { toast.error('Error al agregar nota'); return }
      toast.success('Nota agregada')
      setDrawerNote('')
      const refetch = await fetch(`/api/admin/orders/${drawerOrder.id}`)
      const json = await refetch.json() as { data?: { order: Order } }
      if (json.data?.order) setDrawerOrder(json.data.order)
    } catch { toast.error('Error') }
    finally { setDrawerNoteLoading(false) }
  }

  // ── Export ────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (exportStatus) params.set('status', exportStatus)
      if (exportFrom) params.set('dateFrom', exportFrom)
      if (exportTo) params.set('dateTo', exportTo)
      const res = await fetch(`/api/admin/orders/export?${params}`)
      if (!res.ok) { toast.error('Error al exportar'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pedidos_nurei_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setExportOpen(false)
      toast.success('Archivo descargado')
    } catch { toast.error('Error de conexión') }
    finally { setExporting(false) }
  }

  // ── Bulk print ────────────────────────────────────────────────────

  const handleBulkPrint = () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds).join(',')
    window.location.href = `/admin/pedidos/print?ids=${ids}&type=surtido&autoprint=1`
  }

  // ── Date quick chips ──────────────────────────────────────────────
  const setDateChip = (chip: 'today' | 'week' | 'month') => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const today = fmt(new Date())
    if (chip === 'today') { setDateFrom(today); setDateTo(today) }
    else if (chip === 'week') {
      const d2 = new Date(); const day = d2.getDay()
      d2.setDate(d2.getDate() - day + (day === 0 ? -6 : 1))
      setDateFrom(fmt(d2)); setDateTo(today)
    }
    else { setDateFrom(fmt(new Date(now.getFullYear(), now.getMonth(), 1))); setDateTo(today) }
    setPage(1)
  }

  const activeDateChip = useMemo(() => {
    if (!dateFrom && !dateTo) return ''
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const today = fmt(new Date())
    if (dateFrom === today && dateTo === today) return 'today'
    const d2 = new Date(); d2.setDate(d2.getDate() - d2.getDay() + (d2.getDay() === 0 ? -6 : 1))
    if (dateFrom === fmt(d2) && dateTo === today) return 'week'
    if (dateFrom === fmt(new Date(now.getFullYear(), now.getMonth(), 1)) && dateTo === today) return 'month'
    return 'custom'
  }, [dateFrom, dateTo])

  // ── Selection helpers ─────────────────────────────────────────────

  const allPageSelected = data.orders.length > 0 && data.orders.every((o) => selectedIds.has(o.id))
  const somePageSelected = !allPageSelected && data.orders.some((o) => selectedIds.has(o.id))

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const toggleSelectAll = () => {
    if (allPageSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(data.orders.map((o) => o.id)))
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header row: title | date chips + filter chips + actions ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold text-primary-dark">Pedidos</h1>
          <p className="text-sm text-gray-400 mt-0.5">{data.total} pedido{data.total !== 1 ? 's' : ''}</p>
        </div>

        {/* Right side: date chips + applied chips + action buttons — extends horizontally */}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {/* Date quick chips */}
          {[{id:'today',l:'Hoy'},{id:'week',l:'Esta semana'},{id:'month',l:'Este mes'}].map(({id,l}) => (
            <button
              key={id}
              type="button"
              onClick={() => activeDateChip === id ? (setDateFrom(''), setDateTo(''), setPage(1)) : setDateChip(id as 'today'|'week'|'month')}
              className={cn('flex items-center h-8 px-3 rounded-full text-xs font-semibold border transition-all whitespace-nowrap',
                activeDateChip === id ? 'bg-primary-dark text-white border-primary-dark shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              {l}
            </button>
          ))}

          {/* Date range pill */}
          <div className="flex items-center rounded-full border border-gray-200 bg-white h-8 shadow-sm overflow-hidden">
            <div className="flex items-center gap-1 px-2.5">
              <Clock className="h-3 w-3 text-gray-400 shrink-0" />
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="text-[11px] text-gray-600 bg-transparent outline-none w-[92px] cursor-pointer" />
            </div>
            <span className="text-gray-300 text-xs px-0.5">–</span>
            <div className="flex items-center gap-1 px-2.5">
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="text-[11px] text-gray-600 bg-transparent outline-none w-[92px] cursor-pointer" />
            </div>
            {(dateFrom || dateTo) && (
              <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }} className="pr-2.5 text-gray-400 hover:text-gray-600">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Actions */}
          {selectedIds.size > 0 && (
            <Button variant="outline" onClick={handleBulkPrint} className="gap-1.5 h-8 rounded-full text-xs font-semibold">
              <Printer className="h-3.5 w-3.5" /> Surtido ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" onClick={() => setExportOpen(true)} className="gap-1.5 h-8 rounded-full text-xs font-semibold">
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
          <Button variant="outline" onClick={() => fetchOrders()} className="gap-1 h-8 w-8 rounded-full p-0">
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Status tabs ── */}
      <div className="flex items-start gap-0 overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm px-2 py-2 scrollbar-none">
        {STATUS_TABS.map((tab) => {
          const count = tab.key === 'all'
            ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
            : tab.key === 'paid'
              ? (statusCounts.paid ?? 0) + (statusCounts.confirmed ?? 0)
              : tab.key === 'pending_payment'
                ? (statusCounts.pending ?? 0)
              : statusCounts[tab.key] ?? 0
          const active = statusFilter === (tab.key === 'all' ? '' : tab.key)
          const m = tab.key !== 'all' ? statusMeta(tab.key as OrderStatus) : null
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setStatusFilter(tab.key === 'all' ? '' : tab.key); setPage(1) }}
              className={cn(
                'flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap',
                active
                  ? m
                    ? cn(m.bgColor, m.color, 'shadow-sm ring-1', m.borderColor.replace('border', 'ring'))
                    : 'bg-primary-dark text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              )}
            >
              {tab.label}
              <span className={cn(
                'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black transition-all',
                active
                  ? m ? 'bg-white/60 text-inherit' : 'bg-white/20 text-white'
                  : count > 0 ? 'bg-gray-100 text-gray-600' : 'text-gray-300'
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Search first, luego Filtrar + chips ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search bar */}
        <div className="relative min-w-[min(100%,220px)] flex-1 basis-[220px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            className="h-10 pl-10 pr-10 text-sm bg-white border-gray-200 rounded-full focus-visible:ring-2 focus-visible:ring-orange-400/30 focus-visible:border-orange-400/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearchApplied(search.trim()); setPage(1) } }}
            placeholder="Buscar por orden, cliente, email…"
          />
          {search && (
            <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => { setSearch(''); setSearchApplied(''); setPage(1) }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button type="button" className="h-10 shrink-0 px-5 text-sm font-semibold rounded-full" onClick={() => { setSearchApplied(search.trim()); setPage(1) }}>
          Buscar
        </Button>

        {/* Smart filter button + panel */}
        <div className="relative shrink-0" ref={filterRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={cn('flex items-center gap-1.5 h-10 px-4 rounded-full border text-sm font-semibold transition-all',
              filterOpen || activeFilters.length > 0 ? 'bg-primary-dark text-white border-primary-dark shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            )}
          >
            <Filter className="h-4 w-4" />
            Filtrar
            {activeFilters.length > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-orange-400 text-[10px] font-black text-white">{activeFilters.length}</span>
            )}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', filterOpen ? 'rotate-180' : '')} />
          </button>

          <AnchoredFilterPanel ref={filterPanelRef} open={filterOpen} anchorRef={filterRef} maxWidth={288}>
                <div className="p-4 space-y-4">
                  {/* Estado */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                      <Package className="h-3 w-3" /> Estado
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(['pending_payment','paid','preparing','shipped','delivered','cancelled'] as const).map((s) => {
                        const m = statusMeta(s)
                        return (
                          <button key={s} type="button" onClick={() => { setStatusFilter(statusFilter === s ? '' : s); setPage(1) }}
                            className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                              statusFilter === s ? `${m.bgColor} ${m.color} ${m.borderColor}` : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                            )}>
                            {statusIcon(s)} {m.label}
                            {statusFilter === s && <Check className="h-2.5 w-2.5 ml-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Pago */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                      <CreditCard className="h-3 w-3" /> Método de pago
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                        <button key={v} type="button" onClick={() => { setPaymentFilter(paymentFilter === v ? '' : v); setPage(1) }}
                          className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                            paymentFilter === v ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                          )}>
                          {l} {paymentFilter === v && <Check className="h-2.5 w-2.5" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tipo */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                      <Package className="h-3 w-3" /> Tipo de pedido
                    </p>
                    <div className="flex gap-1.5">
                      {[{v:'single',l:'Producto único'},{v:'multi',l:'Múltiples'}].map(({v,l}) => (
                        <button key={v} type="button" onClick={() => { setOrderTypeFilter(orderTypeFilter === v ? '' : v); setPage(1) }}
                          className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                            orderTypeFilter === v ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                          )}>
                          {l} {orderTypeFilter === v && <Check className="h-2.5 w-2.5" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeFilters.length > 0 && (
                    <button type="button" onClick={() => { setStatusFilter(''); setPaymentFilter(''); setOrderTypeFilter(''); setPage(1); setFilterOpen(false) }}
                      className="w-full text-center text-xs text-gray-400 hover:text-red-500 transition pt-1 border-t border-gray-100">
                      Limpiar filtros
                    </button>
                  )}
                </div>
          </AnchoredFilterPanel>
        </div>

        {/* Chips junto a Filtrar */}
        {activeFilters.length > 0 && (
          <div className="min-w-0 max-w-[min(100%,40rem)] grow-0 shrink max-h-[4.75rem] overflow-y-auto overscroll-y-contain rounded-xl border border-orange-100 bg-orange-50/50 px-2 py-1.5">
            <div className="flex flex-wrap content-start gap-1.5 gap-y-1">
              {activeFilters.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1 h-7 max-w-full rounded-full bg-orange-50 border border-orange-200 px-2.5 text-[11px] font-semibold text-orange-800 shrink-0">
                  <span className="truncate max-w-[14rem]">{f.label}</span>
                  <button type="button" onClick={f.onRemove} className="opacity-70 hover:opacity-100 shrink-0" aria-label="Quitar filtro">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
              <TableHead className="w-10 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                <button type="button" onClick={toggleSelectAll} className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-colors', allPageSelected ? 'bg-primary-cyan border-primary-cyan' : somePageSelected ? 'bg-primary-cyan/20 border-primary-cyan/60' : 'border-gray-300 hover:border-gray-400')}>
                  {allPageSelected && <Check className="w-3 h-3 text-primary-dark" />}
                  {somePageSelected && <Minus className="w-3 h-3 text-primary-dark/70" />}
                </button>
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500"><SortHeader col="short_id">Orden</SortHeader></TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500"><SortHeader col="created_at">Fecha</SortHeader></TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500"><SortHeader col="total">Total</SortHeader></TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Pago</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Estatus</TableHead>
              <TableHead className="w-20 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="w-4 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-20 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-24 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-28 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-16 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-16 h-4 bg-gray-100 rounded-full animate-pulse" /></TableCell>
                  <TableCell><div className="w-24 h-5 bg-gray-100 rounded-full animate-pulse" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : data.orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="py-16 text-center">
                    <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 font-medium">No se encontraron pedidos</p>
                    <p className="text-xs text-gray-400 mt-1">Intenta cambiar los filtros</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.orders.map((order) => {
                const items = (order.items ?? []) as OrderItem[]
                return (
                  <TableRow
                    key={order.id}
                    className={cn('border-b transition-colors group cursor-pointer', selectedIds.has(order.id) ? 'bg-primary-cyan/5' : 'hover:bg-gray-50/80')}
                    onClick={() => openDrawer(order)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => toggleSelect(order.id)} className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-colors', selectedIds.has(order.id) ? 'bg-primary-cyan border-primary-cyan' : 'border-gray-300 hover:border-gray-400')}>
                        {selectedIds.has(order.id) && <Check className="w-3 h-3 text-primary-dark" />}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold text-primary-dark">{order.short_id}</span>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-gray-700">{formatDate(order.created_at)}</p>
                      <p className="text-[11px] text-gray-400">{formatRelativeTime(order.created_at)}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{order.customer_name ?? '—'}</p>
                      <p className="text-[11px] text-gray-400 truncate max-w-[160px]">{items.length} producto{items.length !== 1 ? 's' : ''}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold tabular-nums">{formatPrice(order.total)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-500">{PAYMENT_METHOD_LABELS[order.payment_method ?? ''] ?? order.payment_method ?? '—'}</span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="focus:outline-none">
                          <StatusBadge status={order.status} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          {(VALID_STATUS_TRANSITIONS[order.status] ?? []).map((ns: OrderStatus) => (
                            <DropdownMenuItem key={ns} onClick={() => openStatusConfirm(order, ns)} className="gap-2 text-sm cursor-pointer">
                              {statusIcon(ns)}
                              {statusMeta(ns).label}
                            </DropdownMenuItem>
                          ))}
                          {(VALID_STATUS_TRANSITIONS[order.status] ?? []).length === 0 && (
                            <DropdownMenuItem disabled className="text-xs text-gray-400">Sin transiciones disponibles</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => openDrawer(order)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition" title="Vista rápida">
                          <Eye className="h-4 w-4" />
                        </button>
                        <Link href={`/admin/pedidos/${order.id}`} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition" title="Detalle completo">
                          <FileText className="h-4 w-4" />
                        </Link>
                        <button type="button" onClick={() => { window.location.href = `/admin/pedidos/print?ids=${order.id}` }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition" title="Surtido / Imprimir">
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">
              {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} de {data.total}
            </p>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-7 rounded-lg text-xs">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: Math.min(data.totalPages, 7) }).map((_, i) => {
                const p = i + 1
                return (
                  <Button key={p} variant={page === p ? 'default' : 'outline'} size="sm" onClick={() => setPage(p)} className="h-7 w-7 rounded-lg text-xs p-0">
                    {p}
                  </Button>
                )
              })}
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="h-7 rounded-lg text-xs">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick Drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/40"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header: order ID + status left, actions right */}
              <div className="flex items-start justify-between border-b border-gray-100 px-5 py-3.5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pedido</p>
                  <p className="text-xl font-black text-primary-dark font-mono leading-tight mt-0.5">
                    {drawerOrder?.short_id ?? '—'}
                  </p>
                  {drawerOrder && (
                    <div className="mt-1.5">
                      <StatusBadge status={drawerOrder.status} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 ml-3 shrink-0">
                  {drawerOrder && (
                    <>
                      <button
                        type="button"
                        onClick={() => window.open(`/admin/pedidos/print?ids=${drawerOrder.id}&type=ticket`, '_blank')}
                        className="flex items-center gap-1 h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition shadow-sm"
                        title="Imprimir ticket"
                      >
                        <Printer className="h-3.5 w-3.5" /> Ticket
                      </button>
                      <button
                        type="button"
                        onClick={() => { window.location.href = `/admin/pedidos/print?ids=${drawerOrder.id}&type=surtido&autoprint=1` }}
                        className="flex items-center gap-1 h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition shadow-sm"
                        title="Hoja de surtido"
                      >
                        <FileText className="h-3.5 w-3.5" /> Surtido
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition ml-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Drawer body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {!drawerOrder ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                ) : (
                  <>
                    {/* Action buttons — stacked on mobile, side-by-side on desktop */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      {/* Primary action button — status-aware */}
                      {(() => {
                        const nextCandidates = (VALID_STATUS_TRANSITIONS[drawerOrder.status] ?? []).filter(s => s !== 'cancelled' && s !== 'refunded')
                        if (nextCandidates.length === 0) return null
                        const nextStatus = nextCandidates[0] as OrderStatus
                        const actionLabel = STATUS_PRIMARY_ACTION[drawerOrder.status] ?? `Cambiar a ${statusMeta(nextStatus).label}`
                        return (
                          <button
                            type="button"
                            onClick={() => openStatusConfirm(drawerOrder, nextStatus)}
                            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl bg-primary-dark px-4 text-sm font-semibold text-white hover:bg-primary-dark/90 transition"
                          >
                            {statusIcon(nextStatus)}
                            {actionLabel}
                          </button>
                        )
                      })()}
                      {/* Cancel button — only when cancellation is allowed */}
                      {CANCELLABLE_STATUSES.includes(drawerOrder.status as OrderStatus) && (
                        <button
                          type="button"
                          onClick={() => openStatusConfirm(drawerOrder, 'cancelled')}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-9 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 hover:bg-red-100 transition"
                        >
                          <XCircle className="h-4 w-4" />
                          Cancelar
                        </button>
                      )}
                    </div>
                    {/* Customer */}
                    <div className="rounded-xl border border-gray-100 p-4 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Cliente</p>
                      <p className="text-sm font-semibold text-gray-900">{drawerOrder.customer_name ?? '—'}</p>
                      {drawerOrder.customer_email && (
                        <p className="flex items-center gap-1.5 text-xs text-gray-500"><Mail className="h-3 w-3" /> {drawerOrder.customer_email}</p>
                      )}
                      {drawerOrder.customer_phone && (
                        <p className="flex items-center gap-1.5 text-xs text-gray-500"><Phone className="h-3 w-3" /> {formatPhone(drawerOrder.customer_phone)}</p>
                      )}
                    </div>

                    {/* Products */}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Productos</p>
                      <div className="space-y-2">
                        {((drawerOrder.items ?? []) as OrderItem[]).map((item, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                              {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="h-4 w-4 text-gray-300" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                              <p className="text-[11px] text-gray-400">{item.quantity} × {formatPrice(item.unit_price)}</p>
                            </div>
                            <p className="text-sm font-semibold tabular-nums">{formatPrice(item.subtotal)}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="rounded-xl border border-gray-100 p-4 space-y-1.5">
                      <div className="flex justify-between text-xs"><span className="text-gray-500">Subtotal</span><span className="tabular-nums">{formatPrice(drawerOrder.subtotal)}</span></div>
                      {drawerOrder.discount > 0 && <div className="flex justify-between text-xs"><span className="text-gray-500">Descuento</span><span className="tabular-nums text-red-600">-{formatPrice(drawerOrder.discount)}</span></div>}
                      {drawerOrder.coupon_discount > 0 && <div className="flex justify-between text-xs"><span className="text-gray-500">Cupón ({drawerOrder.coupon_code})</span><span className="tabular-nums text-red-600">-{formatPrice(drawerOrder.coupon_discount)}</span></div>}
                      <div className="flex justify-between text-xs"><span className="text-gray-500">Envío</span><span className="tabular-nums">{drawerOrder.shipping_fee === 0 ? 'Gratis' : formatPrice(drawerOrder.shipping_fee)}</span></div>
                      <Separator className="my-1" />
                      <div className="flex justify-between text-sm font-bold"><span>Total</span><span className="tabular-nums">{formatPrice(drawerOrder.total)}</span></div>
                    </div>

                    {/* Address */}
                    {drawerOrder.delivery_address && (
                      <div className="rounded-xl border border-gray-100 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Envío</p>
                        <p className="text-xs text-gray-700">{drawerOrder.delivery_address}</p>
                        {drawerOrder.delivery_instructions && <p className="text-[11px] text-gray-400 mt-1 italic">{drawerOrder.delivery_instructions}</p>}
                      </div>
                    )}

                    {/* Notes input */}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Agregar nota</p>
                      <div className="flex gap-2">
                        <Input
                          className="flex-1 h-9 text-sm rounded-xl border-gray-200"
                          value={drawerNote}
                          onChange={(e) => setDrawerNote(e.target.value)}
                          placeholder="Nota interna…"
                          onKeyDown={(e) => { if (e.key === 'Enter') addDrawerNote() }}
                        />
                        <Button onClick={addDrawerNote} disabled={drawerNoteLoading || !drawerNote.trim()} className="h-9 rounded-xl text-sm px-3">
                          {drawerNoteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Timeline */}
                    {(drawerOrder.updates?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Historial</p>
                        <div className="space-y-3">
                          {drawerOrder.updates?.map((u) => (
                            <div key={u.id} className="flex gap-3">
                              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                                {statusIcon(u.status as OrderStatus)}
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-gray-700">{u.message}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(u.created_at)} · {u.updated_by ?? 'sistema'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Sticky footer */}
              {drawerOrder && (
                <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3">
                  <Link
                    href={`/admin/pedidos/${drawerOrder.id}`}
                    className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-primary-dark text-white text-sm font-semibold hover:bg-primary-dark/90 transition"
                  >
                    Ver detalles completos <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Status change confirmation modal ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-2xl duration-200">
          <div className="p-5 space-y-4">
            <DialogTitle className="text-base font-semibold text-gray-900">Confirmar cambio de estatus</DialogTitle>

            {confirmOrder && confirmNewStatus && (
              <div className="flex items-center gap-2 justify-center py-2">
                <StatusBadge status={confirmOrder.status} />
                <ArrowRight className="h-4 w-4 text-gray-400" />
                <StatusBadge status={confirmNewStatus as OrderStatus} />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nota (opcional)</label>
              <Input
                className="h-9 text-sm rounded-xl border-gray-200"
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                placeholder="Motivo del cambio…"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} className="flex-1 h-9 rounded-xl text-sm">Cancelar</Button>
              <Button onClick={() => { void executeStatusChange() }} disabled={confirmLoading} className="flex-1 h-9 rounded-xl text-sm font-semibold">
                {confirmLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Export modal ── */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-2xl duration-200">
          <div className="p-5 space-y-4">
            <DialogTitle className="text-base font-semibold text-gray-900">Exportar pedidos</DialogTitle>

            <div className="space-y-3">
              <Select value={exportStatus} onValueChange={(v) => setExportStatus(v ?? '')}>
                <SelectTrigger className="h-9 w-full text-sm rounded-xl border-gray-200">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-sm">Todos los estados</SelectItem>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="text-sm">{statusMeta(s).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Desde</label>
                  <Input type="date" className="h-9 text-sm rounded-xl border-gray-200" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Hasta</label>
                  <Input type="date" className="h-9 text-sm rounded-xl border-gray-200" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setExportOpen(false)} className="flex-1 h-9 rounded-xl text-sm">Cancelar</Button>
              <Button onClick={() => { void handleExport() }} disabled={exporting} className="flex-1 h-9 rounded-xl text-sm font-semibold gap-1.5">
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download className="h-4 w-4" /> Descargar CSV</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
