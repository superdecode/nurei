'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, X } from 'lucide-react'
import { formatPrice } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

interface AttributionRow {
  id: string
  order_id: string
  attribution_type: 'coupon' | 'cookie'
  coupon_id: string | null
  coupon_code: string | null
  commission_pct: number
  commission_amount_cents: number
  payout_status: 'pending' | 'paid'
  paid_at: string | null
  created_at: string
  orders: { short_id: string; total: number; created_at: string } | null
}

const PAGE_SIZE = 20

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-gray-100', className)} />
}

type Chip = 'week' | 'month' | '3months'

export default function AffiliateVentasPage() {
  const [rows, setRows] = useState<AttributionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (typeFilter) params.set('type', typeFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (dateFrom) params.set('from', `${dateFrom}T00:00:00.000Z`)
    if (dateTo) params.set('to', `${dateTo}T23:59:59.999Z`)
    const res = await fetch(`/api/affiliate/orders?${params}`)
    const json = await res.json()
    setRows(json.data ?? [])
    setLoading(false)
  }, [typeFilter, statusFilter, dateFrom, dateTo])

  useEffect(() => { void fetchOrders() }, [fetchOrders])

  const setChip = (chip: Chip) => {
    const t = fmtDate(new Date())
    if (chip === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 6)
      setDateFrom(fmtDate(d)); setDateTo(t)
    } else if (chip === 'month') {
      const d = new Date(); d.setDate(d.getDate() - 29)
      setDateFrom(fmtDate(d)); setDateTo(t)
    } else {
      const d = new Date(); d.setDate(d.getDate() - 89)
      setDateFrom(fmtDate(d)); setDateTo(t)
    }
    setPage(1)
  }

  const activeChip = useMemo((): Chip | '' => {
    if (!dateFrom || !dateTo) return ''
    const diff = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000)
    const t = fmtDate(new Date())
    if (diff <= 7 && dateTo === t) return 'week'
    if (diff <= 30 && dateTo === t) return 'month'
    if (diff <= 90 && dateTo === t) return '3months'
    return ''
  }, [dateFrom, dateTo])

  const paginated = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))

  const maskCustomer = (name: string | undefined | null) => {
    if (!name) return '—'
    const parts = name.trim().split(' ')
    return parts[0].charAt(0).toUpperCase() + '.' + (parts[1] ? ` ${parts[1].charAt(0).toUpperCase()}.` : '')
  }

  return (
    <div className="space-y-5 pb-10">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-black text-primary-dark">Ventas</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {loading ? 'Cargando...' : `${rows.length} venta${rows.length !== 1 ? 's' : ''} encontrada${rows.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period chips */}
        {([
          { id: 'week' as const, label: '7 días' },
          { id: 'month' as const, label: '30 días' },
          { id: '3months' as const, label: '3 meses' },
        ]).map(({ id, label }) => (
          <button
            key={id} type="button"
            onClick={() => activeChip === id ? (setDateFrom(''), setDateTo(''), setPage(1)) : setChip(id)}
            className={cn(
              'h-8 px-3 rounded-full text-xs font-semibold border transition-all',
              activeChip === id
                ? 'bg-primary-dark text-white border-primary-dark shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}
          >
            {label}
          </button>
        ))}

        {/* Date range pill */}
        <div className="flex items-center rounded-full border border-gray-200 bg-white h-8 shadow-sm overflow-hidden">
          <div className="flex items-center gap-1 px-2.5">
            <Clock className="h-3 w-3 text-gray-400 shrink-0" />
            <input
              type="date" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="text-[11px] text-gray-600 bg-transparent outline-none w-[88px] cursor-pointer"
            />
          </div>
          <span className="text-gray-300 text-xs">–</span>
          <div className="flex items-center gap-1 px-2.5">
            <input
              type="date" value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="text-[11px] text-gray-600 bg-transparent outline-none w-[88px] cursor-pointer"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }} className="pr-2 text-gray-400 hover:text-gray-600">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Type filter */}
        <select
          value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="h-8 px-3 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-600"
        >
          <option value="">Todos los tipos</option>
          <option value="coupon">Cupón</option>
          <option value="cookie">Link referido</option>
        </select>

        {/* Status filter */}
        <select
          value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="h-8 px-3 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-600"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="paid">Pagado</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-gray-50/60 border-b border-gray-100">
                {['Fecha', '# Pedido', 'Cliente', 'Subtotal', 'Atribución', 'Comisión', 'Estado pago'].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="py-3.5 px-4">
                        <Skeleton className="h-3.5 w-full max-w-[80px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <p className="text-sm text-gray-400">No hay ventas con los filtros seleccionados</p>
                  </td>
                </tr>
              ) : paginated.map((row) => (
                <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                  <td className="py-3.5 px-4 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs font-bold text-primary-dark">
                    #{row.orders?.short_id ?? row.order_id.slice(0, 8)}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-gray-600">
                    {maskCustomer((row.orders as unknown as { customer_name?: string } | null)?.customer_name)}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-gray-600">
                    {row.orders ? formatPrice(row.orders.total) : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    {row.attribution_type === 'coupon' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold">
                        Cupón{row.coupon_code ? `: ${row.coupon_code}` : ''}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                        Referido
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-primary-dark text-xs">
                      {formatPrice(row.commission_amount_cents)}
                    </span>
                    <span className="text-gray-400 text-[10px] ml-1">({row.commission_pct}%)</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold',
                      row.payout_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {row.payout_status === 'paid' ? 'Pagado' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">Página {page} de {totalPages} · {rows.length} resultados</p>
          <div className="flex gap-1.5">
            <button
              type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="h-8 px-3.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <button
              type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="h-8 px-3.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
