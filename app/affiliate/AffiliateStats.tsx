'use client'

import { useState } from 'react'
import { ShoppingCart, CreditCard, FileText, Calendar, Tag } from 'lucide-react'
import { formatPrice } from '@/lib/utils/format'
import type { CommissionPayment } from '@/types'

export default function AffiliateStats() {
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'payments' | 'days'>('sales')

  const [payments, setPayments] = useState<CommissionPayment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [sales, setSales] = useState<Array<any>>([])
  const [salesLoading, setSalesLoading] = useState(true)
  const [detailPayment, setDetailPayment] = useState<CommissionPayment | null>(null)

  useEffect(() => {
    if (activeSubTab === 'payments') {
      fetch('/api/affiliate/payouts')
        .then(r => r.json())
        .then(({ data }) => setPayments(data ?? []))
        .finally(() => setPaymentsLoading(false))
    } else if (activeSubTab === 'sales') {
      fetch('/api/affiliate/orders')
        .then(r => r.json())
        .then(({ data }) => setSales(data ?? []))
        .finally(() => setSalesLoading(false))
    }
  }, [activeSubTab])

  const subTabs = [
    { id: 'sales', label: 'Ventas', icon: ShoppingCart },
    { id: 'payments', label: 'Pagos', icon: CreditCard },
    { id: 'days', label: 'Días', icon: Calendar },
  ] as const

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-gray-200">
        <nav className="flex gap-6 overflow-x-auto">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`
                relative px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors
                ${activeSubTab === tab.id
                  ? 'border-primary-dark text-primary-dark'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
                }
              `}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden min-h-[400px]">
        {activeSubTab === 'sales' && (
          salesLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary-dark border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ShoppingCart className="w-12 h-12 text-gray-200" />
              <p className="text-sm text-gray-400">Aún no tienes ventas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Fecha</th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Pedido</th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Cliente</th>
                    <th className="text-right py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Monto</th>
                    <th className="text-right py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Comisión</th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 10).map((item: any, i) => {
                    const order = item.orders ?? item
                    const paid = item.payout_status === 'paid'
                    return (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-xs text-gray-500">
                          {new Date(item.created_at).toLocaleDateString('es-MX')}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-bold text-primary-dark">
                          #{order?.short_id ?? ''}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {(item as any).customer_name ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600 text-right">
                          {formatPrice(order?.total ?? 0)}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600 text-right">
                          {formatPrice(item.commission_amount_cents)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {paid ? 'Pagado' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {sales.length > 10 && (
                <div className="p-4 text-center">
                  <a href="/affiliate/ventas" className="text-sm text-primary-cyan font-semibold hover:underline">
                    Ver todas las ventas
                  </a>
                </div>
              )}
            </div>
          )
        )}

        {activeSubTab === 'payments' && (
          paymentsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary-dark border-t-transparent rounded-full animate-spin" />
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <CreditCard className="w-12 h-12 text-gray-200" />
              <p className="text-sm text-gray-400">Aún no tienes pagos registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Fecha</th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Período</th>
                    <th className="text-right py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Monto</th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Órdenes</th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {new Date(p.paid_at).toLocaleDateString('es-MX')}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {new Date(p.period_from).toLocaleDateString('es-MX')} — {new Date(p.period_to).toLocaleDateString('es-MX')}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600 text-right font-bold text-emerald-600">
                        {formatPrice(p.amount_cents)}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500 text-center">
                        {p.attribution_ids?.length ?? 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setDetailPayment(p)}
                          className="text-[10px] text-primary-cyan font-semibold hover:underline"
                        >
                          Ver más
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {activeSubTab === 'days' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText className="w-12 h-12 text-gray-200" />
            <p className="text-sm text-gray-400">Estadísticas detalladas por días en desarrollo</p>
            <p className="text-xs text-gray-500">Próximamente podrás ver tu desempeño día por día</p>
          </div>
        )}
      </div>

      {detailPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setDetailPayment(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-primary-dark">Detalle del pago</h3>
              <button
                type="button"
                onClick={() => setDetailPayment(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Fecha de pago</span>
                <span className="text-sm font-semibold text-gray-900">
                  {new Date(detailPayment.paid_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Monto</span>
                <span className="text-lg font-black text-emerald-600">{formatPrice(detailPayment.amount_cents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Período</span>
                <span className="text-sm text-gray-900">
                  {new Date(detailPayment.period_from).toLocaleDateString('es-MX')} — {new Date(detailPayment.period_to).toLocaleDateString('es-MX')}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Órdenes incluidas</span>
                <div className="mt-2 space-y-1">
                  {(detailPayment.orders ?? []).slice(0, 3).map((order: any, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                      <span className="font-mono text-xs font-bold text-primary-dark">
                        #{order.short_id}
                      </span>
                      <span className="text-xs text-gray-600">{order.customer_name ?? '—'}</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {formatPrice(order.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
