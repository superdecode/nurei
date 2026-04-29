'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar,
} from 'recharts'
import {
  TrendingUp, ShoppingBag, Users, Tag, Package, Truck,
  CreditCard, BarChart3, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/utils/format'
import { PeriodSelector, type DateRange } from '@/components/admin/analytics/PeriodSelector'
import { MetricCard } from '@/components/admin/analytics/MetricCard'
import { TimeSeriesChart } from '@/components/admin/analytics/TimeSeriesChart'
import { RankingTable } from '@/components/admin/analytics/RankingTable'
import { HeatmapChart } from '@/components/admin/analytics/HeatmapChart'
import { FunnelChart } from '@/components/admin/analytics/FunnelChart'
import { ExportButton } from '@/components/admin/analytics/ExportButton'
import { AlertCard } from '@/components/admin/analytics/AlertCard'
import { EmptyState } from '@/components/admin/analytics/EmptyState'
import { useAnalytics } from '@/components/admin/analytics/useAnalytics'
import type {
  RevenuePoint, ProductPerformance, CategoryPerformance,
  CohortRow, CustomerSegment, LTVData,
  AffiliateROI, CouponPerf, InventoryHealth,
  FunnelStage, PaymentBreakdown, RefundsAnalysis, DeliveryPerf,
} from '@/lib/supabase/queries/analytics'

const COLORS = ['#FFC107', '#10B981', '#8B5CF6', '#EF4444', '#3B82F6', '#F59E0B', '#06B6D4', '#EC4899']

const PAYMENT_LABELS: Record<string, string> = {
  card: 'Tarjeta',
  cash: 'Efectivo',
  transfer: 'Transferencia',
  oxxo: 'OXXO',
  spei: 'SPEI',
  stripe: 'Stripe',
  paypal: 'PayPal',
}

const TABS = [
  { id: 'sales', label: 'Ventas', icon: TrendingUp },
  { id: 'products', label: 'Productos', icon: ShoppingBag },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'marketing', label: 'Marketing', icon: Tag },
  { id: 'operations', label: 'Operaciones', icon: Truck },
  { id: 'forecast', label: 'Forecast', icon: BarChart3 },
  { id: 'inventario', label: 'Inventario', icon: Package },
]

