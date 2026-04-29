'use client'

import { AlertTriangle, AlertCircle, Info, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface Alert {
  type: string
  severity: 'high' | 'medium' | 'low'
  message: string
  link?: string
}

const SEVERITY_STYLES = {
  high: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700', icon: AlertCircle, iconColor: 'text-red-500' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', icon: AlertTriangle, iconColor: 'text-amber-500' },
  low: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', icon: Info, iconColor: 'text-blue-500' },
}

interface AlertCardProps {
  alerts: Alert[]
  className?: string
}

export function AlertCard({ alerts, className }: AlertCardProps) {
  if (alerts.length === 0) {
    return (
      <div className={cn('bg-white rounded-2xl p-5 shadow-sm border border-gray-100', className)}>
        <p className="text-sm text-gray-500 text-center py-4">Sin alertas activas</p>
      </div>
    )
  }

  return (
    <div className={cn('bg-white rounded-2xl p-5 shadow-sm border border-gray-100', className)}>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Alertas</h3>
      <div className="space-y-2">
        {alerts.map((alert, i) => {
          const style = SEVERITY_STYLES[alert.severity]
          const Icon = style.icon
          return (
            <div
              key={i}
              className={cn('flex items-start gap-3 p-3 rounded-xl border', style.bg, style.border)}
            >
              <Icon size={14} className={cn('shrink-0 mt-0.5', style.iconColor)} />
              <p className={cn('text-xs flex-1', style.text)}>{alert.message}</p>
              {alert.link && (
                <Link href={alert.link} className={cn('shrink-0', style.text)}>
                  <ArrowRight size={12} />
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
