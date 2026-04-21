'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  TrendingUp, ShoppingBag, MousePointer2, Wallet, DollarSign,
  Tag, Copy, Check, ExternalLink, ChevronRight, Percent,
  Clock,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { formatPrice } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

interface WeeklySale { week: string; amount_cents: number; orders: number }
interface TopProduct { product_name: string; units: number }
interface StatsData {
  total_earned_cents: number
  pending_payout_cents: number
  total_orders: number
  total_clicks: number
  conversion_rate: number
  weekly_sales: WeeklySale[]
  top_products: TopProduct[]
}

// ── Skeleton ──────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-gray-100', className)} />
}

// ── KPI card ──────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, color = 'text-primary-cyan', accent = 'bg-primary-cyan/10',
}: {
  icon: React.ElementType; label: string; value: string; sub?: string
  color?: string; accent?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', accent)}>
          <Icon className={cn('w-3.5 h-3.5', color)} />
        </div>
      </div>
      <p className="text-xl font-black text-primary-dark leading-none">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
    </motion.div>
  )
}

// ── Coupon status badge ────────────────────────────────────────────────────
function CouponBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    paused: 'bg-gray-100 text-gray-600',
    expired: 'bg-red-100 text-red-700',
    exhausted: 'bg-amber-100 text-amber-700',
  }
  const labels: Record<string, string> = {
    active: 'Activo', paused: 'Pausado', expired: 'Vencido', exhausted: 'Agotado',
  }
  return (
    <span className={cn('px-2 py-0.5 text-[10px] font-bold rounded-full', cfg[status] ?? 'bg-gray-100 text-gray-500')}>
      {labels[status] ?? status}
    </span>
  )
}

interface CouponRow {
  id: string; code: string; type: string; value: number
  used_count: number; max_uses: number | null
  starts_at: string | null; expires_at: string | null
  status: string
}

interface ProfileSummary {
  referral_slug: string | null
  coupons: CouponRow[]
}

export default function AffiliateOverviewPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://nurei.mx').replace(/\/$/, '')

  useEffect(() => {
    fetch('/api/affiliate/stats')
      .then((r) => r.json())
      .then(({ data }) => setStats(data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/affiliate/profile')
      .then((r) => r.json())
      .then(({ data }) => setProfile(data))
      .finally(() => setProfileLoading(false))
  }, [])

  const referralUrl = profile?.referral_slug ? `${siteUrl}/?ref=${profile.referral_slug}` : null

  const copyLink = () => {
    if (!referralUrl) return
    void navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="space-y-5 pb-8">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)}
        </div>
        <Skeleton className="h-52" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  if (!stats) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">Error al cargar estadísticas. Recarga la página.</p>
    )
  }

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h1 className="text-2xl font-black text-primary-dark">Resumen</h1>
        <p className="text-xs text-gray-400 mt-0.5">Tu desempeño como afiliado Nurei</p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard
          icon={DollarSign} label="Total ganado"
          value={formatPrice(stats.total_earned_cents)}
          color="text-emerald-600" accent="bg-emerald-50"
        />
        <KpiCard
          icon={Wallet} label="Por cobrar"
          value={formatPrice(stats.pending_payout_cents)}
          sub="Próximo pago" color="text-amber-500" accent="bg-amber-50"
        />
        <KpiCard
          icon={ShoppingBag} label="Órdenes"
          value={String(stats.total_orders)}
          color="text-blue-500" accent="bg-blue-50"
        />
        <KpiCard
          icon={MousePointer2} label="Clics totales"
          value={String(stats.total_clicks)}
          color="text-purple-500" accent="bg-purple-50"
        />
        <KpiCard
          icon={TrendingUp} label="Conversión"
          value={`${stats.conversion_rate}%`}
          sub="Clics → compra" color="text-primary-cyan" accent="bg-primary-cyan/10"
        />
        <div className="bg-gradient-to-br from-primary-dark to-[#0D2A3F] rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Ver ventas</p>
          <Link href="/affiliate/ventas" className="flex items-center gap-1 text-white text-sm font-bold mt-2">
            Historial <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
          Comisiones — últimas 8 semanas
        </h2>
        {stats.weekly_sales.every((w) => w.amount_cents === 0) ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <BarChart className="w-8 h-8 text-gray-200" />
            <p className="text-xs text-gray-400">Aún no tienes comisiones registradas</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={stats.weekly_sales} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(value) => [formatPrice(Number(value ?? 0)), 'Comisión']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', fontSize: 11 }}
              />
              <Bar dataKey="amount_cents" fill="#00C4CC" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Referral link ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tu link de referido</h2>
        {profileLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : referralUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
              <span className="text-xs font-mono text-primary-dark flex-1 truncate min-w-0">{referralUrl}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button" onClick={copyLink}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-bold transition-colors',
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-primary-cyan text-primary-dark hover:bg-primary-cyan/90'
                )}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '¡Copiado!' : 'Copiar link'}
              </button>
              <a
                href={referralUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center h-9 w-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {stats.total_clicks} clics totales · {stats.conversion_rate}% conversión
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Tu link de referido aún no está configurado. Contacta al administrador.</p>
        )}
      </div>

      {/* ── Coupons ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mis cupones</h2>
        </div>
        {profileLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !profile?.coupons?.length ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Tag className="w-8 h-8 text-gray-200" />
            <p className="text-sm text-gray-400">Aún no tienes cupones asignados</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {profile.coupons.map((coupon) => (
              <div key={coupon.id} className="flex items-start justify-between px-5 py-3.5 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-primary-dark text-sm tracking-wide">{coupon.code}</span>
                    <CouponBadge status={coupon.status} />
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Percent className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-500">
                      {coupon.type === 'percentage'
                        ? `${coupon.value}% de descuento`
                        : coupon.type === 'fixed'
                          ? `${formatPrice(coupon.value)} de descuento`
                          : `Condicional · ${coupon.value}%`}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Usos: {coupon.used_count} / {coupon.max_uses ?? '∞'}
                    {coupon.expires_at && ` · Vence: ${new Date(coupon.expires_at).toLocaleDateString('es-MX')}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(coupon.code)
                  }}
                  className="shrink-0 p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                  title="Copiar código"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick links ── */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/affiliate/ventas"
          className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:border-primary-cyan/30 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-primary-cyan/10 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4 text-primary-cyan" />
          </div>
          <div>
            <p className="text-xs font-bold text-primary-dark">Mis ventas</p>
            <p className="text-[10px] text-gray-400">Ver historial completo</p>
          </div>
        </Link>
        <Link
          href="/affiliate/perfil"
          className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:border-primary-cyan/30 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-primary-cyan/10 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4 text-primary-cyan" />
          </div>
          <div>
            <p className="text-xs font-bold text-primary-dark">Datos de cobro</p>
            <p className="text-[10px] text-gray-400">Configura tu pago</p>
          </div>
        </Link>
      </div>

      {/* ── Top products (if any) ── */}
      {stats.top_products.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Top productos referidos</h2>
          <div className="space-y-2.5">
            {stats.top_products.map((p, i) => (
              <div key={p.product_name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-300 w-4 shrink-0">#{i + 1}</span>
                <p className="text-sm font-medium text-primary-dark flex-1 truncate">{p.product_name}</p>
                <span className="text-xs text-gray-500 shrink-0">{p.units} uds.</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
