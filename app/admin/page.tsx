'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Package, DollarSign, Clock, TrendingUp, ShoppingBag, CheckCircle,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Eye, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts'

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
]

const METRICS = [
  { label: 'Pedidos hoy', value: 23, prev: 19, icon: Package, color: '#FFC107', format: 'number' },
  { label: 'Ingresos hoy', value: 1245000, prev: 980000, icon: DollarSign, color: '#10B981', format: 'currency' },
  { label: 'Ticket promedio', value: 54100, prev: 51500, icon: ShoppingBag, color: '#FFC107', format: 'currency' },
  { label: 'En proceso', value: 3, prev: null, icon: Clock, color: '#FFC107', format: 'number' },
  { label: 'Tiempo promedio', value: 22, prev: 25, icon: TrendingUp, color: '#FFC107', format: 'minutes', invertDelta: true },
  { label: 'Tasa éxito', value: 94, prev: 91, icon: CheckCircle, color: '#10B981', format: 'percent' },
]

const HOURLY_DATA = [
  { hour: '17h', orders: 2, revenue: 98000 },
  { hour: '18h', orders: 5, revenue: 245000 },
  { hour: '19h', orders: 4, revenue: 196000 },
  { hour: '20h', orders: 6, revenue: 312000 },
  { hour: '21h', orders: 3, revenue: 147000 },
  { hour: '22h', orders: 2, revenue: 148000 },
  { hour: '23h', orders: 1, revenue: 99000 },
]

const CATEGORY_DATA = [
  { name: 'Cerveza', value: 42, color: '#FFC107' },
  { name: 'Tequila', value: 25, color: '#111827' },
  { name: 'Whisky', value: 15, color: '#FF9800' },
  { name: 'Vodka', value: 10, color: '#10B981' },
  { name: 'Otros', value: 8, color: '#9CA3AF' },
]

const TOP_PRODUCTS = [
  { name: 'Cerveza Victoria 12-pack', orders: 47, revenue: 987000, trend: 'up' },
  { name: 'Tequila Jimador Blanco', orders: 23, revenue: 805000, trend: 'up' },
  { name: 'Whisky Buchanans 12', orders: 12, revenue: 1104000, trend: 'down' },
  { name: 'Vodka Absolut 750ml', orders: 18, revenue: 684000, trend: 'up' },
  { name: 'Cerveza Corona 12-pack', orders: 31, revenue: 744000, trend: 'up' },
]

const RECENT_ORDERS = [
  { id: 'INB-003', phone: '5511..', total: 95000, status: 'pending', time: 'hace 2 min' },
  { id: 'INB-002', phone: '5598..', total: 79000, status: 'in_transit', time: 'hace 15 min' },
  { id: 'INB-001', phone: '5512..', total: 59000, status: 'confirmed', time: 'hace 20 min' },
]

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-gray-100 text-gray-700',
  in_transit: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
}

function formatMetric(value: number, format: string): string {
  switch (format) {
    case 'currency': return `$${(value / 100).toLocaleString('es-MX')}`
    case 'percent': return `${value}%`
    case 'minutes': return `${value} min`
    default: return value.toLocaleString('es-MX')
  }
}

function getDelta(current: number, prev: number | null, invert = false): { value: string; positive: boolean } | null {
  if (prev === null) return null
  const delta = ((current - prev) / prev) * 100
  const positive = invert ? delta < 0 : delta > 0
  return { value: `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`, positive }
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState('today')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Vista general del negocio</p>
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

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {METRICS.map(({ label, value, prev, icon: Icon, color, format, invertDelta }, idx) => {
          const delta = getDelta(value, prev, invertDelta)
          return (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide truncate">
                  {label}
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-primary-dark">
                {formatMetric(value, format)}
              </p>
              {delta && (
                <div className={cn(
                  'flex items-center gap-0.5 mt-1 text-[10px] font-medium',
                  delta.positive ? 'text-success' : 'text-error'
                )}>
                  {delta.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {delta.value} vs ayer
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Orders by hour */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
        >
          <h3 className="text-sm font-semibold text-primary-dark mb-4">Pedidos por hora</h3>
          <div className="h-[220px] sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={HOURLY_DATA}>
                <defs>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFC107" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FFC107" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="orders" stroke="#FFC107" strokeWidth={2.5} fill="url(#colorOrders)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Category distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
        >
          <h3 className="text-sm font-semibold text-primary-dark mb-4">Por categoría</h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={CATEGORY_DATA} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                  {CATEGORY_DATA.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {CATEGORY_DATA.map((cat) => (
              <div key={cat.name} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name} ({cat.value}%)
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
        >
          <h3 className="text-sm font-semibold text-primary-dark mb-4">Productos más vendidos</h3>
          <div className="space-y-3">
            {TOP_PRODUCTS.map((product, idx) => (
              <div key={product.name} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary-dark truncate">{product.name}</p>
                  <p className="text-[10px] text-gray-400">{product.orders} pedidos</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-primary-cyan">${(product.revenue / 100).toLocaleString('es-MX')}</p>
                  {product.trend === 'up' ? (
                    <ArrowUpRight className="w-3 h-3 text-success inline" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 text-error inline" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent orders + alerts */}
        <div className="space-y-4 sm:space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-primary-dark">Pedidos recientes</h3>
              <a href="/admin/pedidos" className="text-xs text-primary-cyan hover:underline flex items-center gap-1">
                Ver todos <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="space-y-3">
              {RECENT_ORDERS.map((order) => (
                <div key={order.id} className="flex items-center gap-3 text-sm">
                  <span className="font-mono font-bold text-xs text-primary-dark">{order.id}</span>
                  <span className="text-gray-400">{order.phone}</span>
                  <span className="flex-1" />
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[order.status] || 'bg-gray-100')}>
                    {order.status === 'pending' ? 'Pendiente de pago' : order.status === 'confirmed' ? 'Confirmado' : 'En camino'}
                  </span>
                  <span className="font-medium">${(order.total / 100).toLocaleString('es-MX')}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Alerts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-5 border border-yellow-200/50"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-primary-dark">Alertas</h3>
                <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                    Buchanans 12 con baja disponibilidad (70%)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-error" />
                    Pedido INB-003 sin movimiento hace 5 min
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-cyan" />
                    Pico de demanda detectado: 20-21h
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
