'use client'

import { TrendingUp, Trophy, Target, AlertCircle } from 'lucide-react'
import { formatPrice } from '@/lib/utils/format'
import type { CrmStats } from '@/types'

interface Props {
  stats: CrmStats | null
  loading: boolean
}

export function CrmStatsBar({ stats, loading }: Props) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-50" />
        ))}
      </div>
    )
  }

  const cards = [
    {
      label: 'Pipeline abierto',
      value: formatPrice(stats.open_value_cents),
      sub: `${stats.open_deals} oportunidades`,
      icon: Target,
      color: 'text-sky-600 bg-sky-50',
    },
    {
      label: 'Ganado este mes',
      value: formatPrice(stats.won_value_this_month_cents),
      sub: `${stats.won_this_month} cerradas`,
      icon: Trophy,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Tasa de conversión',
      value: `${stats.win_rate}%`,
      sub: 'ganadas vs cerradas (mes)',
      icon: TrendingUp,
      color: 'text-violet-600 bg-violet-50',
    },
    {
      label: 'Tareas',
      value: String(stats.pending_tasks),
      sub: stats.overdue_tasks > 0 ? `${stats.overdue_tasks} vencidas` : 'al día',
      icon: AlertCircle,
      color: stats.overdue_tasks > 0 ? 'text-rose-600 bg-rose-50' : 'text-gray-600 bg-gray-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <div key={c.label} className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">{c.label}</span>
              <span className={`rounded-lg p-1.5 ${c.color}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight text-gray-900 tabular-nums">{c.value}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">{c.sub}</p>
          </div>
        )
      })}
    </div>
  )
}
