'use client'

import { AlertTriangle, Code2, FileCode2, Globe, Image as ImageIcon, Layers, Paintbrush } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { EmptyState } from '@/components/admin/analytics/EmptyState'
import { cn } from '@/lib/utils'

interface ErrorGroup {
  error_type: string
  error_msg: string
  count: number
  pages: string[]
  pages_count: number
  last_seen: string
}

interface RecentError {
  id: number
  error_type: string
  error_msg: string
  source_url: string | null
  page_path: string
  created_at: string
}

interface ErrorsData {
  total: number
  by_type: Record<string, number>
  grouped: ErrorGroup[]
  recent: RecentError[]
}

const TYPE_ICON: Record<string, typeof AlertTriangle> = {
  resource: Globe,
  css: Paintbrush,
  chunk: FileCode2,
  img: ImageIcon,
  js: Code2,
  network: Globe,
  render: Layers,
  unknown: AlertTriangle,
}

const TYPE_COLOR: Record<string, string> = {
  resource: '#EF4444',
  css: '#EC4899',
  chunk: '#DC2626',
  img: '#14B8A6',
  js: '#F59E0B',
  network: '#8B5CF6',
  render: '#3B82F6',
  unknown: '#6B7280',
}

const TYPE_LABEL: Record<string, string> = {
  resource: 'Recurso',
  css: 'CSS',
  chunk: 'Chunk JS',
  img: 'Imagen',
  js: 'JavaScript',
  network: 'Red',
  render: 'Render',
  unknown: 'Desconocido',
}

interface Props {
  data: ErrorsData | null
  loading: boolean
}

export function ErrorsPanel({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />)}
      </div>
    )
  }

  if (!data || data.total === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <EmptyState message="Sin errores registrados en el periodo. Los errores se capturan automaticamente desde el navegador de los usuarios." />
      </div>
    )
  }

  const byTypeArr = Object.entries(data.by_type).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total errores</p>
          <p className="text-2xl font-bold text-red-500">{data.total.toLocaleString('es-MX')}</p>
        </div>
        {byTypeArr.slice(0, 3).map((t) => {
          const Icon = TYPE_ICON[t.type] ?? AlertTriangle
          return (
            <div key={t.type} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} style={{ color: TYPE_COLOR[t.type] }} />
                <p className="text-[10px] text-gray-500">{TYPE_LABEL[t.type]}</p>
              </div>
              <p className="text-xl font-bold text-gray-800">{t.count.toLocaleString('es-MX')}</p>
            </div>
          )
        })}
      </div>

      {/* Bar chart by type */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Errores por tipo</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={byTypeArr} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="type" tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(t) => TYPE_LABEL[t] ?? t} axisLine={false} tickLine={false} width={80} />
            <Tooltip
              contentStyle={{ borderRadius: 12, fontSize: 11 }}
              formatter={(v: unknown) => [Number(v).toLocaleString('es-MX'), 'Errores']}
              labelFormatter={(l) => TYPE_LABEL[l] ?? l}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {byTypeArr.map((t) => <Cell key={t.type} fill={TYPE_COLOR[t.type] ?? '#6B7280'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Grouped errors */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Errores mas frecuentes</h3>
        <div className="space-y-2">
          {data.grouped.map((g, i) => {
            const Icon = TYPE_ICON[g.error_type] ?? AlertTriangle
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="mt-0.5 p-1.5 rounded-lg" style={{ background: `${TYPE_COLOR[g.error_type]}15` }}>
                  <Icon size={12} style={{ color: TYPE_COLOR[g.error_type] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: TYPE_COLOR[g.error_type] }}>
                      {TYPE_LABEL[g.error_type]}
                    </span>
                    <span className="text-[10px] text-gray-400">·</span>
                    <span className="text-[10px] text-gray-400">{g.pages_count} pagina(s)</span>
                    <span className="text-[10px] text-gray-400">·</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(g.last_seen).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-800 truncate">{g.error_msg}</p>
                  {g.pages.slice(0, 2).map((p) => (
                    <span key={p} className="inline-block text-[9px] bg-gray-200 text-gray-500 rounded px-1.5 py-0.5 mr-1 mt-1">{p}</span>
                  ))}
                </div>
                <span className={cn(
                  'shrink-0 px-2 py-1 rounded-full text-xs font-bold',
                  g.count >= 10 ? 'bg-red-100 text-red-600' : g.count >= 3 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500',
                )}>
                  {g.count}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent errors timeline */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Errores recientes</h3>
        <div className="space-y-1.5">
          {data.recent.slice(0, 20).map((e) => {
            const Icon = TYPE_ICON[e.error_type] ?? AlertTriangle
            return (
              <div key={e.id} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
                <Icon size={11} className="mt-0.5 shrink-0" style={{ color: TYPE_COLOR[e.error_type] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 truncate">{e.error_msg}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{e.page_path}</p>
                </div>
                <p className="text-[9px] text-gray-400 shrink-0 whitespace-nowrap">
                  {new Date(e.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
