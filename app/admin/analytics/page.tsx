'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
  RadialBarChart, RadialBar, Legend,
} from 'recharts'
import {
  TrendingUp, Users, MapPin, CreditCard, Truck, Clock,
  Repeat, Zap, CalendarDays, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ──────────────────────────────────────────────
   Color palette
   ────────────────────────────────────────────── */
const CYAN = '#00E5FF'
const DARK = '#0A1F2F'
const GREEN = '#10B981'
const AMBER = '#F59E0B'
const RED = '#EF4444'
const PURPLE = '#8B5CF6'

/* ──────────────────────────────────────────────
   Period selector
   ────────────────────────────────────────────── */
const PERIOD_OPTIONS = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: '1y', label: '1 año' },
]

/* ──────────────────────────────────────────────
   1. Revenue trend — 30 data points
   ────────────────────────────────────────────── */
const REVENUE_TREND = Array.from({ length: 30 }, (_, i) => {
  const base = 8000 + Math.sin(i / 4) * 3000
  const noise = (Math.sin(i * 7.3) * 1500) + (Math.cos(i * 3.1) * 800)
  const revenue = Math.round(base + noise + (i * 120))
  const orders = Math.round(12 + Math.sin(i / 3) * 5 + (Math.cos(i * 2.7) * 3))
  return {
    day: `${i + 1} Mar`,
    revenue: Math.max(revenue, 3500),
    orders: Math.max(orders, 5),
  }
})

/* ──────────────────────────────────────────────
   2. Orders by day of week
   ────────────────────────────────────────────── */
const ORDERS_BY_DAY = [
  { day: 'Lun', orders: 18, fill: CYAN },
  { day: 'Mar', orders: 22, fill: CYAN },
  { day: 'Mié', orders: 20, fill: CYAN },
  { day: 'Jue', orders: 25, fill: CYAN },
  { day: 'Vie', orders: 42, fill: GREEN },
  { day: 'Sáb', orders: 55, fill: AMBER },
  { day: 'Dom', orders: 38, fill: PURPLE },
]

/* ──────────────────────────────────────────────
   3. Hourly heatmap data
   ────────────────────────────────────────────── */
const HOURS = ['17h', '18h', '19h', '20h', '21h', '22h', '23h']
const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const HEATMAP_DATA: number[][] = [
  // Lun  Mar  Mié  Jue  Vie  Sáb  Dom
  [  1,   2,   1,   2,   4,   5,   3 ], // 17h
  [  3,   3,   4,   4,   7,   9,   6 ], // 18h
  [  4,   5,   4,   5,   9,  12,   8 ], // 19h
  [  5,   6,   5,   7,  11,  14,  10 ], // 20h
  [  4,   4,   4,   6,  10,  11,   7 ], // 21h
  [  2,   3,   2,   3,   6,   8,   5 ], // 22h
  [  1,   1,   1,   1,   3,   4,   2 ], // 23h
]

function getHeatColor(value: number): string {
  if (value <= 1) return 'bg-cyan-50 text-cyan-400'
  if (value <= 3) return 'bg-cyan-100 text-cyan-600'
  if (value <= 5) return 'bg-cyan-200 text-cyan-700'
  if (value <= 8) return 'bg-cyan-300 text-cyan-800'
  if (value <= 11) return 'bg-cyan-400 text-white'
  return 'bg-cyan-600 text-white'
}

/* ──────────────────────────────────────────────
   4. Category performance (horizontal bar)
   ────────────────────────────────────────────── */
const CATEGORY_PERFORMANCE = [
  { category: 'Cerveza', revenue: 48500, color: CYAN },
  { category: 'Tequila', revenue: 32200, color: DARK },
  { category: 'Whisky', revenue: 28800, color: AMBER },
  { category: 'Vodka', revenue: 15600, color: GREEN },
  { category: 'Ron', revenue: 12100, color: PURPLE },
  { category: 'Mezcal', revenue: 9400, color: RED },
  { category: 'Vino', revenue: 7800, color: '#6B7280' },
]

/* ──────────────────────────────────────────────
   5. Customer metrics
   ────────────────────────────────────────────── */
const TOP_ZIP_CODES = [
  { zip: '06600', colonia: 'Roma Norte', orders: 187, pct: 24 },
  { zip: '06100', colonia: 'Condesa', orders: 142, pct: 18 },
  { zip: '11560', colonia: 'Polanco', orders: 118, pct: 15 },
  { zip: '03100', colonia: 'Del Valle', orders: 96, pct: 12 },
  { zip: '06700', colonia: 'Roma Sur', orders: 78, pct: 10 },
]

/* ──────────────────────────────────────────────
   6. Delivery performance (RadialBar)
   ────────────────────────────────────────────── */
