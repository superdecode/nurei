'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Mail, Send, FileEdit, TrendingUp } from 'lucide-react'
import { MetricCard } from '@/components/admin/analytics/MetricCard'
import { formatDate } from '@/lib/utils/format'
import type { MarketingCampaign, CampaignStatus } from '@/types'

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Borrador', sending: 'Enviando', sent: 'Enviada', failed: 'Fallida',
}

const TABS: Array<{ value: CampaignStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'draft', label: 'Borradores' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'failed', label: 'Fallidas' },
]

export function CampaignsOverview() {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<CampaignStatus | 'all'>('all')

  useEffect(() => {
    setLoading(true)
    const qs = tab === 'all' ? '' : `?status=${tab}`
    fetch(`/api/admin/marketing/campaigns${qs}`)
      .then((r) => r.json())
      .then((json) => setCampaigns(json.data ?? []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false))
  }, [tab])

  const draftCount = campaigns.filter((c) => c.status === 'draft').length
  const sentCount = campaigns.filter((c) => c.status === 'sent').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Marketing</h1>
        <Link href="/admin/marketing/nueva" className="h-9 px-4 rounded-xl bg-primary-dark text-white text-sm font-semibold hover:bg-primary-dark/90 flex items-center">
          Nueva campaña
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Campañas" value={String(campaigns.length)} icon={Mail} loading={loading} />
        <MetricCard label="Borradores" value={String(draftCount)} icon={FileEdit} loading={loading} />
        <MetricCard label="Enviadas" value={String(sentCount)} icon={Send} loading={loading} />
        <MetricCard label="Tasa de apertura" value="—" sublabel="por campaña, ver detalle" icon={TrendingUp} loading={loading} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm px-2 py-2 flex gap-1.5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${
              tab === t.value ? 'bg-primary-dark text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-400">Cargando…</div>
        ) : campaigns.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">No hay campañas todavía.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Estatus</th>
                <th className="px-4 py-3">Creada</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/marketing/${c.id}`} className="font-medium text-gray-900 hover:underline">{c.name}</Link>
                    <p className="text-xs text-gray-400">{c.subject}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{STATUS_LABELS[c.status]}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
