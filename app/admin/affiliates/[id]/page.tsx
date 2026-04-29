'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Save, ArrowLeft, Copy, Check, ExternalLink, TrendingUp, ShoppingBag,
  DollarSign, Wallet, MousePointer2, BarChart2, Edit3, Search,
  ChevronLeft, ChevronRight, X, Clock, RefreshCcw, Tag, Link2, Users,
  AlertCircle, Percent, Mail, Phone, Banknote, CheckSquare, Square,
  Receipt, Eye, UserCircle,
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
    customer_linked?: boolean
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

interface PendingOrder {
  attribution_id: string
  order_id: string
  short_id: string
  customer_name: string | null
  order_total: number
  order_date: string
  commission_pct: number
  commission_amount_cents: number
}

interface PaymentRecord {
  id: string
  amount_cents: number
  payment_type: string
  reference_number: string | null
  notes: string | null
  paid_at: string
  attribution_ids: string[]
  period_from: string
  period_to: string
  orders: Array<{ short_id: string; total: number; customer_name: string | null; order_date?: string | null }>
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
  const searchParams = useSearchParams()
  const autoPayOpened = useRef(false)
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeMainTab, setActiveMainTab] = useState<'perfil' | 'estadisticas'>('perfil')

  const [generalForm, setGeneralForm] = useState({ first_name: '', last_name: '', phone: '' })

  // Commission rates
  const [couponPct, setCouponPct] = useState('')
  const [cookiePct, setCookiePct] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Payment info
  const [payForm, setPayForm] = useState({
    payment_method: '', bank_name: '', bank_clabe: '', bank_account: '', bank_holder: '', payment_notes: '',
  })

  // Chart date filter
  const [chartRange, setChartRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Attributions table
  const [attrPage, setAttrPage] = useState(1)
  const ATTRS_PAGE_SIZE = 10

  // Copy link state
  const [copied, setCopied] = useState(false)

  // Slug editing
  const [slugInput, setSlugInput] = useState('')
  const [slugEditing, setSlugEditing] = useState(false)
  const [savingSlug, setSavingSlug] = useState(false)

  // Store domain
  const [storeDomain, setStoreDomain] = useState('')

  // Payment modal
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payStep, setPayStep] = useState<1 | 2>(1)
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [selectedAttrIds, setSelectedAttrIds] = useState<Set<string>>(new Set())
  const [payType, setPayType] = useState<'efectivo' | 'transferencia' | 'otro'>('transferencia')
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [paySearch, setPaySearch] = useState('')

  // Payments tab
  const [activeTab, setActiveTab] = useState<'ventas' | 'pagos'>('ventas')
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [payDetailModal, setPayDetailModal] = useState<PaymentRecord | null>(null)
  const [detailOrderSearch, setDetailOrderSearch] = useState('')
  const [detailDateFrom, setDetailDateFrom] = useState('')
  const [detailDateTo, setDetailDateTo] = useState('')
  const [detailMinAmount, setDetailMinAmount] = useState('')
  const [detailMaxAmount, setDetailMaxAmount] = useState('')

  // Payments list filters
  const [payListSearch, setPayListSearch] = useState('')
  const [payListTypeFilter, setPayListTypeFilter] = useState('')
  const [payListDateFrom, setPayListDateFrom] = useState('')
  const [payListDateTo, setPayListDateTo] = useState('')

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
      setGeneralForm({
        first_name: json.data.profile.first_name ?? '',
        last_name: json.data.profile.last_name ?? '',
        phone: json.data.profile.phone ?? '',
      })
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

  useEffect(() => {
    if (!loading && data && !autoPayOpened.current && searchParams?.get('pay') === '1') {
      autoPayOpened.current = true
      void openPayModal()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data, searchParams])

  // Fetch store domain from settings
  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((json) => {
        const d = (json.data?.store_domain as string | undefined) ?? (json.data?.site_url as string | undefined) ?? ''
        setStoreDomain(d.trim().replace(/\/$/, ''))
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

  const handleSaveProfile = async () => {
    const cp = parseInt(couponPct, 10)
    const ck = parseInt(cookiePct, 10)
    if (Number.isNaN(cp) || Number.isNaN(ck)) {
      toast.error('Las tasas de comisión deben ser numéricas')
      return
    }

    setSavingProfile(true)
    const payload: Record<string, unknown> = {
      phone: generalForm.phone.trim() || null,
      commission_coupon_pct: cp,
      commission_cookie_pct: ck,
      ...payForm,
    }

    if (!data?.profile.customer_linked) {
      payload.first_name = generalForm.first_name.trim() || null
      payload.last_name = generalForm.last_name.trim() || null
    }

    const res = await fetch(`/api/admin/affiliates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast.success('Cambios guardados')
      void fetchData()
    } else {
      toast.error('Error al guardar')
    }
    setSavingProfile(false)
  }

  const handleCopyLink = () => {
    const slug = data?.referral_link?.slug
    if (!slug) return
    const base = storeDomain || window.location.origin
    void navigator.clipboard.writeText(`${base}/r/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveSlug = async () => {
    const slug = slugInput.trim().toLowerCase()
    if (!slug) return
    setSavingSlug(true)
    const res = await fetch(`/api/admin/affiliates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referral_slug: slug }),
    })
    const json = await res.json() as { error?: string }
    if (res.ok) {
      toast.success('Link de referido guardado')
      setSlugEditing(false)
      setSlugInput('')
      void fetchData()
    } else {
      toast.error(json.error ?? 'Error al guardar el slug')
    }
    setSavingSlug(false)
  }

  const openPayModal = async () => {
    setPayModalOpen(true)
    setPayStep(1)
    setSelectedAttrIds(new Set())
    setPayType('transferencia')
    setPayRef('')
    setPayNotes('')
    setPaySearch('')
    const res = await fetch(`/api/admin/affiliates/${id}/pending-orders`)
    const json = await res.json() as { data?: PendingOrder[] }
    if (json.data) setPendingOrders(json.data)
    else setPendingOrders([])
  }

  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true)
    const res = await fetch(`/api/admin/affiliates/${id}/payments?limit=50`)
    const json = await res.json() as { data?: PaymentRecord[] }
    setPayments(json.data ?? [])
    setPaymentsLoading(false)
  }, [id])

  useEffect(() => {
    if (activeTab === 'pagos') void fetchPayments()
  }, [activeTab, fetchPayments])

  const handleRegisterPayment = async () => {
    if (selectedAttrIds.size === 0) return
    setPaySubmitting(true)
    const res = await fetch(`/api/admin/affiliates/${id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attribution_ids: Array.from(selectedAttrIds),
        payment_type: payType,
        reference_number: payRef || undefined,
        notes: payNotes || undefined,
      }),
    })
    if (res.ok) {
      toast.success('Pago registrado correctamente')
      setPayModalOpen(false)
      void fetchData()
      if (activeTab === 'pagos') void fetchPayments()
    } else {
      const json = await res.json() as { error?: string }
      toast.error(json.error ?? 'Error al registrar pago')
    }
    setPaySubmitting(false)
  }

  const filteredPending = paySearch
    ? pendingOrders.filter((o) =>
        o.short_id.toLowerCase().includes(paySearch.toLowerCase()) ||
        (o.customer_name ?? '').toLowerCase().includes(paySearch.toLowerCase())
      )
    : pendingOrders

  const selectedTotal = pendingOrders
    .filter((o) => selectedAttrIds.has(o.attribution_id))
    .reduce((s, o) => s + o.commission_amount_cents, 0)

  const filteredPaymentDetailOrders = useMemo(() => {
    if (!payDetailModal) return []
    const q = detailOrderSearch.trim().toLowerCase()
    const min = detailMinAmount ? Number(detailMinAmount) : null
    const max = detailMaxAmount ? Number(detailMaxAmount) : null

    return payDetailModal.orders.filter((order) => {
      const orderDate = order.order_date?.slice(0, 10) ?? ''
      if (detailDateFrom && orderDate && orderDate < detailDateFrom) return false
      if (detailDateTo && orderDate && orderDate > detailDateTo) return false
      if (min !== null && order.total < min) return false
      if (max !== null && order.total > max) return false
      if (q && !order.short_id.toLowerCase().includes(q)) return false
      return true
    })
  }, [detailDateFrom, detailDateTo, detailMaxAmount, detailMinAmount, detailOrderSearch, payDetailModal])

  if (loading) return <DetailSkeleton />
  if (!data) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle className="w-10 h-10 text-gray-300" />
      <p className="text-gray-500 font-medium">Afiliado no encontrado</p>
      <Link href="/admin/affiliates"><Button variant="outline" size="sm">Volver a afiliados</Button></Link>
    </div>
  )

  const { profile, referral_link, coupons, attributions, kpis, chartData } = data
  const base = storeDomain || window.location.origin
  const referralUrl = referral_link ? `${base}/r/${referral_link.slug}` : null

  const attrTotal = attributions.length
  const attrStart = (attrPage - 1) * ATTRS_PAGE_SIZE
  const attrSlice = attributions.slice(attrStart, attrStart + ATTRS_PAGE_SIZE)
  const attrPages = Math.max(1, Math.ceil(attrTotal / ATTRS_PAGE_SIZE))

  const hasPaymentInfo = !!(profile.payment_method || profile.bank_name || profile.bank_clabe)

  return (
    <div className="space-y-6 pb-12">

      {/* ── Header with tabs and actions ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
          {(['perfil', 'estadisticas'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveMainTab(tab)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                activeMainTab === tab
                  ? 'bg-white text-primary-dark shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab === 'perfil'
                ? <><UserCircle className="w-4 h-4" />Perfil</>
                : <><BarChart2 className="w-4 h-4" />Estadísticas y pagos</>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
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
              'hidden sm:inline-flex items-center justify-center h-8 min-w-[88px] px-3 rounded-full text-xs font-bold border transition-colors leading-none',
              profile.is_active
                ? 'border-red-200 text-red-600 hover:bg-red-50'
                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
            )}
          >
            <span className="leading-none">{profile.is_active ? 'Desactivar' : 'Activar'}</span>
          </button>
          <Button
            size="sm"
            className="h-8 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white hidden sm:flex"
            onClick={openPayModal}
          >
            <Banknote className="w-3.5 h-3.5 mr-1.5" />
            Agregar pago
          </Button>
          <Button
            size="sm"
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="h-8 rounded-full text-xs font-semibold hidden sm:flex"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {savingProfile ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          PERFIL TAB
      ══════════════════════════════════════════ */}
      {activeMainTab === 'perfil' && (
        <div className="space-y-5">
          {/* Contact info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
              <div className="w-10 h-10 rounded-full bg-primary-cyan/10 flex items-center justify-center text-sm font-black text-primary-cyan shrink-0 uppercase">
                {profile.first_name || profile.last_name
                  ? `${(profile.first_name ?? '').slice(0, 1)}${(profile.last_name ?? '').slice(0, 1)}`.trim() || profile.handle.slice(0, 2).toUpperCase()
                  : profile.handle.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-primary-dark">
                    {profile.first_name || profile.last_name
                      ? [profile.first_name, profile.last_name].filter(Boolean).join(' ')
                      : `@${profile.handle}`}
                  </p>
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
                <p className="text-[11px] text-gray-400 mt-0.5">@{profile.handle}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" />{profile.email}</span>
                  {profile.phone && <span className="text-[11px] text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" />{profile.phone}</span>}
                </div>
              </div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:block">Información básica</h2>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 block mb-1">Nombre</label>
                  <Input
                    value={generalForm.first_name}
                    onChange={(e) => setGeneralForm((f) => ({ ...f, first_name: e.target.value }))}
                    placeholder="María"
                    className="h-9 text-sm"
                    disabled={Boolean(profile.customer_linked)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 block mb-1">Apellido</label>
                  <Input
                    value={generalForm.last_name}
                    onChange={(e) => setGeneralForm((f) => ({ ...f, last_name: e.target.value }))}
                    placeholder="García"
                    className="h-9 text-sm"
                    disabled={Boolean(profile.customer_linked)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 block mb-1">Teléfono</label>
                  <Input
                    value={generalForm.phone}
                    onChange={(e) => setGeneralForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+52 55 1234 5678"
                    className="h-9 text-sm"
                    inputMode="tel"
                  />
                </div>
              </div>
              {profile.customer_linked && (
                <p className="text-[11px] text-gray-400 mt-3">Nombre se refleja desde el cliente vinculado.</p>
              )}
            </div>
          </div>

          {/* Commission rates + referral link side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    className="h-9 text-sm"
                    min={0}
                    max={100}
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Los cambios se guardan con el botón global.</p>
            </div>

            {/* Referral link */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Link de referido</h3>
              {referralUrl && !slugEditing ? (
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
                    <Button
                      variant="outline" size="sm" className="h-8 rounded-xl text-xs px-2.5"
                      onClick={() => { setSlugInput(referral_link?.slug ?? ''); setSlugEditing(true) }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-gray-400">{referral_link?.clicks_count ?? 0} clics registrados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {!referralUrl && !slugEditing && (
                    <p className="text-xs text-gray-400 mb-2">Sin link de referido configurado</p>
                  )}
                  {slugEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={slugInput}
                        onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="ej: braulio"
                        className="h-8 text-xs font-mono"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 h-8 rounded-xl text-xs bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover" onClick={handleSaveSlug} disabled={savingSlug || !slugInput.trim()}>
                          {savingSlug ? 'Guardando…' : 'Guardar'}
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs" onClick={() => { setSlugEditing(false); setSlugInput('') }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full h-8 rounded-xl text-xs" onClick={() => setSlugEditing(true)}>
                      <Link2 className="w-3.5 h-3.5 mr-1.5" />
                      Crear link de referido
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Payment info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" id="payment-info">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Datos de pago</h3>
                {hasPaymentInfo ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700">Configurado</span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700">Sin configurar</span>
                )}
              </div>
            </div>
            <div className="p-5">
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 block mb-1">Número de cuenta</label>
                    <Input
                      value={payForm.bank_account}
                      onChange={(e) => setPayForm((f) => ({ ...f, bank_account: e.target.value }))}
                      className="h-9 text-sm font-mono"
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
              </div>
              <p className="mt-3 text-[10px] text-gray-400">Estos datos se guardan con el botón global.</p>
            </div>
          </div>

          {/* Coupons */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                Cupones vinculados
                {coupons.length > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
                    {coupons.length}
                  </span>
                )}
              </h3>
              <Link href={`/admin/cupones?create=1&affiliateId=${profile.id}`}>
                <Button variant="outline" size="sm" className="h-7 rounded-full text-xs">Agregar cupón</Button>
              </Link>
            </div>
            {coupons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Tag className="w-7 h-7 text-gray-200" />
                <p className="text-sm text-gray-400 font-medium">Sin cupones vinculados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                {coupons.map((coupon) => (
                  <motion.div
                    key={coupon.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 hover:border-gray-200 hover:bg-white transition-all"
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
                    <p className="text-[10px] text-gray-400 mt-0.5">Usos: {coupon.used_count} / {coupon.max_uses ?? '∞'}</p>
                    <Link href={`/admin/cupones?couponId=${coupon.id}`} className="mt-2.5 inline-block">
                      <Button variant="outline" size="sm" className="h-6 rounded-full text-[10px] px-2.5">Ver cupón</Button>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          ESTADÍSTICAS Y PAGOS TAB
      ══════════════════════════════════════════ */}
      {activeMainTab === 'estadisticas' && (
        <div className="space-y-5">

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={DollarSign} label="Comisión total" value={formatPrice(kpis.totalCommission)} color="text-emerald-600" />
            <KpiCard icon={Wallet} label="Pendiente pago" value={formatPrice(kpis.pendingCommission)} sub="Por liquidar" color="text-amber-500" />
            <KpiCard icon={ShoppingBag} label="Pedidos ref." value={String(kpis.totalOrders)} color="text-blue-500" />
            <KpiCard icon={MousePointer2} label="Clics totales" value={String(kpis.totalClicks)} color="text-purple-500" />
            <KpiCard icon={Users} label="Clics únicos" value={String(kpis.uniqueClicks)} color="text-indigo-500" />
            <KpiCard icon={TrendingUp} label="Conversión" value={`${kpis.conversionRate}%`} sub="Clics → pedido" color="text-primary-cyan" />
          </div>

          {/* Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
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

          {/* Ventas / Pagos tabs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
              <div className="flex items-center gap-1">
                {(['ventas', 'pagos'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'h-8 px-4 rounded-full text-xs font-bold transition-colors',
                      activeTab === tab
                        ? 'bg-primary-dark text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    )}
                  >
                    {tab === 'ventas' ? 'Ventas' : 'Pagos'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-7 rounded-full text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white sm:flex"
                  onClick={openPayModal}
                >
                  <Banknote className="w-3 h-3 mr-1" />
                  Agregar pago
                </Button>
                <Button variant="outline" size="sm" onClick={() => void fetchData()} className="h-7 w-7 rounded-full p-0">
                  <RefreshCcw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Ventas sub-tab */}
            {activeTab === 'ventas' && (
              <>
                <div className="px-5 py-2 border-b border-gray-50 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Ventas y comisiones
                    {attrTotal > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
                        {attrTotal}
                      </span>
                    )}
                  </p>
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
              </>
            )}

            {/* Pagos sub-tab */}
            {activeTab === 'pagos' && (
              <>
                {/* Filters bar */}
                {!paymentsLoading && payments.length > 0 && (
                  <div className="px-5 pt-3 pb-2 border-b border-gray-50 flex flex-wrap gap-2 items-center">
                    <div className="relative flex-1 min-w-[160px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <input
                        type="text"
                        value={payListSearch}
                        onChange={(e) => setPayListSearch(e.target.value)}
                        placeholder="Buscar orden o referencia..."
                        className="w-full h-7 pl-7 pr-3 text-[11px] border border-gray-200 rounded-full outline-none focus:ring-1 focus:ring-primary-cyan/40"
                      />
                    </div>
                    <select
                      value={payListTypeFilter}
                      onChange={(e) => setPayListTypeFilter(e.target.value)}
                      className="h-7 px-2 text-[11px] border border-gray-200 rounded-full outline-none focus:ring-1 focus:ring-primary-cyan/40 bg-white"
                    >
                      <option value="">Todos los tipos</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="otro">Otro</option>
                    </select>
                    <input
                      type="date"
                      value={payListDateFrom}
                      onChange={(e) => setPayListDateFrom(e.target.value)}
                      className="h-7 px-2 text-[11px] border border-gray-200 rounded-full outline-none focus:ring-1 focus:ring-primary-cyan/40"
                    />
                    <span className="text-gray-300 text-xs">–</span>
                    <input
                      type="date"
                      value={payListDateTo}
                      onChange={(e) => setPayListDateTo(e.target.value)}
                      className="h-7 px-2 text-[11px] border border-gray-200 rounded-full outline-none focus:ring-1 focus:ring-primary-cyan/40"
                    />
                    {(payListSearch || payListTypeFilter || payListDateFrom || payListDateTo) && (
                      <button
                        type="button"
                        onClick={() => { setPayListSearch(''); setPayListTypeFilter(''); setPayListDateFrom(''); setPayListDateTo('') }}
                        className="text-[10px] text-gray-400 hover:text-red-500 font-semibold"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                )}
                {paymentsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 border-2 border-gray-200 border-t-primary-cyan rounded-full animate-spin" />
                  </div>
                ) : payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Receipt className="w-8 h-8 text-gray-200" />
                    <p className="text-sm text-gray-400 font-medium">Sin pagos registrados</p>
                    <Button size="sm" className="h-7 rounded-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={openPayModal}>
                      <Banknote className="w-3 h-3 mr-1.5" />
                      Registrar primer pago
                    </Button>
                  </div>
                ) : (() => {
                  const filtered = payments.filter((p) => {
                    if (payListTypeFilter && p.payment_type !== payListTypeFilter) return false
                    if (payListDateFrom && p.paid_at.slice(0, 10) < payListDateFrom) return false
                    if (payListDateTo && p.paid_at.slice(0, 10) > payListDateTo) return false
                    if (payListSearch) {
                      const q = payListSearch.toLowerCase()
                      const matchesOrder = p.orders.some((o) => o.short_id.toLowerCase().includes(q))
                      const matchesRef = (p.reference_number ?? '').toLowerCase().includes(q)
                      if (!matchesOrder && !matchesRef) return false
                    }
                    return true
                  })
                  return (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50/50">
                            {['Fecha pago', 'Órdenes', 'Monto', 'Tipo', 'Referencia', 'Nota', ''].map((h) => (
                              <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="py-8 text-center text-xs text-gray-400">Sin resultados para los filtros aplicados</TableCell>
                            </TableRow>
                          ) : filtered.map((p) => (
                            <TableRow key={p.id} className="hover:bg-gray-50/30">
                              <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                                {new Date(p.paid_at).toLocaleDateString('es-MX')}
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="flex flex-wrap gap-1">
                                  {p.orders.map((o, i) => (
                                    <span key={i} className="font-mono text-[10px] font-bold text-primary-dark">
                                      #{o.short_id}{i < p.orders.length - 1 ? ',' : ''}
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-bold text-emerald-700 whitespace-nowrap">
                                {formatPrice(p.amount_cents)}
                              </TableCell>
                              <TableCell className="text-xs text-gray-600 capitalize">
                                {p.payment_type}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-gray-600 max-w-[120px] truncate">
                                {p.reference_number ?? '—'}
                              </TableCell>
                              <TableCell className="text-xs text-gray-400 max-w-[140px] truncate">
                                {p.notes ?? '—'}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-8 w-8 rounded-full border border-gray-200 p-0 text-gray-500 hover:border-primary-cyan hover:text-primary-cyan"
                                  onClick={() => {
                                    setPayDetailModal(p)
                                    setDetailOrderSearch('')
                                    setDetailDateFrom('')
                                    setDetailDateTo('')
                                    setDetailMinAmount('')
                                    setDetailMaxAmount('')
                                  }}
                                  aria-label={`Ver detalle del pago ${p.id}`}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Register payment modal ── */}
      {payModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPayModalOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Registrar pago de comisión</h3>
                  <p className="text-[10px] text-gray-400">Paso {payStep} de 2</p>
                </div>
              </div>
              <button type="button" onClick={() => setPayModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {payStep === 1 ? (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="px-5 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Órdenes pendientes ({filteredPending.length})
                    </p>
                    {filteredPending.length > 0 && (
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-primary-cyan hover:underline"
                        onClick={() => {
                          if (selectedAttrIds.size === filteredPending.length) {
                            setSelectedAttrIds(new Set())
                          } else {
                            setSelectedAttrIds(new Set(filteredPending.map((o) => o.attribution_id)))
                          }
                        }}
                      >
                        {selectedAttrIds.size === filteredPending.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                      </button>
                    )}
                  </div>
                  <Input
                    value={paySearch}
                    onChange={(e) => setPaySearch(e.target.value)}
                    placeholder="Buscar orden o cliente..."
                    className="h-8 text-xs rounded-xl"
                  />
                </div>
                <div className="flex-1 overflow-y-auto px-5 pb-2">
                  {filteredPending.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <ShoppingBag className="w-6 h-6 text-gray-200" />
                      <p className="text-xs text-gray-400">Sin órdenes pendientes de pago</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredPending.map((o) => {
                        const checked = selectedAttrIds.has(o.attribution_id)
                        return (
                          <button
                            key={o.attribution_id}
                            type="button"
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                              checked ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                            )}
                            onClick={() => {
                              setSelectedAttrIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(o.attribution_id)) next.delete(o.attribution_id)
                                else next.add(o.attribution_id)
                                return next
                              })
                            }}
                          >
                            {checked
                              ? <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                              : <Square className="w-4 h-4 text-gray-300 shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-bold text-primary-dark">#{o.short_id}</span>
                                <span className="text-xs font-bold text-emerald-700">{formatPrice(o.commission_amount_cents)}</span>
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[10px] text-gray-400 truncate">{o.customer_name ?? 'Sin nombre'}</span>
                                <span className="text-[10px] text-gray-400">{o.commission_pct}%</span>
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                {new Date(o.order_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500">
                    Total seleccionado: <span className="text-emerald-700">{formatPrice(selectedTotal)}</span>
                    <span className="text-gray-400 ml-1">({selectedAttrIds.size} órdenes)</span>
                  </p>
                  <Button
                    size="sm"
                    className="h-8 rounded-full text-xs font-semibold"
                    disabled={selectedAttrIds.size === 0}
                    onClick={() => setPayStep(2)}
                  >
                    Continuar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-4">
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-emerald-700">
                    {selectedAttrIds.size} órdenes — Total: {formatPrice(selectedTotal)}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Tipo de pago</label>
                  <div className="flex gap-2">
                    {(['transferencia', 'efectivo', 'otro'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={cn(
                          'flex-1 h-9 rounded-xl text-xs font-semibold border transition-colors capitalize',
                          payType === t
                            ? 'border-primary-dark bg-primary-dark text-white'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        )}
                        onClick={() => setPayType(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Número de referencia / comprobante
                  </label>
                  <Input
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="ej. SPEI-123456789"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Nota opcional</label>
                  <textarea
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-cyan/30 resize-none"
                    rows={2}
                    placeholder="Información adicional..."
                  />
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={() => setPayStep(1)}>
                    Atrás
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={paySubmitting}
                    onClick={handleRegisterPayment}
                  >
                    {paySubmitting ? 'Registrando...' : 'Confirmar pago'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Payment detail modal ── */}
      {payDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPayDetailModal(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Detalle del pago</h3>
              <button type="button" onClick={() => setPayDetailModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Monto</span>
                  <span className="mt-2 block text-lg font-black text-emerald-700">{formatPrice(payDetailModal.amount_cents)}</span>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tipo</span>
                  <span className="mt-2 block text-xs font-semibold capitalize text-gray-700">{payDetailModal.payment_type}</span>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Referencia</span>
                  <span className="mt-2 block text-xs font-mono text-gray-700">{payDetailModal.reference_number ?? '—'}</span>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3 xl:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Fecha</span>
                  <span className="mt-2 block text-xs text-gray-700">{new Date(payDetailModal.paid_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Período</span>
                  <span className="mt-2 block text-xs text-gray-700">
                    {new Date(payDetailModal.period_from).toLocaleDateString('es-MX')} — {new Date(payDetailModal.period_to).toLocaleDateString('es-MX')}
                  </span>
                </div>
              </div>
              {payDetailModal.notes && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Nota</span>
                  <p className="text-xs text-gray-700">{payDetailModal.notes}</p>
                </div>
              )}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-2">Órdenes incluidas</span>
                <div className="rounded-2xl border border-gray-100 p-4">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_140px_140px_140px_140px]">
                    <Input value={detailOrderSearch} onChange={(e) => setDetailOrderSearch(e.target.value)} placeholder="Buscar número de orden" className="h-9 text-xs" />
                    <input type="date" value={detailDateFrom} onChange={(e) => setDetailDateFrom(e.target.value)} className="h-9 rounded-xl border border-gray-200 px-3 text-xs outline-none focus:ring-2 focus:ring-primary-cyan/20" />
                    <input type="date" value={detailDateTo} onChange={(e) => setDetailDateTo(e.target.value)} className="h-9 rounded-xl border border-gray-200 px-3 text-xs outline-none focus:ring-2 focus:ring-primary-cyan/20" />
                    <Input value={detailMinAmount} onChange={(e) => setDetailMinAmount(e.target.value)} placeholder="Monto mín." inputMode="decimal" className="h-9 text-xs" />
                    <Input value={detailMaxAmount} onChange={(e) => setDetailMaxAmount(e.target.value)} placeholder="Monto máx." inputMode="decimal" className="h-9 text-xs" />
                  </div>
                  <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {filteredPaymentDetailOrders.map((o, i) => (
                      <div key={i} className="grid gap-2 rounded-lg bg-gray-50 px-3 py-2 sm:grid-cols-[120px_minmax(0,1fr)_120px_120px] sm:items-center">
                        <span className="font-mono text-xs font-bold text-primary-dark">#{o.short_id}</span>
                        <span className="text-xs text-gray-600">{o.customer_name ?? '—'}</span>
                        <span className="text-xs text-gray-500">{o.order_date ? new Date(o.order_date).toLocaleDateString('es-MX') : '—'}</span>
                        <span className="text-xs font-semibold text-gray-700">{formatPrice(o.total)}</span>
                      </div>
                    ))}
                    {filteredPaymentDetailOrders.length === 0 && (
                      <p className="py-6 text-center text-xs text-gray-400">Sin órdenes para los filtros aplicados.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 pb-5">
              <Button variant="outline" size="sm" className="w-full h-8 rounded-full text-xs" onClick={() => setPayDetailModal(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
