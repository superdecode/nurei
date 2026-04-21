'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, DollarSign } from 'lucide-react'
import { formatPrice } from '@/lib/utils/format'
import type { AffiliateWithStats } from '@/types'

export default function AdminAffiliatesPagosPage() {
  const [affiliates, setAffiliates] = useState<AffiliateWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/affiliates')
      .then((r) => r.json())
      .then(({ data }) => setAffiliates((data ?? []).filter((a: AffiliateWithStats) => a.pending_payout_cents > 0)))
      .finally(() => setLoading(false))
  }, [])

  const total = affiliates.reduce((s, a) => s + a.pending_payout_cents, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/affiliates" className="text-gray-400 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Pagos pendientes</h1>
          <p className="text-sm text-gray-400">Total a pagar: <span className="font-bold text-amber-600">{formatPrice(total)}</span></p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50 border-b">
              {['Afiliado', 'Pendiente', ''].map((h) => (
                <th key={h} className="text-left py-3.5 px-4 text-[10px] font-bold text-gray-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="py-16 text-center"><div className="w-5 h-5 border-2 border-primary-cyan border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
            ) : affiliates.length === 0 ? (
              <tr><td colSpan={3} className="py-16 text-center text-sm text-gray-400">No hay pagos pendientes</td></tr>
            ) : (
              affiliates.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-bold text-primary-dark">@{a.handle}</p>
                      <p className="text-xs text-gray-400">{a.email}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-bold text-amber-600 text-base">{formatPrice(a.pending_payout_cents)}</td>
                  <td className="py-4 px-4 text-right">
                    <Link href={`/admin/affiliates/${a.id}`} className="text-xs font-bold text-primary-cyan hover:underline flex items-center gap-1 justify-end">
                      <DollarSign className="w-3.5 h-3.5" /> Registrar pago
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
