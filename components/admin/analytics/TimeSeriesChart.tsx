'use client'

import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { formatPrice } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

type Metric = 'revenue' | 'orders' | 'aov'

interface DataPoint {
  date: string
  revenue: number
  orders: number
  aov: number
  prev_revenue?: number
  prev_orders?: number
  prev_aov?: number
}

interface TimeSeriesChartProps {
  data: DataPoint[]
  metric?: Metric
  showComparison?: boolean
  height?: number
  className?: string
}

const METRIC_CONFIG: Record<Metric, { label: string; format: (v: number) => string; color: string }> = {
  revenue: { label: 'Revenue', format: formatPrice, color: '#FFC107' },
  orders: { label: 'Pedidos', format: (v) => v.toLocaleString('es-MX'), color: '#10B981' },
  aov: { label: 'Ticket Prom.', format: formatPrice, color: '#8B5CF6' },
}

function formatAxisDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

export function TimeSeriesChart({
  data,
  metric = 'revenue',
  showComparison = true,
  height = 260,
  className,
}: TimeSeriesChartProps) {
  const cfg = METRIC_CONFIG[metric]
  const prevKey = `prev_${metric}` as keyof DataPoint

  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-current" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={cfg.color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-prev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis
            dataKey="date"
            tickFormatter={formatAxisDate}
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => cfg.format(v)}
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
            formatter={(v: unknown, name: unknown) => [cfg.format(Number(v ?? 0)), String(name)]}
            labelFormatter={(label: unknown) => formatAxisDate(String(label))}
          />
          {showComparison && data[0]?.[prevKey] !== undefined && (
            <Area
              type="monotone"
              dataKey={prevKey}
              stroke="#94A3B8"
              strokeWidth={1}
              strokeDasharray="4 4"
              fill="url(#grad-prev)"
              name="Periodo anterior"
              dot={false}
            />
          )}
          <Area
            type="monotone"
            dataKey={metric}
            stroke={cfg.color}
            strokeWidth={2}
            fill="url(#grad-current)"
            name={cfg.label}
            dot={false}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
