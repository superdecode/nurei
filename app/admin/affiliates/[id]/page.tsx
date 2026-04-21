'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Save, ArrowLeft, Copy, Check, ExternalLink, TrendingUp, ShoppingBag,
  DollarSign, Wallet, MousePointer2, BarChart2, CreditCard, Edit3,
  ChevronLeft, ChevronRight, X, Clock, RefreshCcw, Tag, Link2, Users,
  AlertCircle, Percent, Mail, Phone,
} from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatPrice } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────
interface AffiliateKpis {
  totalOrders: number
  totalCommission: number
  pendingCommission: number
  totalClicks: number
  uniqueClicks: number
  conversionRate: number
}

interface ChartPoint { label: string; sales: number; orders: number }

interface CouponRow {
  id: string; code: string; type: string; value: number
  used_count: number; max_uses: number | null
  starts_at: string | null; expires_at: string | null
  computed_status: 'active' | 'paused' | 'expired' | 'exhausted'
}

interface Attribution {
  id: string; order_id: string; attribution_type: string
  coupon_id: string | null
  commission_pct: number; commission_amount_cents: number
  payout_status: 'pending' | 'paid'; created_at: string
  orders: { short_id: string; total: number; customer_name: string | null; customer_email: string | null } | null
}

interface DetailData {
  profile: {
    id: string; handle: string; bio: string | null; email: string
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
    commission_coupon_pct: number; commission_cookie_pct: number
    total_earned_cents: number; pending_payout_cents: number; is_active: boolean
    created_at: string
    payment_method: string | null; bank_name: string | null; bank_clabe: string | null
    bank_account: string | null; bank_holder: string | null; payment_notes: string | null
  }
  referral_link: { id: string; slug: string; clicks_count: number } | null
  coupons: CouponRow[]
  attributions: Attribution[]
  kpis: AffiliateKpis
  chartData: ChartPoint[]
}

// ── Skeleton ─────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rounded-xl bg-gray-100 animate-pulse', className)} />
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, color = 'text-primary-cyan',
}: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', 'bg-gray-50')}>
          <Icon className={cn('w-3.5 h-3.5', color)} />
        </div>
      </div>
      <p className="text-xl font-black text-primary-dark leading-none">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Status badge helper ───────────────────────────────────────────────────
function CouponStatusBadge({ status }: { status: CouponRow['computed_status'] }) {
  const map = {
    active: 'bg-emerald-100 text-emerald-700',
    paused: 'bg-gray-100 text-gray-600',
    expired: 'bg-red-100 text-red-700',
    exhausted: 'bg-amber-100 text-amber-700',
  }
  const labels = { active: 'Activo', paused: 'Pausado', expired: 'Vencido', exhausted: 'Agotado' }
  return (
    <span className={cn('px-2 py-0.5 text-[10px] font-bold rounded-full', map[status])}>
      {labels[status]}
    </span>
  )
}

