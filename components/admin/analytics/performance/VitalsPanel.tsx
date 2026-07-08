'use client'

import { Zap, Clock, Activity, MousePointer, Server } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { MetricCard } from '@/components/admin/analytics/MetricCard'
import { EmptyState } from '@/components/admin/analytics/EmptyState'
import { RankingTable } from '@/components/admin/analytics/RankingTable'
import { cn } from '@/lib/utils'

interface VitalSummary {
  name: string
  p75: number
  median: number
  pct_good: number
  count: number
  rating: 'good' | 'needs-improvement' | 'poor'
  unit: string
}

interface VitalsData {
  summary: VitalSummary[]
  trend: Record<string, number | string>[]
  slow_pages: { path: string; lcp_p75: number; samples: number }[]
}

const RATING_COLOR: Record<string, string> = {
  good: 'text-emerald-600',
  'needs-improvement': 'text-amber-500',
  poor: 'text-red-500',
}

const RATING_BG: Record<string, string> = {
  good: 'bg-emerald-50 border-emerald-100',
  'needs-improvement': 'bg-amber-50 border-amber-100',
  poor: 'bg-red-50 border-red-100',
}

const METRIC_META: Record<string, { label: string; icon: typeof Zap; description: string }> = {
  LCP:  { label: 'LCP', icon: Zap,          description: 'Largest Contentful Paint — velocidad de carga principal' },
  CLS:  { label: 'CLS', icon: Activity,      description: 'Cumulative Layout Shift — estabilidad visual' },
  INP:  { label: 'INP', icon: MousePointer,  description: 'Interaction to Next Paint — respuesta a interacciones' },
  FCP:  { label: 'FCP', icon: Clock,         description: 'First Contentful Paint — primer contenido visible' },
  TTFB: { label: 'TTFB', icon: Server,       description: 'Time to First Byte — velocidad del servidor' },
}

const TREND_COLORS: Record<string, string> = {
  LCP: '#3B82F6', CLS: '#8B5CF6', INP: '#F59E0B', FCP: '#10B981', TTFB: '#EF4444',
}

interface Props {
  data: VitalsData | null
  loading: boolean
}

export function VitalsPanel({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <MetricCard key={i} label="" value="" loading />)}
        </div>
        <div className="h-64 bg-gray-50 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!data || data.summary.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <EmptyState message="Sin datos de rendimiento aun. Los datos se acumulan en tiempo real desde visitas de usuarios." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Core Web Vitals cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {data.summary.map((v) => {
          const meta = METRIC_META[v.name]
          const Icon = meta?.icon ?? Zap
          const displayVal = v.name === 'CLS' ? v.p75.toFixed(3) : `${v.p75.toFixed(0)}${v.unit}`
          return (
            <div key={v.name} className={cn('bg-white rounded-2xl p-4 shadow-sm border', RATING_BG[v.rating])}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{v.name}</span>
                <Icon size={13} className={RATING_COLOR[v.rating]} />
              </div>
              <p className={cn('text-xl font-bold', RATING_COLOR[v.rating])}>{displayVal}</p>
              <p className="text-[10px] text-gray-400 mt-1">p75 · {v.pct_good}% bueno</p>
              <p className="text-[10px] text-gray-300 mt-0.5">{v.count} muestras</p>
            </div>
          )
        })}
      </div>

      {/* Legend for thresholds */}
      <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Bueno</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Necesita mejora</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Critico</span>
        <span className="ml-auto text-[10px]">Valores p75 (percentil 75)</span>
      </div>

      {/* Metric descriptions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.summary.map((v) => {
          const meta = METRIC_META[v.name]
          return (
            <div key={v.name} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
              <p className="text-xs font-semibold text-gray-700 mb-0.5">{v.name}</p>
              <p className="text-[10px] text-gray-400 mb-2">{meta?.description}</p>
              <div className="flex gap-3">
                <div>
                  <p className="text-[9px] text-gray-400">Mediana</p>
                  <p className="text-xs font-medium text-gray-700">
                    {v.name === 'CLS' ? v.median.toFixed(3) : `${v.median.toFixed(0)}${v.unit}`}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400">% Bueno</p>
                  <p className={cn('text-xs font-medium', RATING_COLOR[v.rating])}>{v.pct_good}%</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Trend chart */}
      {data.trend.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Tendencia de Core Web Vitals (LCP, FCP, TTFB)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 9, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(d) => new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
              />
              <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} unit="ms" />
              <Tooltip
                contentStyle={{ borderRadius: 12, fontSize: 11 }}
                formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(1)}ms`, String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {['LCP', 'FCP', 'TTFB'].map((m) => (
                <Line key={m} type="monotone" dataKey={m} stroke={TREND_COLORS[m]} dot={false} strokeWidth={2} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Slow pages */}
      {data.slow_pages.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Paginas mas lentas (LCP p75)</h3>
          <RankingTable
            data={data.slow_pages}
            columns={[
              { key: 'path', label: 'Ruta', align: 'left' },
              {
                key: 'lcp_p75', label: 'LCP p75', align: 'right', showBar: true,
                format: (v) => {
                  const ms = Number(v)
                  const color = ms <= 2500 ? 'text-emerald-600' : ms <= 4000 ? 'text-amber-500' : 'text-red-500'
                  return <span className={color}>{ms.toLocaleString('es-MX')} ms</span>
                },
              },
              { key: 'samples', label: 'Muestras', align: 'right', format: (v) => Number(v).toLocaleString('es-MX') },
            ]}
          />
        </div>
      )}
    </div>
  )
}