function getDefaultRange(): DateRange {
  return {
    dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    dateTo: new Date().toISOString().slice(0, 10),
  }
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('sales')
  const [range, setRange] = useState<DateRange>(getDefaultRange)

  const params = useMemo(() => ({ dateFrom: range.dateFrom, dateTo: range.dateTo }), [range])
  const enabled = (tab: string) => activeTab === tab

  const { data: revenueData, loading: revenueLoading } = useAnalytics<RevenuePoint[]>(
    '/api/admin/analytics/revenue', { params: { ...params, granularity: 'day' }, enabled: enabled('sales') },
  )
  const { data: paymentsData, loading: paymentsLoading } = useAnalytics<PaymentBreakdown[]>(
    '/api/admin/analytics/payments/breakdown', { params, enabled: enabled('sales') },
  )

  const { data: products, loading: productsLoading } = useAnalytics<ProductPerformance[]>(
    '/api/admin/analytics/products', { params: { ...params, limit: '100' }, enabled: enabled('products') },
  )
  const { data: categories, loading: categoriesLoading } = useAnalytics<CategoryPerformance[]>(
    '/api/admin/analytics/categories', { params, enabled: enabled('products') },
  )
  const { data: inventory, loading: inventoryLoading } = useAnalytics<InventoryHealth[]>(
    '/api/admin/analytics/inventory/health', { enabled: enabled('products') || enabled('inventario') },
  )

  const { data: cohorts, loading: cohortsLoading } = useAnalytics<CohortRow[]>(
    '/api/admin/analytics/customers/cohorts', { params, enabled: enabled('customers') },
  )
  const { data: segments, loading: segmentsLoading } = useAnalytics<CustomerSegment[]>(
    '/api/admin/analytics/customers/segments', { enabled: enabled('customers') },
  )
  const { data: ltvData, loading: ltvLoading } = useAnalytics<LTVData>(
    '/api/admin/analytics/customers/ltv', { enabled: enabled('customers') },
  )

  const { data: affiliates, loading: affiliatesLoading } = useAnalytics<AffiliateROI[]>(
    '/api/admin/analytics/affiliates/roi', { params, enabled: enabled('marketing') },
  )
  const { data: coupons, loading: couponsLoading } = useAnalytics<CouponPerf[]>(
    '/api/admin/analytics/coupons/performance', { params, enabled: enabled('marketing') },
  )

  const { data: funnel, loading: funnelLoading } = useAnalytics<FunnelStage[]>(
    '/api/admin/analytics/funnel', { params, enabled: enabled('operations') },
  )
  const { data: refunds, loading: refundsLoading } = useAnalytics<RefundsAnalysis>(
    '/api/admin/analytics/refunds', { params, enabled: enabled('operations') },
  )
  const { data: delivery, loading: deliveryLoading } = useAnalytics<DeliveryPerf>(
    '/api/admin/analytics/delivery', { params, enabled: enabled('operations') },
  )

  const { data: forecastData, loading: forecastLoading } = useAnalytics<{
    historical: { date: string; revenue: number }[]
    forecast: { date: string; forecast: number; lower: number; upper: number }[]
  }>('/api/admin/analytics/forecast', { params: { historicalDays: '90', forecastDays: '30' }, enabled: enabled('forecast') })

  const cohortMatrix = useMemo(() => {
    if (!cohorts) return { rows: [], cols: [] }
    const maxMonths = 12
    const rows = cohorts.map((c) => {
      const d = new Date(c.cohort_month)
      return d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
    })
    const cols = ['M+0', ...Array.from({ length: maxMonths }, (_, i) => `M+${i + 1}`)]
    const data = cohorts.map((c) => [100, ...Array.from({ length: maxMonths }, (_, i) => c.retention[i + 1] ?? 0)])
    return { rows, cols, data }
  }, [cohorts])

  const inventoryAlerts = useMemo(() => {
    if (!inventory) return []
    return inventory
      .filter((p) => p.status === 'stockout' || p.status === 'low')
      .map((p) => ({
        type: p.status,
        severity: p.status === 'stockout' ? 'high' as const : 'medium' as const,
        message: p.status === 'stockout'
          ? `Sin stock: ${p.product_name}`
          : `Stock bajo: ${p.product_name} (${p.days_of_inventory} días)`,
        link: '/admin/inventario',
      }))
  }, [inventory])

  const forecastChartData = useMemo(() => {
    if (!forecastData) return []
    const hist = forecastData.historical.map((h) => ({ date: h.date, revenue: h.revenue, type: 'hist' }))
    const fcast = forecastData.forecast.map((f) => ({ date: f.date, forecast: f.forecast, lower: f.lower, upper: f.upper, type: 'forecast' }))
    return [...hist.slice(-30), ...fcast]
  }, [forecastData])

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">Reportes operativos y ejecutivos</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <PeriodSelector value={range} onChange={setRange} />
          <ExportButton report="full_dashboard" dateFrom={range.dateFrom} dateTo={range.dateTo} />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-gray-100">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-xs font-medium whitespace-nowrap transition-colors',
                activeTab === tab.id
                  ? 'bg-white border border-b-white border-gray-100 -mb-px text-amber-600'
                  : 'text-gray-500 hover:text-gray-800',
              )}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'sales' && (
        <motion.div key="sales" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Tendencia de revenue</h2>
              <ExportButton report="revenue" dateFrom={range.dateFrom} dateTo={range.dateTo} />
            </div>
            {revenueLoading ? (
              <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
            ) : (revenueData ?? []).length === 0 ? (
              <EmptyState />
            ) : (
              <TimeSeriesChart data={revenueData ?? []} metric="revenue" showComparison />
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Metodos de pago</h2>
              <ExportButton report="revenue" dateFrom={range.dateFrom} dateTo={range.dateTo} />
            </div>
            {paymentsLoading ? (
              <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
            ) : (paymentsData ?? []).length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={paymentsData ?? []} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
                      {(paymentsData ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => [formatPrice(Number(v ?? 0)), 'Revenue']} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {(paymentsData ?? []).map((p, i) => (
                    <div key={p.method} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs text-gray-700">{PAYMENT_LABELS[p.method] ?? p.method}</span>
                          <span className="text-xs font-medium text-gray-900">{formatPrice(p.total)}</span>
                        </div>
                        <div className="flex gap-2 text-[10px] text-gray-400">
                          <span>{p.count} pedidos</span>
                          <span>Exito: {p.success_rate}%</span>
                          <span>AOV: {formatPrice(p.avg_ticket)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'products' && (
        <motion.div key="products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Performance de productos</h2>
              <ExportButton report="products" dateFrom={range.dateFrom} dateTo={range.dateTo} />
            </div>
            {productsLoading ? (
              <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
            ) : (products ?? []).length === 0 ? (
              <EmptyState />
            ) : (
              <RankingTable
                data={products ?? []}
                searchable
                searchPlaceholder="Buscar producto..."
                pageSize={15}
                columns={[
                  { key: 'product_name', label: 'Producto', align: 'left' },
                  { key: 'category', label: 'Categoria', align: 'left' },
                  { key: 'units_sold', label: 'Unidades', align: 'right', showBar: true, format: (v) => Number(v).toLocaleString('es-MX') },
                  { key: 'revenue', label: 'Revenue', align: 'right', format: (v) => formatPrice(Number(v)), showBar: true },
                  { key: 'margin_pct', label: 'Margen', align: 'right', format: (v) => `${Number(v).toFixed(1)}%` },
                  { key: 'conversion_rate', label: 'Conversion', align: 'right', format: (v) => `${Number(v).toFixed(1)}%` },
                ]}
              />
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Matriz BCG (Revenue vs Margen)</h2>
            </div>
            {(products ?? []).length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="revenue" name="Revenue" tickFormatter={formatPrice} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <YAxis dataKey="margin_pct" name="Margen %" tick={{ fontSize: 10, fill: '#94A3B8' }} unit="%" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]?.payload as ProductPerformance
                      return (
                        <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-lg text-xs">
                          <p className="font-semibold text-gray-900 mb-1">{d.product_name}</p>
                          <p className="text-gray-600">Revenue: {formatPrice(d.revenue)}</p>
                          <p className="text-gray-600">Margen: {d.margin_pct}%</p>
                          <p className="text-gray-600">Unidades: {d.units_sold}</p>
                        </div>
                      )
                    }}
                  />
                  <Scatter data={products ?? []} fill="#FFC107" opacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Analisis por categoria</h2>
              <ExportButton report="categories" dateFrom={range.dateFrom} dateTo={range.dateTo} />
            </div>
            {categoriesLoading ? (
              <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
            ) : (categories ?? []).length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(categories ?? []).slice(0, 4).map((c, i) => (
                    <div key={c.category} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-[10px] text-gray-500 capitalize truncate">{c.category}</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{formatPrice(c.revenue)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{c.units_sold.toLocaleString('es-MX')} uds · {c.orders_count} pedidos</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-3">Revenue por categoria</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={[...(categories ?? [])].sort((a, b) => b.revenue - a.revenue)}
                        layout="vertical"
                        margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => formatPrice(v)} tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} width={80} />
                        <Tooltip
                          formatter={(v: unknown) => [formatPrice(Number(v ?? 0)), 'Revenue']}
                          contentStyle={{ borderRadius: 12, fontSize: 11 }}
                        />
                        <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                          {(categories ?? []).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-3">Participacion de revenue</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={categories ?? []}
                          dataKey="revenue"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={45}
                          paddingAngle={2}
                        >
                          {(categories ?? []).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: unknown) => [formatPrice(Number(v ?? 0)), 'Revenue']}
                          contentStyle={{ borderRadius: 12, fontSize: 11 }}
                        />
                        <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10 }} formatter={(v) => String(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-3">Unidades vendidas y margen por categoria</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={[...(categories ?? [])].sort((a, b) => b.units_sold - a.units_sold)}
                      margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="category" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="units" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="margin" orientation="right" unit="%" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 11 }}
                        formatter={(v: unknown, name: unknown) =>
                          name === 'margin_pct' ? [`${Number(v).toFixed(1)}%`, 'Margen'] : [Number(v).toLocaleString('es-MX'), 'Unidades']
                        }
                      />
                      <Bar yAxisId="units" dataKey="units_sold" name="Unidades" fill="#FFC107" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="margin" dataKey="margin_pct" name="margin_pct" fill="#10B981" radius={[4, 4, 0, 0]} opacity={0.7} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Salud del inventario</h2>
              <ExportButton report="inventory" dateFrom={range.dateFrom} dateTo={range.dateTo} />
            </div>
            {inventoryLoading ? (
              <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
            ) : (inventory ?? []).length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {inventoryAlerts.length > 0 && (
                  <div className="mb-4">
                    <AlertCard alerts={inventoryAlerts} />
                  </div>
                )}
                <RankingTable
                  data={inventory ?? []}
                  searchable
                  searchPlaceholder="Buscar producto..."
                  pageSize={15}
                  columns={[
                    { key: 'product_name', label: 'Producto', align: 'left' },
                    { key: 'category', label: 'Categoria', align: 'left' },
                    { key: 'stock_quantity', label: 'Stock', align: 'right', format: (v) => Number(v).toLocaleString('es-MX') },
                    { key: 'units_sold_30d', label: 'Ventas 30d', align: 'right', format: (v) => Number(v).toLocaleString('es-MX') },
                    { key: 'days_of_inventory', label: 'Dias Inv.', align: 'right', format: (v) => Number(v) >= 9999 ? 'N/A' : String(v) },
                    {
                      key: 'status', label: 'Estado', align: 'center', sortable: false,
                      format: (v) => {
                        const status = String(v)
                        const styles: Record<string, string> = {
                          stockout: 'text-red-600 bg-red-50',
                          low: 'text-amber-600 bg-amber-50',
                          overstock: 'text-purple-600 bg-purple-50',
                          no_sales: 'text-gray-500 bg-gray-50',
                          ok: 'text-green-600 bg-green-50',
                        }
                        const labels: Record<string, string> = {
                          stockout: 'Sin stock', low: 'Bajo', overstock: 'Sobrestock', no_sales: 'Sin ventas', ok: 'OK',
                        }
                        return (
                          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', styles[status] ?? '')}>
                            {labels[status] ?? status}
                          </span>
                        )
                      },
                    },
                  ]}
                />
              </>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'customers' && (
        <motion.div key="customers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Matriz de cohortes (retencion)</h2>
            </div>
            {cohortsLoading ? (
              <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
            ) : !cohortMatrix.rows.length ? (
              <EmptyState />
            ) : (
              <HeatmapChart
                data={cohortMatrix.data ?? []}
                rowLabels={cohortMatrix.rows}
                colLabels={cohortMatrix.cols}
                format={(v) => `${v}%`}
              />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Segmentacion RFM</h2>
              </div>
              {segmentsLoading ? (
                <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
              ) : (segments ?? []).length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart
                    innerRadius="20%"
                    outerRadius="90%"
                    data={(segments ?? []).map((s, i) => ({ name: s.segment, value: s.count, fill: COLORS[i % COLORS.length] }))}
                  >
                    <RadialBar dataKey="value" label={{ position: 'insideStart', fill: '#fff', fontSize: 10 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  </RadialBarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Distribucion LTV</h2>
              </div>
              {ltvLoading ? (
                <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
              ) : !ltvData?.buckets.length ? (
                <EmptyState />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 mb-1">LTV Promedio</p>
                      <p className="text-sm font-bold text-gray-900">{formatPrice(ltvData.avg_ltv)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 mb-1">LTV Mediana</p>
                      <p className="text-sm font-bold text-gray-900">{formatPrice(ltvData.median_ltv)}</p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={ltvData.buckets} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11 }} />
                      <Bar dataKey="count" fill="#FFC107" radius={[4, 4, 0, 0]} name="Clientes" />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Top clientes por LTV</h2>
              <ExportButton report="customers" dateFrom={range.dateFrom} dateTo={range.dateTo} />
            </div>
            {ltvLoading ? (
              <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
            ) : !(ltvData?.top_customers ?? []).length ? (
              <EmptyState />
            ) : (
              <RankingTable
                data={ltvData?.top_customers ?? []}
                searchable
                searchPlaceholder="Buscar cliente..."
                columns={[
                  { key: 'name', label: 'Cliente', align: 'left' },
                  { key: 'phone', label: 'Telefono', align: 'left' },
                  { key: 'ltv', label: 'LTV', align: 'right', format: (v) => formatPrice(Number(v)), showBar: true },
                  { key: 'orders', label: 'Pedidos', align: 'right', format: (v) => Number(v).toLocaleString('es-MX') },
                  { key: 'last_order_at', label: 'Ultimo pedido', align: 'left', format: (v) => v ? new Date(String(v)).toLocaleDateString('es-MX') : '-' },
                ]}
              />
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'marketing' && (
        <motion.div key="marketing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">ROI por afiliado</h2>
              <ExportButton report="affiliates" dateFrom={range.dateFrom} dateTo={range.dateTo} />
            </div>
            {affiliatesLoading ? (
              <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
            ) : (affiliates ?? []).length === 0 ? (
              <EmptyState message="Sin actividad de afiliados en el periodo" />
            ) : (
              <RankingTable
                data={affiliates ?? []}
                searchable
                searchPlaceholder="Buscar afiliado..."
                columns={[
                  { key: 'affiliate_name', label: 'Afiliado', align: 'left' },
                  { key: 'orders', label: 'Pedidos', align: 'right', format: (v) => Number(v).toLocaleString('es-MX') },
                  { key: 'revenue', label: 'Revenue', align: 'right', format: (v) => formatPrice(Number(v)), showBar: true },
                  { key: 'commissions_paid', label: 'Comisiones', align: 'right', format: (v) => formatPrice(Number(v)) },
                  { key: 'roi', label: 'ROI', align: 'right', format: (v) => `${Number(v).toFixed(1)}%` },
                  { key: 'conversion_rate', label: 'Conversion', align: 'right', format: (v) => `${Number(v).toFixed(1)}%` },
                  { key: 'clicks', label: 'Clics', align: 'right', format: (v) => Number(v).toLocaleString('es-MX') },
                ]}
              />
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Performance de cupones</h2>
              <ExportButton report="coupons" dateFrom={range.dateFrom} dateTo={range.dateTo} />
            </div>
            {couponsLoading ? (
              <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
            ) : (coupons ?? []).length === 0 ? (
              <EmptyState message="Sin uso de cupones en el periodo" />
            ) : (
              <RankingTable
                data={coupons ?? []}
                columns={[
                  { key: 'code', label: 'Codigo', align: 'left' },
                  { key: 'uses', label: 'Usos', align: 'right', format: (v) => Number(v).toLocaleString('es-MX') },
                  { key: 'discount_total', label: 'Descuento total', align: 'right', format: (v) => formatPrice(Number(v)) },
                  { key: 'revenue_attributed', label: 'Revenue', align: 'right', format: (v) => formatPrice(Number(v)), showBar: true },
                  { key: 'roi', label: 'ROI', align: 'right', format: (v) => `${Number(v).toFixed(1)}%` },
                  { key: 'redemption_rate', label: 'Redencion', align: 'right', format: (v) => `${Number(v).toFixed(1)}%` },
                ]}
              />
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'operations' && (
        <motion.div key="operations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Funnel de pedidos</h2>
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

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Performance de entrega</h2>
              </div>
              {deliveryLoading ? (
                <div className="h-32 bg-gray-50 rounded-xl animate-pulse" />
              ) : !delivery ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 mb-1">Tiempo promedio</p>
                    <p className="text-xl font-bold text-gray-900">{delivery.avg_hours}h</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 mb-1">On-time rate</p>
                    <p className="text-xl font-bold text-gray-900">{delivery.on_time_rate}%</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Analisis de devoluciones</h2>
              <ExportButton report="refunds" dateFrom={range.dateFrom} dateTo={range.dateTo} />
            </div>
            {refundsLoading ? (
              <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
            ) : !refunds ? (
              <EmptyState />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 mb-1">Total devoluciones</p>
                    <p className="text-lg font-bold text-gray-900">{refunds.total_refunds}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 mb-1">Monto total</p>
                    <p className="text-lg font-bold text-gray-900">{formatPrice(refunds.total_amount)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 mb-1">Tasa devolucion</p>
                    <p className="text-lg font-bold text-gray-900">{refunds.refund_rate}%</p>
                  </div>
                </div>

                {refunds.by_reason.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Por motivo</h4>
                    <div className="space-y-1.5">
                      {refunds.by_reason.map((r) => (
                        <div key={r.reason} className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 w-40 truncate">{r.reason}</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                            <div
                              className="h-full bg-red-400 rounded-full"
                              style={{ width: `${(r.count / refunds.total_refunds) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'inventario' && (
        <motion.div key="inventario" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {inventoryLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-50 rounded-2xl animate-pulse" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Productos activos', value: (inventory ?? []).length, color: 'text-blue-700' },
                  { label: 'Stock bajo', value: (inventory ?? []).filter((p) => p.status === 'low').length, color: 'text-amber-600' },
                  { label: 'Sin stock', value: (inventory ?? []).filter((p) => p.status === 'stockout').length, color: 'text-red-600' },
                  {
                    label: 'Valor estimado',
                    value: formatPrice((inventory ?? []).reduce((s, p) => s + p.cost_estimate_cents * p.stock_quantity, 0)),
                    color: 'text-emerald-700',
                    raw: true,
                  },
                ].map((card) => (
                  <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{card.label}</p>
                    <p className={`text-2xl font-bold ${card.color}`}>
                      {'raw' in card && card.raw ? card.value : Number(card.value).toLocaleString('es-MX')}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Top 5 productos por movimiento (30d)</h2>
                {(inventory ?? []).filter((p) => p.units_sold_30d > 0).length === 0 ? (
                  <EmptyState message="Sin ventas en los ultimos 30 dias" />
                ) : (() => {
                  const top5 = [...(inventory ?? [])].sort((a, b) => b.units_sold_30d - a.units_sold_30d).slice(0, 5)
                  const topMax = top5[0]?.units_sold_30d ?? 1
                  return (
                    <div className="space-y-3">
                      {top5.map((p, i) => (
                        <div key={p.product_id} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between mb-0.5">
                              <span className="text-xs text-gray-800 truncate font-medium">{p.product_name}</span>
                              <span className="text-xs font-bold text-gray-900 ml-2 shrink-0">{p.units_sold_30d} uds</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full">
                              <div
                                className="h-full bg-amber-400 rounded-full"
                                style={{ width: `${(p.units_sold_30d / topMax) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </>
          )}
        </motion.div>
      )}

      {activeTab === 'forecast' && (
        <motion.div key="forecast" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Proyeccion de revenue (30 dias)</h2>
            </div>
            {forecastLoading ? (
              <div className="h-72 bg-gray-50 rounded-xl animate-pulse" />
            ) : forecastChartData.length === 0 ? (
              <EmptyState message="Insuficientes datos historicos para proyeccion" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={forecastChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                    tickFormatter={formatPrice}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                    formatter={(v: unknown) => [formatPrice(Number(v ?? 0))]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenue" fill="#FFC107" name="Historico" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="forecast" fill="#3B82F6" name="Proyectado" radius={[2, 2, 0, 0]} opacity={0.8} />
                  <Bar dataKey="upper" fill="#BFDBFE" name="Maximo" radius={[2, 2, 0, 0]} opacity={0.5} />
                  <Bar dataKey="lower" fill="#DBEAFE" name="Minimo" radius={[2, 2, 0, 0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}