// ── Date range pill ───────────────────────────────────────────────────────
function DateRangePill({
  from, to, onFrom, onTo, onClear,
}: {
  from: string; to: string
  onFrom: (v: string) => void; onTo: (v: string) => void; onClear: () => void
}) {
  return (
    <div className="flex items-center rounded-full border border-gray-200 bg-white h-8 shadow-sm overflow-hidden">
      <div className="flex items-center gap-1 px-2.5">
        <Clock className="h-3 w-3 text-gray-400 shrink-0" />
        <input
          type="date" value={from} onChange={(e) => onFrom(e.target.value)}
          className="text-[11px] text-gray-600 bg-transparent outline-none w-[92px] cursor-pointer"
        />
      </div>
      <span className="text-gray-300 text-xs px-0.5">–</span>
      <div className="flex items-center gap-1 px-2.5">
        <input
          type="date" value={to} onChange={(e) => onTo(e.target.value)}
          className="text-[11px] text-gray-600 bg-transparent outline-none w-[92px] cursor-pointer"
        />
      </div>
      {(from || to) && (
        <button type="button" onClick={onClear} className="pr-2.5 text-gray-400 hover:text-gray-600">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function AdminAffiliateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)

  // Commission rates
  const [couponPct, setCouponPct] = useState('')
  const [cookiePct, setCookiePct] = useState('')
  const [saving, setSaving] = useState(false)

  // Payment info
  const [paymentEdit, setPaymentEdit] = useState(false)
  const [payForm, setPayForm] = useState({
    payment_method: '', bank_name: '', bank_clabe: '', bank_account: '', bank_holder: '', payment_notes: '',
  })
  const [savingPayment, setSavingPayment] = useState(false)

  // Chart date filter
  const [chartRange, setChartRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Attributions table
  const [attrPage, setAttrPage] = useState(1)
  const ATTRS_PAGE_SIZE = 10

  // Copy link state
  const [copied, setCopied] = useState(false)

  // Store domain
  const [storeDomain, setStoreDomain] = useState('')

  const fetchData = useCallback(async (from?: string, to?: string) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('dateFrom', from)
    if (to) params.set('dateTo', to)
    const res = await fetch(`/api/admin/affiliates/${id}?${params}`)
    const json = await res.json() as { data?: DetailData }
    if (json.data) {
      setData(json.data)
      setCouponPct(String(json.data.profile.commission_coupon_pct))
      setCookiePct(String(json.data.profile.commission_cookie_pct))
      setPayForm({
        payment_method: json.data.profile.payment_method ?? '',
        bank_name: json.data.profile.bank_name ?? '',
        bank_clabe: json.data.profile.bank_clabe ?? '',
        bank_account: json.data.profile.bank_account ?? '',
        bank_holder: json.data.profile.bank_holder ?? '',
        payment_notes: json.data.profile.payment_notes ?? '',
      })
    }
    setLoading(false)
  }, [id])

  useEffect(() => { void fetchData() }, [fetchData])

  // Fetch store domain from settings
  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((json) => {
        const d = (json.data?.store_domain as string | undefined) ?? (json.data?.site_url as string | undefined) ?? ''
        setStoreDomain(d.replace(/\/$/, ''))
      })
      .catch(() => {})
  }, [])

  // Apply chart range
  useEffect(() => {
    if (chartRange === 'custom') return
    const to = new Date()
    const from = new Date()
    if (chartRange === '7d') from.setDate(to.getDate() - 7)
    else if (chartRange === '30d') from.setDate(to.getDate() - 30)
    else if (chartRange === '90d') from.setDate(to.getDate() - 90)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    void fetchData(fmt(from), fmt(to))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartRange])

  const handleSaveRates = async () => {
    if (!data) return
    const cp = parseInt(couponPct, 10)
    const ck = parseInt(cookiePct, 10)
    if (Number.isNaN(cp) || Number.isNaN(ck)) return
    if (cp === data.profile.commission_coupon_pct && ck === data.profile.commission_cookie_pct) return
    setSaving(true)
    const res = await fetch(`/api/admin/affiliates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commission_coupon_pct: cp,
        commission_cookie_pct: ck,
      }),
    })
    if (res.ok) {
      toast.success('Tasas guardadas')
      void fetchData()
    } else toast.error('Error al actualizar')
    setSaving(false)
  }

  const handleSavePayment = async () => {
    setSavingPayment(true)
    const res = await fetch(`/api/admin/affiliates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payForm),
    })
    if (res.ok) {
      toast.success('Datos de pago guardados')
      setPaymentEdit(false)
      void fetchData()
    } else {
      toast.error('Error al guardar')
    }
    setSavingPayment(false)
  }

  const handleCopyLink = () => {
    const slug = data?.referral_link?.slug
    if (!slug) return
    const base = storeDomain || window.location.origin.replace('/admin', '')
    void navigator.clipboard.writeText(`${base}/?ref=${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <DetailSkeleton />
  if (!data) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle className="w-10 h-10 text-gray-300" />
      <p className="text-gray-500 font-medium">Afiliado no encontrado</p>
      <Link href="/admin/affiliates"><Button variant="outline" size="sm">Volver a afiliados</Button></Link>
    </div>
  )

  const { profile, referral_link, coupons, attributions, kpis, chartData } = data
  const base = storeDomain || ''
  const referralUrl = referral_link ? `${base}/?ref=${referral_link.slug}` : null

  const attrTotal = attributions.length
  const attrStart = (attrPage - 1) * ATTRS_PAGE_SIZE
  const attrSlice = attributions.slice(attrStart, attrStart + ATTRS_PAGE_SIZE)
  const attrPages = Math.max(1, Math.ceil(attrTotal / ATTRS_PAGE_SIZE))

  const hasPaymentInfo = !!(profile.payment_method || profile.bank_name || profile.bank_clabe)

  return (
    <div className="space-y-6 pb-12">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link href="/admin/affiliates" className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-black text-gray-900">@{profile.handle}</h1>
            <span className={cn(
              'px-2 py-0.5 text-[10px] font-bold rounded-full',
              profile.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            )}>
              {profile.is_active ? 'Activo' : 'Inactivo'}
            </span>
            {!hasPaymentInfo && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700">
                Sin datos de pago
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{profile.email}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            const res = await fetch(`/api/admin/affiliates/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_active: !profile.is_active }),
            })
            if (res.ok) {
              toast.success(profile.is_active ? 'Afiliado desactivado' : 'Afiliado activado')
              void fetchData()
            } else {
              toast.error('No se pudo actualizar el estado')
            }
          }}
          className={cn(
            'hidden sm:inline-flex items-center justify-center h-8 min-w-[96px] px-3 rounded-full text-xs font-bold border transition-colors leading-none',
            profile.is_active
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
          )}
        >
          <span className="leading-none">{profile.is_active ? 'Desactivar' : 'Activar'}</span>
        </button>
        <Link href={`/admin/cupones?create=1&affiliateId=${profile.id}`}>
          <Button size="sm" className="h-8 rounded-full text-xs font-semibold hidden sm:flex">
            + Crear cupón
          </Button>
        </Link>
      </div>

      {/* ── Información de contacto (una tarjeta, tres secciones) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          <div className="p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Nombre</p>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-primary-cyan/10 flex items-center justify-center text-xs font-black text-primary-cyan shrink-0 uppercase">
                {profile.first_name || profile.last_name
                  ? `${(profile.first_name ?? '').slice(0, 1)}${(profile.last_name ?? '').slice(0, 1)}`.trim() || profile.handle.slice(0, 2).toUpperCase()
                  : profile.handle.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-400 mb-1">Nombre y apellido</p>
                <p className="text-sm font-bold text-primary-dark leading-snug">
                  {profile.first_name || profile.last_name
                    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ')
                    : '—'}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">@{profile.handle}</p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
              <Mail className="w-3 h-3 shrink-0" /> Correo
            </p>
            <p className="text-sm font-semibold text-primary-dark break-all">{profile.email || '—'}</p>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
              <Phone className="w-3 h-3 shrink-0" /> Teléfono
            </p>
            {profile.phone ? (
              <p className="text-sm font-semibold text-primary-dark">{profile.phone}</p>
            ) : (
              <p className="text-sm text-amber-600">Sin teléfono registrado</p>
            )}
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={DollarSign} label="Comisión total" value={formatPrice(kpis.totalCommission)} color="text-emerald-600" />
        <KpiCard icon={Wallet} label="Pendiente pago" value={formatPrice(kpis.pendingCommission)} sub="Por liquidar" color="text-amber-500" />
        <KpiCard icon={ShoppingBag} label="Pedidos ref." value={String(kpis.totalOrders)} color="text-blue-500" />
        <KpiCard icon={MousePointer2} label="Clics totales" value={String(kpis.totalClicks)} color="text-purple-500" />
        <KpiCard icon={Users} label="Clics únicos" value={String(kpis.uniqueClicks)} color="text-indigo-500" />
        <KpiCard icon={TrendingUp} label="Conversión" value={`${kpis.conversionRate}%`} sub="Clics → pedido" color="text-primary-cyan" />
      </div>

      {/* ── Chart + Rates ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Comisiones por período</h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['7d', '30d', '90d', 'custom'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setChartRange(r)}
                  className={cn(
                    'h-6 px-2.5 rounded-full text-[10px] font-semibold transition-colors',
                    chartRange === r
                      ? 'bg-primary-dark text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  )}
                >
                  {r === '7d' ? '7 días' : r === '30d' ? '30 días' : r === '90d' ? '3 meses' : 'Personalizado'}
                </button>
              ))}
              {chartRange === 'custom' && (
                <DateRangePill
                  from={dateFrom} to={dateTo}
                  onFrom={(v) => { setDateFrom(v); if (dateTo) void fetchData(v, dateTo) }}
                  onTo={(v) => { setDateTo(v); if (dateFrom) void fetchData(dateFrom, v) }}
                  onClear={() => { setDateFrom(''); setDateTo(''); void fetchData() }}
                />
              )}
            </div>
          </div>
          {chartData.every((p) => p.sales === 0) ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <BarChart2 className="w-8 h-8 text-gray-200" />
              <p className="text-xs text-gray-400">Sin comisiones en este período</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v) => [formatPrice(Number(v ?? 0)), 'Comisión']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', fontSize: 11 }}
                />
                <Bar dataKey="sales" fill="#00C4CC" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Rates + referral link */}
        <div className="space-y-4">
          {/* Commission rates */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Tasas de comisión</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-400 block mb-1">Por cupón (%)</label>
                <Input
                  type="number"
                  value={couponPct}
                  onChange={(e) => setCouponPct(e.target.value)}
                  onBlur={() => void handleSaveRates()}
                  className="h-9 text-sm"
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-400 block mb-1">Por link (%)</label>
                <Input
                  type="number"
                  value={cookiePct}
                  onChange={(e) => setCookiePct(e.target.value)}
                  onBlur={() => void handleSaveRates()}
                  className="h-9 text-sm"
                  min={0}
                  max={100}
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Los cambios se guardan al salir del campo</p>
          </div>

          {/* Referral link */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Link de referido</h3>
            {referralUrl ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <Link2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="font-mono text-[11px] text-gray-700 flex-1 truncate">{referralUrl}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm" className="flex-1 h-8 rounded-xl text-xs"
                    onClick={handleCopyLink}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                    {copied ? '¡Copiado!' : 'Copiar'}
                  </Button>
                  <a href={referralUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs px-2.5">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                </div>
                <p className="text-[10px] text-gray-400">{referral_link?.clicks_count ?? 0} clics registrados</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Sin link de referido configurado</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Coupons ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Cupones vinculados
            {coupons.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
                {coupons.length}
              </span>
            )}
          </h3>
          <Link href={`/admin/cupones?create=1&affiliateId=${profile.id}`}>
            <Button size="sm" variant="outline" className="h-7 rounded-full text-xs">+ Crear cupón</Button>
          </Link>
        </div>
        {coupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Tag className="w-8 h-8 text-gray-200" />
            <p className="text-sm text-gray-400 font-medium">Sin cupones vinculados</p>
            <Link href={`/admin/cupones?create=1&affiliateId=${profile.id}`}>
              <Button variant="outline" size="sm" className="h-7 rounded-full text-xs">Crear el primer cupón</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {coupons.map((coupon) => (
              <motion.div
                key={coupon.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono font-bold text-primary-dark text-sm tracking-wide">{coupon.code}</span>
                  <CouponStatusBadge status={coupon.computed_status} />
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Percent className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-600">
                    {coupon.type === 'percentage'
                      ? `${coupon.value}% descuento`
                      : coupon.type === 'fixed'
                        ? `${formatPrice(coupon.value)} descuento`
                        : `Condicional · ${coupon.value}%`}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400">
                  {coupon.starts_at ? new Date(coupon.starts_at).toLocaleDateString('es-MX') : 'Inmediato'} —{' '}
                  {coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString('es-MX') : 'Sin venc.'}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Usos: {coupon.used_count} / {coupon.max_uses ?? '∞'}
                </p>
                <Link href={`/admin/cupones?couponId=${coupon.id}`} className="mt-2.5 inline-block">
                  <Button variant="outline" size="sm" className="h-6 rounded-full text-[10px] px-2.5">Ver cupón</Button>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Attributions table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Ventas y comisiones
            {attrTotal > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
                {attrTotal}
              </span>
            )}
          </h3>
          <Button variant="outline" size="sm" onClick={() => void fetchData()} className="h-7 w-7 rounded-full p-0">
            <RefreshCcw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {attrTotal === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <ShoppingBag className="w-8 h-8 text-gray-200" />
            <p className="text-sm text-gray-400 font-medium">Sin ventas atribuidas aún</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    {['Fecha', 'Pedido', 'Cliente', 'Subtotal', 'Atribución', 'Comisión %', 'Comisión $', 'Estado'].map((h) => (
                      <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attrSlice.map((a) => (
                    <TableRow key={a.id} className="hover:bg-gray-50/30">
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(a.created_at).toLocaleDateString('es-MX')}
                      </TableCell>
                      <TableCell>
                        {a.orders?.short_id ? (
                          <Link href={`/admin/pedidos?id=${a.order_id}`} className="font-mono text-xs font-bold text-primary-dark hover:underline">
                            #{a.orders.short_id}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600 max-w-[140px] truncate">
                        {a.orders?.customer_name ?? a.orders?.customer_email ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-gray-700 whitespace-nowrap">
                        {a.orders?.total ? formatPrice(a.orders.total) : '—'}
                      </TableCell>
                      <TableCell>
                        {a.attribution_type === 'coupon' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">
                            <Tag className="w-2.5 h-2.5" />
                            Cupón
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">
                            <Link2 className="w-2.5 h-2.5" />
                            Referido
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">{a.commission_pct}%</TableCell>
                      <TableCell className="text-xs font-bold text-primary-dark whitespace-nowrap">
                        {formatPrice(a.commission_amount_cents)}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          'px-2 py-0.5 text-[10px] font-bold rounded-full',
                          a.payout_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        )}>
                          {a.payout_status === 'paid' ? 'Pagado' : 'Pendiente'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {attrPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
                <p className="text-xs text-gray-400">
                  {attrStart + 1}–{Math.min(attrStart + ATTRS_PAGE_SIZE, attrTotal)} de {attrTotal}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline" size="sm" className="h-7 w-7 p-0 rounded-full"
                    disabled={attrPage === 1} onClick={() => setAttrPage((p) => p - 1)}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline" size="sm" className="h-7 w-7 p-0 rounded-full"
                    disabled={attrPage >= attrPages} onClick={() => setAttrPage((p) => p + 1)}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Payment info ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Datos de pago</h3>
            {hasPaymentInfo ? (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700">Configurado</span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700">Sin configurar</span>
            )}
          </div>
          <Button
            variant="outline" size="sm" className="h-7 rounded-full text-xs"
            onClick={() => setPaymentEdit((v) => !v)}
          >
            <Edit3 className="w-3 h-3 mr-1" />
            {paymentEdit ? 'Cancelar' : 'Editar'}
          </Button>
        </div>

        <div className="p-5">
          {paymentEdit ? (
            <div className="space-y-3 max-w-lg">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 block mb-1">Método de pago</label>
                  <Input
                    value={payForm.payment_method}
                    onChange={(e) => setPayForm((f) => ({ ...f, payment_method: e.target.value }))}
                    placeholder="ej. SPEI, PayPal"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 block mb-1">Banco</label>
                  <Input
                    value={payForm.bank_name}
                    onChange={(e) => setPayForm((f) => ({ ...f, bank_name: e.target.value }))}
                    placeholder="ej. BBVA, Banorte"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-400 block mb-1">CLABE interbancaria</label>
                <Input
                  value={payForm.bank_clabe}
                  onChange={(e) => setPayForm((f) => ({ ...f, bank_clabe: e.target.value }))}
                  placeholder="18 dígitos"
                  className="h-9 text-sm font-mono"
                  maxLength={18}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 block mb-1">Número de cuenta</label>
                  <Input
                    value={payForm.bank_account}
                    onChange={(e) => setPayForm((f) => ({ ...f, bank_account: e.target.value }))}
                    className="h-9 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 block mb-1">Titular</label>
                  <Input
                    value={payForm.bank_holder}
                    onChange={(e) => setPayForm((f) => ({ ...f, bank_holder: e.target.value }))}
                    placeholder="Nombre completo"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-400 block mb-1">Notas adicionales</label>
                <textarea
                  value={payForm.payment_notes}
                  onChange={(e) => setPayForm((f) => ({ ...f, payment_notes: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-cyan/30 resize-none"
                  rows={2}
                  placeholder="Referencias, instrucciones especiales..."
                />
              </div>
              <Button onClick={handleSavePayment} disabled={savingPayment} className="h-9 rounded-xl text-sm font-semibold">
                <Save className="w-3.5 h-3.5 mr-2" />
                {savingPayment ? 'Guardando...' : 'Guardar datos de pago'}
              </Button>
            </div>
          ) : !hasPaymentInfo ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <CreditCard className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-400">No se han configurado datos de pago para este afiliado</p>
              <Button variant="outline" size="sm" className="h-7 rounded-full text-xs" onClick={() => setPaymentEdit(true)}>
                Agregar datos de pago
              </Button>
            </div>
          ) : (
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 max-w-lg">
              {[
                ['Método', profile.payment_method],
                ['Banco', profile.bank_name],
                ['CLABE', profile.bank_clabe],
                ['Cuenta', profile.bank_account],
                ['Titular', profile.bank_holder],
              ].map(([label, value]) =>
                value ? (
                  <div key={label}>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
                    <dd className={cn('text-sm text-gray-700 mt-0.5', ['CLABE', 'Cuenta'].includes(label as string) && 'font-mono')}>{value}</dd>
                  </div>
                ) : null
              )}
              {profile.payment_notes && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Notas</dt>
                  <dd className="text-sm text-gray-700 mt-0.5">{profile.payment_notes}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>

    </div>
  )
}
