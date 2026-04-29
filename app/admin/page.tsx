'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign, ShoppingBag, TrendingUp, Percent, Users, Clock,
  Package, BarChart3,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/utils/format'
import { PeriodSelector, type DateRange } from '@/components/admin/analytics/PeriodSelector'
import { MetricCard, computeDelta } from '@/components/admin/analytics/MetricCard'
import { FunnelChart } from '@/components/admin/analytics/FunnelChart'
import { AlertCard } from '@/components/admin/analytics/AlertCard'
import { EmptyState } from '@/components/admin/analytics/EmptyState'
import { ExportButton } from '@/components/admin/analytics/ExportButton'
import { useAnalytics } from '@/components/admin/analytics/useAnalytics'
import type {
  DashboardSummary,
  RevenuePoint,
  ProductPerformance,
  CategoryPerformance,
  AffiliateROI,
  FunnelStage,
} from '@/lib/supabase/queries/analytics'
import Link from 'next/link'

const COLORS = ['#FFC107', '#10B981', '#8B5CF6', '#EF4444', '#3B82F6', '#F59E0B']

function getDefaultRange(): DateRange {
  return {
    dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    dateTo: new Date().toISOString().slice(0, 10),
  }
}

export default function AdminDashboard() {
  const [range, setRange] = useState<DateRange>(getDefaultRange)
  const [revenueMetric, setRevenueMetric] = useState<'revenue' | 'orders' | 'aov'>('revenue')

  const commonParams = useMemo(
    () => ({ dateFrom: range.dateFrom, dateTo: range.dateTo }),
    [range],
  )

  const { data: summary, loading: summaryLoading } = useAnalytics<DashboardSummary>(
    '/api/admin/analytics/dashboard/summary',
    { params: commonParams },
  )

  const { data: revenueData, loading: revenueLoading } = useAnalytics<RevenuePoint[]>(
    '/api/admin/analytics/revenue',
    { params: { ...commonParams, granularity: 'day' } },
  )

  const { data: topProducts, loading: productsLoading } = useAnalytics<ProductPerformance[]>(
    '/api/admin/analytics/products',
    { params: { ...commonParams, limit: '5', sortBy: 'revenue' } },
  )

  const { data: topCategories, loading: categoriesLoading } = useAnalytics<CategoryPerformance[]>(
    '/api/admin/analytics/categories',
    { params: commonParams },
  )

  const { data: topAffiliates } = useAnalytics<AffiliateROI[]>(
    '/api/admin/analytics/affiliates/roi',
    { params: commonParams },
  )

  const { data: funnel, loading: funnelLoading } = useAnalytics<FunnelStage[]>(
    '/api/admin/analytics/funnel',
    { params: commonParams },
  )

  const revDelta = summary ? computeDelta(summary.revenue, summary.prev_revenue) : undefined
  const ordersDelta = summary ? computeDelta(summary.orders, summary.prev_orders) : undefined
  const aovDelta = summary ? computeDelta(summary.aov, summary.prev_aov) : undefined

  const heroMetrics = [
    {
      label: 'Revenue neto',
      value: summary ? formatPrice(summary.revenue) : '-',
      delta: revDelta,
      icon: DollarSign,
      iconColor: '#10B981',
    },
    {
      label: 'Pedidos',
      value: summary ? summary.orders.toLocaleString('es-MX') : '-',
      delta: ordersDelta,
      icon: ShoppingBag,
      iconColor: '#FFC107',
    },
    {
      label: 'Ticket promedio',
      value: summary ? formatPrice(summary.aov) : '-',
      delta: aovDelta,
      icon: TrendingUp,
      iconColor: '#8B5CF6',
    },
    {
      label: 'Margen bruto',
      value: summary ? `${summary.gross_margin.toFixed(1)}%` : '-',
      icon: Percent,
      iconColor: '#F59E0B',
    },
    {
      label: 'Clientes nuevos',
      value: summary ? summary.new_customers.toLocaleString('es-MX') : '-',
      icon: Users,
      iconColor: '#3B82F6',
    },
    {
      label: 'Pedidos pendientes',
      value: summary ? summary.pending_orders.toLocaleString('es-MX') : '-',
      icon: Clock,
      iconColor: '#EF4444',
    },
  ]

  const revenueChartData = revenueData ?? []

  const categoryChartData = (topCategories ?? []).slice(0, 6).map((c) => ({
    name: c.category,
    value: c.revenue,
  }))

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Vista ejecutiva del negocio</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <PeriodSelector value={range} onChange={setRange} />
          <ExportButton report="full_dashboard" dateFrom={range.dateFrom} dateTo={range.dateTo} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {heroMetrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <MetricCard
              label={m.label}
              value={m.value}
              delta={m.delta}
              icon={m.icon}
              iconColor={m.iconColor}
              loading={summaryLoading}
            />
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Tendencia de revenue</h2>
          <div className="flex gap-1">
            {(['revenue', 'orders', 'aov'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setRevenueMetric(m)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  revenueMetric === m ? 'bg-amber-400 text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {m === 'revenue' ? 'Revenue' : m === 'orders' ? 'Pedidos' : 'Ticket Prom.'}
              </button>
            ))}
          </div>
        </div>

        {revenueLoading ? (
          <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
        ) : revenueChartData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-main" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFC107" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#FFC107" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-prev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(d) => new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                width={70}
                tickFormatter={(v) => revenueMetric === 'orders' ? v : formatPrice(v)}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                formatter={(v: unknown) => {
                  const n = Number(v ?? 0)
                  return [
                    revenueMetric === 'orders' ? n.toLocaleString('es-MX') : formatPrice(n),
                    revenueMetric === 'revenue' ? 'Revenue' : revenueMetric === 'orders' ? 'Pedidos' : 'Ticket Prom.',
                  ]
                }}
              />
              <Area
                type="monotone"
                dataKey={`prev_${revenueMetric}`}
                stroke="#94A3B8"
                strokeWidth={1}
                strokeDasharray="4 4"
                fill="url(#grad-prev)"
                dot={false}
                name="Periodo anterior"
              />
              <Area
                type="monotone"
                dataKey={revenueMetric}
                stroke="#FFC107"
                strokeWidth={2}
                fill="url(#grad-main)"
                dot={false}
                name={revenueMetric === 'revenue' ? 'Revenue' : revenueMetric === 'orders' ? 'Pedidos' : 'Ticket Prom.'}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Top productos</h3>
            <Link href="/admin/analytics?tab=products" className="text-xs text-amber-600 hover:underline">
              Ver todos
            </Link>
          </div>
          {productsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : (topProducts ?? []).length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {(topProducts ?? []).map((p, i) => (
                <div key={p.product_id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{p.product_name}</p>
                    <div className="mt-0.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${(p.revenue / ((topProducts?.[0]?.revenue ?? 1))) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-700 shrink-0">{formatPrice(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Categorias</h3>
            <Link href="/admin/analytics?tab=products" className="text-xs text-amber-600 hover:underline">
              Ver todas
            </Link>
          </div>
          {categoriesLoading ? (
            <div className="h-44 bg-gray-50 rounded-xl animate-pulse" />
          ) : categoryChartData.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {categoryChartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: unknown) => [formatPrice(Number(v ?? 0)), 'Revenue']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            {categoryChartData.slice(0, 4).map((c, i) => (
              <div key={c.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-[10px] text-gray-600 truncate">{c.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Top afiliados</h3>
            <Link href="/admin/analytics?tab=marketing" className="text-xs text-amber-600 hover:underline">
              Ver todos
            </Link>
          </div>
          {(topAffiliates ?? []).length === 0 ? (
            <EmptyState message="Sin actividad de afiliados en el período" />
          ) : (
            <div className="space-y-2">
              {(topAffiliates ?? []).slice(0, 5).map((a, i) => (
                <div key={a.affiliate_id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{a.affiliate_name}</p>
                    <p className="text-[10px] text-gray-400">{a.orders} pedidos · {a.conversion_rate}% conv.</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-700 shrink-0">{formatPrice(a.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Funnel de pedidos</h3>
            <Link href="/admin/analytics?tab=operations" className="text-xs text-amber-600 hover:underline">
              Ver detalle
            </Link>
          </div>
          {funnelLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (funnel ?? []).length === 0 ? (
            <EmptyState />
          ) : (
            <FunnelChart data={funnel ?? []} />
          )}
        </div>

        <AlertCard alerts={summary?.alerts ?? []} />
      </div>
    </div>
  )
}
