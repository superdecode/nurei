'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Receipt, X, FileText, CalendarDays, CreditCard, Tag } from 'lucide-react'
import { formatPrice } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { CommissionPayment } from '@/types'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-gray-100', className)} />
}

export default function AffiliatePagosPage() {
  const [payments, setPayments] = useState<CommissionPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailPayment, setDetailPayment] = useState<CommissionPayment | null>(null)
  const [exporting, setExporting] = useState(false)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/affiliate/payouts')
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Error al cargar pagos')
      }
      setPayments(json.data ?? [])
    } catch (err) {
      console.error('[pagos page] Error loading payments:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar pagos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchPayments() }, [fetchPayments])

  const handleExport = async () => {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const [payoutsRes, ordersRes, profileRes] = await Promise.all([
        fetch('/api/affiliate/payouts').then((r) => r.json()),
        fetch('/api/affiliate/orders').then((r) => r.json()),
        fetch('/api/affiliate/profile').then((r) => r.json()),
      ])
      const payouts: CommissionPayment[] = payoutsRes.data ?? []
      const orders: Array<Record<string, unknown>> = ordersRes.data ?? []
      const profile = profileRes.data ?? {}

      const wb = XLSX.utils.book_new()

      const ordersSheet = (orders as Array<Record<string, unknown>>).map((o) => {
        const order = (o.orders ?? o) as Record<string, unknown>
        return {
          'Pedido': o.short_id ?? order?.short_id ?? '',
          'Fecha': o.created_at ? new Date(o.created_at as string).toLocaleDateString('es-MX') : '',
          'Cliente': (o as Record<string, unknown>).customer_name ?? '',
          'Subtotal': o.total ?? order?.total ?? 0,
          'Atribucion': o.attribution_type ?? '',
          'Comision %': o.commission_pct ?? '',
          'Comision $': o.commission_amount_cents ?? 0,
          'Estado pago': (o.payout_status as string) === 'paid' ? 'Pagado' : 'Pendiente',
        }
      })
      const ws1 = XLSX.utils.json_to_sheet(ordersSheet)
      XLSX.utils.book_append_sheet(wb, ws1, 'Ventas')

      const paymentsSheet = payouts.map((p) => ({
        'Fecha de pago': new Date(p.paid_at).toLocaleDateString('es-MX'),
        'Periodo inicio': new Date(p.period_from).toLocaleDateString('es-MX'),
        'Periodo fin': new Date(p.period_to).toLocaleDateString('es-MX'),
        'Monto': p.amount_cents,
        'Tipo de pago': p.payment_type ?? '',
        'Referencia': p.reference_number ?? '',
        'Nota': p.notes ?? '',
        'Ordenes': (p.orders ?? []).map((o) => `#${o.short_id}`).join(', '),
      }))
      const ws2 = XLSX.utils.json_to_sheet(paymentsSheet)
      XLSX.utils.book_append_sheet(wb, ws2, 'Pagos')

      const summary = [{
        'Total ganado': profile.total_earned_cents ?? 0,
        'Pendiente de pago': profile.pending_payout_cents ?? 0,
        'Total ordenes': profile.total_orders ?? orders.length,
        'Handle': profile.handle ?? '',
      }]
      const ws3 = XLSX.utils.json_to_sheet(summary)
      XLSX.utils.book_append_sheet(wb, ws3, 'Resumen')

      const handle = (profile.handle ?? 'afiliado') as string
      XLSX.writeFile(wb, `${handle}_reporte.xlsx`)
    } catch {
      alert('Error al exportar. Inténtalo de nuevo.')
    }
    setExporting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-primary-dark">Pagos</h1>
          <p className="text-sm text-gray-400 mt-1">Historial de comisiones recibidas</p>
        </div>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || loading}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Exportando...' : 'Exportar Excel'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Período</th>
                <th className="text-right py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Monto</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Tipo</th>
                <th className="text-center py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Órdenes</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Referencia</th>
                <th className="text-right py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center"><div className="w-5 h-5 border-2 border-primary-cyan border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Receipt className="w-8 h-8 text-gray-200" />
                      <p className="text-sm text-gray-400">Aún no tienes pagos registrados</p>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                    <td className="py-3.5 px-4 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(p.paid_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-500">
                      {new Date(p.period_from).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} —{' '}
                      {new Date(p.period_to).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                      {formatPrice(p.amount_cents)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600 capitalize hidden sm:table-cell">
                      {p.payment_type ?? '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center text-gray-500 text-xs">
                      {p.attribution_ids.length}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 text-xs font-mono hidden md:table-cell max-w-[100px] truncate">
                      {p.reference_number ?? '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailPayment(p)}
                        className="text-[10px] font-semibold text-primary-cyan hover:underline"
                      >
                        Ver más
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail modal ── */}
      {detailPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDetailPayment(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">Detalle del pago</h3>
              </div>
              <button type="button" onClick={() => setDetailPayment(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Monto</span>
                <span className="text-lg font-black text-emerald-700">{formatPrice(detailPayment.amount_cents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tipo</span>
                <span className="text-xs font-semibold capitalize text-gray-700">{detailPayment.payment_type ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Referencia</span>
                <span className="text-xs font-mono text-gray-700">{detailPayment.reference_number ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> Fecha de pago
                </span>
                <span className="text-xs text-gray-700">
                  {new Date(detailPayment.paid_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Período</span>
                <span className="text-xs text-gray-700">
                  {new Date(detailPayment.period_from).toLocaleDateString('es-MX')} — {new Date(detailPayment.period_to).toLocaleDateString('es-MX')}
                </span>
              </div>
              {detailPayment.notes && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1 mb-1">
                    <FileText className="w-3 h-3" /> Nota
                  </span>
                  <p className="text-xs text-gray-700 bg-gray-50 rounded-xl p-3">{detailPayment.notes}</p>
                </div>
              )}
              {(detailPayment.orders ?? []).length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1 mb-2">
                    <Tag className="w-3 h-3" /> Órdenes incluidas
                  </span>
                  <div className="space-y-1">
                    {detailPayment.orders!.map((o, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                        <span className="font-mono text-xs font-bold text-primary-dark">#{o.short_id}</span>
                        <span className="text-xs text-gray-600">{o.customer_name ?? '—'}</span>
                        <span className="text-xs font-semibold text-gray-700">{formatPrice(o.total)}</span>
                      </div>
                    ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setError(null); void fetchPayments(); }}
            className="mt-3"
          >
            Reintentar
          </Button>
        </div>
      )}
    </div>
  )
}
