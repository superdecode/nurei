'use client'

import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/utils/format'
import type { CommissionPayment } from '@/types'

export default function AffiliatePagosPage() {
  const [payments, setPayments] = useState<CommissionPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/affiliate/payouts')
      .then((r) => r.json())
      .then(({ data }) => setPayments(data ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-primary-dark">Pagos</h1>
        <p className="text-sm text-gray-400 mt-1">Historial de comisiones recibidas</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fecha de pago</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Período</th>
                <th className="text-right py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Monto</th>
                <th className="text-center py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Órdenes</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Notas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-16 text-center"><div className="w-5 h-5 border-2 border-primary-cyan border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-sm text-gray-400">Aún no tienes pagos registrados</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                    <td className="py-3.5 px-4 text-gray-500 text-xs">
                      {new Date(p.paid_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-500">
                      {new Date(p.period_from).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} —{' '}
                      {new Date(p.period_to).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                      {formatPrice(p.amount_cents)}
                    </td>
                    <td className="py-3.5 px-4 text-center text-gray-500 text-xs">
                      {p.attribution_ids.length}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 text-xs hidden md:table-cell">
                      {p.notes ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