const DELIVERY_RADIAL = [
  { name: 'A tiempo', value: 91, fill: GREEN },
  { name: 'Retrasados', value: 7, fill: AMBER },
  { name: 'Cancelados', value: 2, fill: RED },
]

/* ──────────────────────────────────────────────
   7. Revenue by payment method
   ────────────────────────────────────────────── */
const PAYMENT_DATA = [
  { name: 'Tarjeta', value: 52, color: CYAN },
  { name: 'Efectivo', value: 31, color: DARK },
  { name: 'Transferencia', value: 17, color: PURPLE },
]

/* ──────────────────────────────────────────────
   Tooltip style constant
   ────────────────────────────────────────────── */
const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
}

/* ──────────────────────────────────────────────
   Custom Recharts tooltip for currency
   ────────────────────────────────────────────── */
interface CustomPayload {
  name?: string
  value?: number
  dataKey?: string
  color?: string
  payload?: Record<string, unknown>
}

function RevenueTrendTooltip({ active, payload, label }: {
  active?: boolean
  payload?: CustomPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={TOOLTIP_STYLE} className="bg-white p-3">
      <p className="text-xs font-semibold text-primary-dark mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs text-gray-600">
          {entry.dataKey === 'revenue'
            ? `Ingresos: $${(entry.value ?? 0).toLocaleString('es-MX')}`
            : `Pedidos: ${entry.value}`
          }
        </p>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════ */
export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d')

  let sectionIdx = 0
  const nextDelay = () => (sectionIdx++) * 0.1

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Análisis detallado del negocio</p>
        </div>
        <div className="flex gap-1.5 bg-white rounded-xl p-1 border shadow-sm">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                period === opt.value
                  ? 'bg-primary-dark text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 1. Revenue Trend (full width) ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: nextDelay() }}
        className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-primary-dark">Tendencia de ingresos</h3>
            <p className="text-xs text-gray-400 mt-0.5">Ingresos y pedidos diarios</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: CYAN }} />
              Ingresos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: PURPLE }} />
              Pedidos
            </span>
          </div>
        </div>
        <div className="h-[280px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={REVENUE_TREND}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CYAN} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CYAN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PURPLE} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={PURPLE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                interval={4}
              />
              <YAxis
                yAxisId="revenue"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
              />
              <Tooltip content={<RevenueTrendTooltip />} />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                stroke={CYAN}
                strokeWidth={2.5}
                fill="url(#gradRevenue)"
              />
              <Area
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                stroke={PURPLE}
                strokeWidth={1.5}
                fill="url(#gradOrders)"
                strokeDasharray="4 4"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Row: Orders by day + Hourly heatmap ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* 2. Orders by day of week */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: nextDelay() }}
          className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-primary-cyan" />
            <h3 className="text-sm font-semibold text-primary-dark">Pedidos por día de semana</h3>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ORDERS_BY_DAY} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ fontWeight: 600 }} />
                <Bar dataKey="orders" radius={[6, 6, 0, 0]} name="Pedidos">
                  {ORDERS_BY_DAY.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 3. Hourly heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: nextDelay() }}
          className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-primary-cyan" />
            <h3 className="text-sm font-semibold text-primary-dark">Intensidad de pedidos por hora</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-[10px] font-medium text-gray-400 pb-2 text-left pr-2" />
                  {DAYS_OF_WEEK.map((d) => (
                    <th key={d} className="text-[10px] font-medium text-gray-400 pb-2 text-center px-1">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour, hIdx) => (
                  <tr key={hour}>
                    <td className="text-[10px] font-medium text-gray-400 pr-2 py-0.5">
                      {hour}
                    </td>
                    {DAYS_OF_WEEK.map((_, dIdx) => {
                      const val = HEATMAP_DATA[hIdx][dIdx]
                      return (
                        <td key={dIdx} className="px-0.5 py-0.5">
                          <div
                            className={cn(
                              'w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-colors min-w-[32px]',
                              getHeatColor(val)
                            )}
                          >
                            {val}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 mt-3 justify-end">
            <span className="text-[9px] text-gray-400">Bajo</span>
            <div className="flex gap-0.5">
              {['bg-cyan-50', 'bg-cyan-100', 'bg-cyan-200', 'bg-cyan-300', 'bg-cyan-400', 'bg-cyan-600'].map((c) => (
                <div key={c} className={cn('w-3 h-3 rounded-sm', c)} />
              ))}
            </div>
            <span className="text-[9px] text-gray-400">Alto</span>
          </div>
        </motion.div>
      </div>

      {/* ── 4. Category performance (full width) ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: nextDelay() }}
        className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary-cyan" />
          <h3 className="text-sm font-semibold text-primary-dark">Rendimiento por categoría</h3>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={CATEGORY_PERFORMANCE}
              layout="vertical"
              barSize={20}
              margin={{ left: 10, right: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                width={65}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ fontWeight: 600 }}
                formatter={(value) => [`$${Number(value ?? 0).toLocaleString('es-MX')}`, 'Ingresos']}
              />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]} name="Ingresos">
                {CATEGORY_PERFORMANCE.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── 5. Customer metrics ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: nextDelay() }}
        className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-5">
          <Users className="w-4 h-4 text-primary-cyan" />
          <h3 className="text-sm font-semibold text-primary-dark">Métricas de clientes</h3>
        </div>

        {/* Three stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${GREEN}15` }}>
                <Repeat className="w-3.5 h-3.5" style={{ color: GREEN }} />
              </div>
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                Clientes recurrentes
              </span>
            </div>
            <p className="text-2xl font-bold text-primary-dark">38%</p>
            <p className="text-[10px] text-gray-400 mt-1">De los últimos 30 días</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${CYAN}15` }}>
                <TrendingUp className="w-3.5 h-3.5" style={{ color: CYAN }} />
              </div>
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                Frecuencia promedio
              </span>
            </div>
            <p className="text-2xl font-bold text-primary-dark">2.4x</p>
            <p className="text-[10px] text-gray-400 mt-1">Pedidos por cliente / mes</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${PURPLE}15` }}>
                <CreditCard className="w-3.5 h-3.5" style={{ color: PURPLE }} />
              </div>
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                Valor de vida (LTV)
              </span>
            </div>
            <p className="text-2xl font-bold text-primary-dark">$2,840</p>
            <p className="text-[10px] text-gray-400 mt-1">Promedio por cliente</p>
          </div>
        </div>

        {/* Top ZIP codes */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Zonas con más pedidos
            </h4>
          </div>
          <div className="space-y-2.5">
            {TOP_ZIP_CODES.map((z) => (
              <div key={z.zip} className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-primary-dark w-12">{z.zip}</span>
                <span className="text-xs text-gray-500 w-24 truncate">{z.colonia}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${z.pct}%`,
                      backgroundColor: CYAN,
                      minWidth: z.pct > 0 ? '4px' : '0px',
                    }}
                  />
                </div>
                <span className="text-[10px] font-medium text-gray-400 w-16 text-right">
                  {z.orders} pedidos
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Row: Delivery performance + Payment method ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* 6. Delivery performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: nextDelay() }}
          className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-4 h-4 text-primary-cyan" />
            <h3 className="text-sm font-semibold text-primary-dark">Rendimiento de entregas</h3>
          </div>

          <div className="flex items-center gap-6">
            <div className="h-[200px] w-[200px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="30%"
                  outerRadius="100%"
                  data={DELIVERY_RADIAL}
                  startAngle={180}
                  endAngle={0}
                  barSize={12}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={6}
                    background={{ fill: '#f3f4f6' }}
                  />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4 flex-1">
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                  Tasa de entrega a tiempo
                </p>
                <p className="text-3xl font-bold text-primary-dark">91%</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] text-gray-400">Promedio</span>
                  </div>
                  <p className="text-lg font-bold text-primary-dark">24 min</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap className="w-3 h-3 text-green-500" />
                    <span className="text-[10px] text-gray-400">Más rápido</span>
                  </div>
                  <p className="text-lg font-bold text-green-600">12 min</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="w-3 h-3 text-red-400" />
                    <span className="text-[10px] text-gray-400">Más lento</span>
                  </div>
                  <p className="text-lg font-bold text-red-500">48 min</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 7. Revenue by payment method */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: nextDelay() }}
          className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-primary-cyan" />
            <h3 className="text-sm font-semibold text-primary-dark">Ingresos por método de pago</h3>
          </div>

          <div className="flex flex-col items-center">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={PAYMENT_DATA}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    strokeWidth={0}
                  >
                    {PAYMENT_DATA.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [`${value ?? 0}%`, 'Porcentaje']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-2">
              {PAYMENT_DATA.map((pm) => (
                <div key={pm.name} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: pm.color }}
                  />
                  <span className="text-xs text-gray-500">{pm.name}</span>
                  <span className="text-xs font-bold text-primary-dark">{pm.value}%</span>
                </div>
              ))}
            </div>

            {/* Breakdown amounts */}
            <div className="w-full mt-5 space-y-2">
              {[
                { label: 'Tarjeta', amount: '$78,520', pct: 52, color: CYAN },
                { label: 'Efectivo', amount: '$46,810', pct: 31, color: DARK },
                { label: 'Transferencia', amount: '$25,670', pct: 17, color: PURPLE },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24">{m.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${m.pct}%`,
                        backgroundColor: m.color,
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-primary-dark w-16 text-right">
                    {m.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
