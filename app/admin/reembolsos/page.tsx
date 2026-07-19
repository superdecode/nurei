'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Search, X, RefreshCcw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  RotateCcw, Eye, FileText, ArrowRight, Mail, ShoppingBag,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

import type { OrderRefund, RefundStatus } from '@/types'
import { REFUND_STATUS_MAP, PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'
import { formatPrice, formatDate, formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

// ── Helpers ──────────────────────────────────────────────────────────────

function statusMeta(status: RefundStatus) {
  return REFUND_STATUS_MAP[status] ?? REFUND_STATUS_MAP.pending
}

function StatusBadge({ status }: { status: RefundStatus }) {
  const m = statusMeta(status)
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', m.color, m.bgColor, m.borderColor)}>
      {m.icon} {m.label}
    </span>
  )
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estatus' },
  { value: 'succeeded', label: 'Completado' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'failed', label: 'Fallido' },
] as const

const METHOD_OPTIONS = [
  { value: 'all', label: 'Todos los métodos' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'bank_transfer', label: 'Transferencia' },
  { value: 'other', label: 'Otro' },
] as const

function getPageRange(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: number[] = [1]
  if (current > 3) pages.push(0)
  const s = Math.max(2, current - 1)
  const e = Math.min(total - 1, current + 1)
  for (let i = s; i <= e; i++) pages.push(i)
  if (current < total - 2) pages.push(0)
  pages.push(total)
  return pages
}

interface ApiList {
  refunds: OrderRefund[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ── Component ────────────────────────────────────────────────────────────

export default function ReembolsosAdminPage() {
  const [data, setData] = useState<ApiList>({ refunds: [], total: 0, page: 1, pageSize: 20, totalPages: 1 })
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [searchApplied, setSearchApplied] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [sortBy, setSortBy] = useState('refunded_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerRefund, setDrawerRefund] = useState<OrderRefund | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────

  const fetchRefunds = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      params.set('sortBy', sortBy)
      params.set('sortDir', sortDir)
      if (searchApplied) params.set('search', searchApplied)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (methodFilter !== 'all') params.set('refundMethod', methodFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const res = await fetch(`/api/admin/refunds?${params}`)
      const json = await res.json() as { data?: ApiList; error?: string }
      if (!res.ok || !json.data) {
        toast.error(json.error ?? 'Error al cargar reembolsos')
        return
      }
      setData(json.data)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [searchApplied, statusFilter, methodFilter, dateFrom, dateTo, sortBy, sortDir, page])

  useEffect(() => { fetchRefunds() }, [fetchRefunds])

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

  const openDrawer = (refund: OrderRefund) => {
    setDrawerRefund(refund)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setDrawerRefund(null)
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-primary-cyan" />
            Reembolsos
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{data.total} reembolso{data.total !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="outline" onClick={() => fetchRefunds()} className="gap-1.5 h-9 rounded-full text-xs font-semibold self-start">
          <RefreshCcw className="h-3.5 w-3.5" /> Actualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative min-w-[min(100%,220px)] flex-1 basis-[220px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            className="h-10 pl-10 pr-10 text-sm bg-white border-gray-200 rounded-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearchApplied(search.trim()); setPage(1) } }}
            placeholder="Buscar por orden, cliente, motivo…"
          />
          {search && (
            <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => { setSearch(''); setSearchApplied(''); setPage(1) }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? 'all'); setPage(1) }}>
          <SelectTrigger className="w-[170px] h-10 border-gray-200 rounded-full">
            <SelectValue>{(v: string) => STATUS_OPTIONS.find((o) => o.value === v)?.label ?? 'Estatus'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v ?? 'all'); setPage(1) }}>
          <SelectTrigger className="w-[170px] h-10 border-gray-200 rounded-full">
            <SelectValue>{(v: string) => METHOD_OPTIONS.find((o) => o.value === v)?.label ?? 'Método'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {METHOD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center rounded-full border border-gray-200 bg-white h-10 shadow-sm overflow-hidden">
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="text-[11px] text-gray-600 bg-transparent outline-none w-[100px] px-3 cursor-pointer" />
          <span className="text-gray-300 text-xs px-0.5">–</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="text-[11px] text-gray-600 bg-transparent outline-none w-[100px] px-3 cursor-pointer" />
          {(dateFrom || dateTo) && (
            <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }} className="pr-3 text-gray-400 hover:text-gray-600">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500"><SortHeader col="refunded_at">Fecha</SortHeader></TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Pedido</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Cliente</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500"><SortHeader col="amount_cents">Monto</SortHeader></TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500"><SortHeader col="refund_method">Método</SortHeader></TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500"><SortHeader col="status">Estatus</SortHeader></TableHead>
              <TableHead className="w-20 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="w-24 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-20 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-28 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-16 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-16 h-4 bg-gray-100 rounded-full animate-pulse" /></TableCell>
                  <TableCell><div className="w-24 h-5 bg-gray-100 rounded-full animate-pulse" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : data.refunds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="py-16 text-center">
                    <RotateCcw className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 font-medium">No se encontraron reembolsos</p>
                    <p className="text-xs text-gray-400 mt-1">Intenta cambiar los filtros</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.refunds.map((refund) => (
                <TableRow
                  key={refund.id}
                  className="border-b transition-colors group cursor-pointer hover:bg-gray-50/80"
                  onClick={() => openDrawer(refund)}
                >
                  <TableCell>
                    <p className="text-sm text-gray-700">{formatDate(refund.refunded_at)}</p>
                    <p className="text-[11px] text-gray-400">{formatRelativeTime(refund.refunded_at)}</p>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm font-semibold text-primary-dark">{refund.order?.short_id ?? '—'}</span>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{refund.order?.customer_name ?? '—'}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-semibold tabular-nums">{formatPrice(refund.amount_cents)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-500">{PAYMENT_METHOD_LABELS[refund.refund_method] ?? refund.refund_method}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={refund.status} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => openDrawer(refund)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition" title="Vista rápida">
                        <Eye className="h-4 w-4" />
                      </button>
                      <Link href={`/admin/reembolsos/${refund.id}`} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition" title="Detalle completo">
                        <FileText className="h-4 w-4" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-xs text-gray-500">
              {(data.page - 1) * pageSize + 1}–{Math.min(data.page * pageSize, data.total)} de {data.total}
            </p>
            <div className="flex items-center gap-1">
              <button type="button" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {getPageRange(data.page, Math.max(1, data.totalPages)).map((n, i) =>
                n === 0 ? (
                  <span key={`e-${i}`} className="flex h-7 w-5 items-center justify-center text-xs text-gray-400">…</span>
                ) : (
                  <button key={n} type="button" onClick={() => setPage(n)}
                    className={cn('flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold transition',
                      n === data.page ? 'bg-nurei-cta text-gray-900' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50')}>
                    {n}
                  </button>
                )
              )}
              <button type="button" disabled={data.page >= data.totalPages} onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick view drawer */}
      <AnimatePresence>
        {drawerOpen && drawerRefund && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/40"
              onClick={closeDrawer}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-start justify-between border-b border-gray-100 px-5 py-3.5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Reembolso</p>
                  <p className="text-xl font-black text-primary-dark font-mono leading-tight mt-0.5">{formatPrice(drawerRefund.amount_cents)}</p>
                  <div className="mt-1.5">
                    <StatusBadge status={drawerRefund.status} />
                  </div>
                </div>
                <button type="button" onClick={closeDrawer} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition ml-1">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="rounded-xl border border-gray-100 p-4 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Pedido</p>
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag className="h-3.5 w-3.5 text-gray-400" />
                    <Link href={`/admin/pedidos/${drawerRefund.order_id}`} className="font-mono text-sm font-semibold text-primary-cyan hover:underline">
                      {drawerRefund.order?.short_id ?? drawerRefund.order_id}
                    </Link>
                  </div>
                  {drawerRefund.order?.customer_name && (
                    <p className="text-sm text-gray-900">{drawerRefund.order.customer_name}</p>
                  )}
                  {drawerRefund.order?.customer_email && (
                    <p className="flex items-center gap-1.5 text-xs text-gray-500"><Mail className="h-3 w-3" /> {drawerRefund.order.customer_email}</p>
                  )}
                </div>

                <div className="rounded-xl border border-gray-100 p-4 space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Método</span><span>{PAYMENT_METHOD_LABELS[drawerRefund.refund_method] ?? drawerRefund.refund_method}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Fecha</span><span>{formatDate(drawerRefund.refunded_at)}</span></div>
                  {drawerRefund.stripe_refund_id && (
                    <div className="flex justify-between text-xs gap-3"><span className="text-gray-500 shrink-0">Stripe ID</span><span className="font-mono truncate">{drawerRefund.stripe_refund_id}</span></div>
                  )}
                </div>

                {drawerRefund.reason && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Motivo</p>
                    <p className="text-sm text-gray-700">{drawerRefund.reason}</p>
                  </div>
                )}

                {drawerRefund.notes && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Notas internas</p>
                    <p className="text-sm text-gray-700">{drawerRefund.notes}</p>
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3">
                <Link
                  href={`/admin/reembolsos/${drawerRefund.id}`}
                  className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-primary-dark text-white text-sm font-semibold hover:bg-primary-dark/90 transition"
                >
                  Ver detalles completos <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
