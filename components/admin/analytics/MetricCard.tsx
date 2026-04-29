'use client'

import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string
  sublabel?: string
  delta?: number
  icon?: LucideIcon
  iconColor?: string
  invertDelta?: boolean
  loading?: boolean
}

export function MetricCard({
  label,
  value,
  sublabel,
  delta,
  icon: Icon,
  iconColor = '#FFC107',
  invertDelta = false,
  loading = false,
}: MetricCardProps) {
  const isPositive = delta !== undefined ? (invertDelta ? delta < 0 : delta > 0) : null

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
        <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
        <div className="h-7 w-32 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-16 bg-gray-100 rounded" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        {Icon && (
          <div className="p-1.5 rounded-lg bg-gray-50">
            <Icon size={14} style={{ color: iconColor }} />
          </div>
        )}
      </div>

      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>

      <div className="flex items-center gap-2 mt-1.5">
        {delta !== undefined && isPositive !== null && (
          <span className={cn('flex items-center gap-0.5 text-xs font-medium',
            isPositive ? 'text-emerald-600' : 'text-red-500',
          )}>
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sublabel && (
          <span className="text-xs text-gray-400">{sublabel}</span>
        )}
      </div>
    </div>
  )
}

export function computeDelta(current: number, prev: number): number | undefined {
  if (!prev) return undefined
  return ((current - prev) / prev) * 100
}
