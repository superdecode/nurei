'use client'

import { CheckCircle2, XCircle, AlertCircle, Search } from 'lucide-react'
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts'
import { EmptyState } from '@/components/admin/analytics/EmptyState'
import { cn } from '@/lib/utils'

interface SeoChecklist {
  label: string
  passed: boolean
  value: string
}

interface SeoData {
  score: number
  products: {
    total: number
    with_description: number
    with_images: number
    with_slug: number
    missing_description: { id: string; name: string }[]
  }
  categories: {
    total: number
    with_description: number
  }
  checklist: SeoChecklist[]
}

interface Props {
  data: SeoData | null
  loading: boolean
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444'
  const gaugeData = [{ value: score, fill: color }]
  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="70%" outerRadius="100%" data={gaugeData} startAngle={90} endAngle={-270} barSize={14}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#F1F5F9' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[9px] text-gray-400">/ 100</span>
      </div>
    </div>
  )
}

function pct(num: number, den: number) {
  if (den === 0) return 0
  return Math.round((num / den) * 100)
}

export function SeoPanel({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 bg-gray-50 rounded-2xl animate-pulse" />
        <div className="h-48 bg-gray-50 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <EmptyState message="Sin datos SEO disponibles." />
      </div>
    )
  }

  const scoreLabel = data.score >= 80 ? 'Bueno' : data.score >= 50 ? 'Mejorable' : 'Critico'
  const scoreColor = data.score >= 80 ? 'text-emerald-600' : data.score >= 50 ? 'text-amber-500' : 'text-red-500'

  const pillars = [
    { label: 'Descripciones', pct: pct(data.products.with_description, data.products.total), of: data.products.total },
    { label: 'Imagenes', pct: pct(data.products.with_images, data.products.total), of: data.products.total },
    { label: 'Slugs URL', pct: pct(data.products.with_slug, data.products.total), of: data.products.total },
    { label: 'Categ. desc.', pct: pct(data.categories.with_description, data.categories.total), of: data.categories.total },
  ]

  return (
    <div className="space-y-6">
      {/* Score + summary */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-6 flex-wrap">
          <ScoreGauge score={data.score} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Search size={14} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">Score SEO de catalogo</h3>
            </div>
            <p className={cn('text-xl font-bold', scoreColor)}>{scoreLabel}</p>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Basado en completitud de metadatos: descripciones, imagenes, slugs y categorias.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {pillars.map((p) => {
                const color = p.pct >= 80 ? 'bg-emerald-500' : p.pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
                return (
                  <div key={p.label}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[10px] text-gray-500">{p.label}</span>
                      <span className="text-[10px] font-medium text-gray-700">{p.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className={cn('h-full rounded-full', color)} style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Checklist SEO</h3>
        <div className="space-y-2.5">
          {data.checklist.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              {item.passed ? (
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
              ) : (
                <XCircle size={15} className="text-red-400 shrink-0" />
              )}
              <span className="flex-1 text-xs text-gray-700">{item.label}</span>
              <span className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full',
                item.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600',
              )}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Products missing description */}
      {data.products.missing_description.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={14} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-800">
              Productos sin descripcion ({data.products.total - data.products.with_description})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {data.products.missing_description.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs text-gray-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
                <XCircle size={11} className="text-amber-400 shrink-0" />
                <span className="truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Recomendaciones SEO prioritarias</h3>
        <div className="space-y-3">
          {[
            {
              priority: 'Alta',
              color: 'text-red-500 bg-red-50',
              items: [
                'Agregar descripciones a todos los productos (impacta snippet en Google)',
                'Configurar Open Graph en Ajustes > Apariencia para redes sociales',
              ],
            },
            {
              priority: 'Media',
              color: 'text-amber-600 bg-amber-50',
              items: [
                'Agregar texto alt descriptivo a imagenes de productos',
                'Asegurar URLs amigables (slugs) en todos los productos',
                'Completar descripciones de categorias',
              ],
            },
            {
              priority: 'Baja',
              color: 'text-blue-600 bg-blue-50',
              items: [
                'Implementar datos estructurados JSON-LD (Product schema)',
                'Configurar sitemap.xml con todos los productos activos',
              ],
            },
          ].map((group) => (
            <div key={group.priority}>
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', group.color)}>
                {group.priority}
              </span>
              <ul className="mt-2 space-y-1">
                {group.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
