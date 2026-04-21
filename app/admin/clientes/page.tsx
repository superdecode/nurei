'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Download, UserCheck, Users, Crown,
  AlertTriangle, TrendingUp, Building2, Mail, Phone,
  ToggleLeft, ToggleRight, Trash2, Edit2, Eye,
  DollarSign, Check, Loader2, ChevronLeft, ChevronRight, Users2,
  Filter, X, ChevronDown, LayoutGrid, List,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'
import { customerDisplayName, customerToFirstLast } from '@/lib/utils/customer-display'
import { AnchoredFilterPanel } from '@/components/admin/AnchoredFilterPanel'
import { toast } from 'sonner'
import type {
  Customer, CustomerSegment, CustomerStats, CustomerType,
} from '@/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const SEGMENT_LABEL: Record<CustomerSegment, string> = {
  new: 'Nuevo', regular: 'Regular', vip: 'VIP',
  at_risk: 'En riesgo', lost: 'Perdido', blacklist: 'Bloqueado',
}

const SEGMENT_STYLE: Record<CustomerSegment, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-100',
  regular: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  vip: 'bg-amber-50 text-amber-700 border-amber-100',
  at_risk: 'bg-orange-50 text-orange-700 border-orange-100',
  lost: 'bg-gray-100 text-gray-500 border-gray-200',
  blacklist: 'bg-red-50 text-red-700 border-red-100',
}

const TYPE_LABEL: Record<CustomerType, string> = {
  individual: 'Persona',
  business: 'Empresa',
}

const fmtMXN = (cents: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
    .format((cents ?? 0) / 100)

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ─── Empty forms ─────────────────────────────────────────────────────────────

interface CustomerForm {
  first_name: string
  last_name: string
  email: string
  phone: string
  whatsapp: string
  customer_type: CustomerType
  company_name: string
  tax_id: string
  birthday: string
  segment: CustomerSegment
  tags: string
  accepts_marketing: boolean
  accepts_email_marketing: boolean
  accepts_sms_marketing: boolean
  accepts_whatsapp_marketing: boolean
  internal_notes: string
}

const EMPTY_FORM: CustomerForm = {
  first_name: '', last_name: '', email: '', phone: '', whatsapp: '',
  customer_type: 'individual', company_name: '', tax_id: '', birthday: '',
  segment: 'new', tags: '',
  accepts_marketing: false, accepts_email_marketing: false,
  accepts_sms_marketing: false, accepts_whatsapp_marketing: false,
  internal_notes: '',
}

function customerToForm(c: Customer): CustomerForm {
  const { first_name, last_name } = customerToFirstLast(c)
  return {
    first_name,
    last_name,
    email: c.email ?? '',
    phone: c.phone ?? '',
    whatsapp: c.whatsapp ?? '',
    customer_type: c.customer_type,
    company_name: c.company_name ?? '',
    tax_id: c.tax_id ?? '',
    birthday: c.birthday ?? '',
    segment: c.segment,
    tags: (c.tags ?? []).join(', '),
    accepts_marketing: c.accepts_marketing,
    accepts_email_marketing: c.accepts_email_marketing,
    accepts_sms_marketing: c.accepts_sms_marketing,
    accepts_whatsapp_marketing: c.accepts_whatsapp_marketing,
    internal_notes: c.internal_notes ?? '',
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [stats, setStats] = useState<CustomerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table')

  // Filters
  const [search, setSearch] = useState('')
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<CustomerType | 'all'>('all')
  const [hasOrdersFilter, setHasOrdersFilter] = useState<'all' | 'with' | 'without'>('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [marketingFilter, setMarketingFilter] = useState<boolean | null>(null)
  const [minSpentFilter, setMinSpentFilter] = useState('')

  // Smart filter panel
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (filterRef.current?.contains(t)) return
      if (filterPanelRef.current?.contains(t)) return
      setFilterOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Pagination
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 50

  // Dialogs
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (segmentFilter !== 'all') params.set('segment', segmentFilter)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (hasOrdersFilter === 'with') params.set('has_orders', 'true')
      if (hasOrdersFilter === 'without') params.set('has_orders', 'false')
      if (activeFilter !== 'all') params.set('is_active', activeFilter === 'active' ? 'true' : 'false')
      if (marketingFilter !== null) params.set('accepts_marketing', String(marketingFilter))
      if (minSpentFilter && Number(minSpentFilter) > 0) {
        params.set('min_spent_cents', String(Math.round(Number(minSpentFilter) * 100)))
      }
      params.set('page', String(page))
      params.set('limit', String(limit))

      const res = await fetchWithCredentials(`/api/admin/customers?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setCustomers(json.data ?? [])
      setTotal(json.meta?.total ?? 0)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }, [search, segmentFilter, typeFilter, hasOrdersFilter, activeFilter, marketingFilter, minSpentFilter, page])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetchWithCredentials('/api/admin/customers/stats')
      const json = await res.json()
      if (res.ok && json.data) setStats(json.data)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 200)
    return () => clearTimeout(t)
  }, [fetchCustomers])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // ── Editor handlers ──────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setEditorOpen(true)
  }

  const openEdit = (c: Customer) => {
    setEditing(c)
    setForm(customerToForm(c))
    setEditorOpen(true)
  }

  const handleSave = async () => {
    if (!form.first_name.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    if (!form.email.trim() && !form.phone.trim()) {
      toast.error('Email o teléfono es requerido')
      return
    }
    if (form.customer_type === 'business' && !form.company_name.trim()) {
      toast.error('Empresa es requerida para clientes tipo empresa')
      return
    }

    setSaving(true)
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        whatsapp: form.whatsapp.trim() || undefined,
        customer_type: form.customer_type,
        company_name: form.company_name.trim() || null,
        tax_id: form.tax_id.trim() || undefined,
        birthday: form.birthday || undefined,
        segment: form.segment,
        tags: form.tags
          .split(',').map(t => t.trim()).filter(Boolean),
        accepts_marketing: form.accepts_marketing,
        accepts_email_marketing: form.accepts_marketing,
        accepts_sms_marketing: false,
        accepts_whatsapp_marketing: form.accepts_marketing,
        internal_notes: form.internal_notes.trim() || null,
      }

      const url = editing
        ? `/api/admin/customers/${editing.id}`
        : '/api/admin/customers'
      const method = editing ? 'PATCH' : 'POST'

      const res = await fetchWithCredentials(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      toast.success(editing ? 'Cliente actualizado' : 'Cliente creado')
      setEditorOpen(false)
      fetchCustomers()
      fetchStats()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (c: Customer) => {
    try {
      const res = await fetchWithCredentials(`/api/admin/customers/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !c.is_active }),
      })
      if (!res.ok) throw new Error()
      setCustomers(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x))
      toast.success(c.is_active ? 'Cliente desactivado' : 'Cliente activado')
    } catch {
      toast.error('No se pudo cambiar el estado')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetchWithCredentials(`/api/admin/customers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Cliente eliminado')
      setDeleteConfirm(null)
      fetchCustomers()
      fetchStats()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const handleExport = () => {
    window.location.href = '/api/admin/customers/export'
  }

  const pageCount = Math.max(1, Math.ceil(total / limit))

  const activeFilters = useMemo(() => {
    const f: Array<{ id: string; label: string; onRemove: () => void }> = []
    if (segmentFilter !== 'all') f.push({ id: 'seg', label: SEGMENT_LABEL[segmentFilter], onRemove: () => { setSegmentFilter('all'); setPage(1) } })
    if (typeFilter !== 'all') f.push({ id: 'type', label: TYPE_LABEL[typeFilter], onRemove: () => { setTypeFilter('all'); setPage(1) } })
    if (hasOrdersFilter !== 'all') f.push({ id: 'orders', label: hasOrdersFilter === 'with' ? 'Con pedidos' : 'Sin pedidos', onRemove: () => { setHasOrdersFilter('all'); setPage(1) } })
    if (activeFilter !== 'all') f.push({ id: 'active', label: activeFilter === 'active' ? 'Activos' : 'Inactivos', onRemove: () => { setActiveFilter('all'); setPage(1) } })
    if (marketingFilter !== null) f.push({ id: 'mkt', label: marketingFilter ? 'Acepta marketing' : 'No acepta marketing', onRemove: () => { setMarketingFilter(null); setPage(1) } })
    if (minSpentFilter && Number(minSpentFilter) > 0) f.push({ id: 'spent', label: `Min. $${minSpentFilter}`, onRemove: () => { setMinSpentFilter(''); setPage(1) } })
    return f
  }, [segmentFilter, typeFilter, hasOrdersFilter, activeFilter, marketingFilter, minSpentFilter])

  const clearAllFilters = () => {
    setSegmentFilter('all')
    setTypeFilter('all')
    setHasOrdersFilter('all')
    setActiveFilter('all')
    setMarketingFilter(null)
    setMinSpentFilter('')
    setPage(1)
    setFilterOpen(false)
  }

  const statCards = useMemo(() => ([
    {
      key: 'total',
      label: 'Total clientes',
      value: stats?.total ?? 0,
      icon: Users,
      color: 'text-primary-cyan',
      bg: 'bg-primary-cyan/10',
    },
    {
      key: 'vip',
      label: 'Clientes VIP',
      value: stats?.vip ?? 0,
      icon: Crown,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      key: 'new30',
      label: 'Nuevos (30d)',
      value: stats?.new_last_30d ?? 0,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      key: 'at_risk',
      label: 'En riesgo',
      value: stats?.at_risk ?? 0,
      icon: AlertTriangle,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      key: 'gmv',
      label: 'Ingresos totales',
      value: fmtMXN(stats?.gmv_cents ?? 0),
      icon: DollarSign,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      key: 'ltv',
      label: 'LTV promedio',
      value: fmtMXN(stats?.avg_ltv_cents ?? 0),
      icon: UserCheck,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
  ]), [stats])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-primary-cyan" />
            Clientes
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Compradores y cuentas de la tienda (web). El personal interno del panel no aparece aquí.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleExport}
            className="gap-2 text-gray-600 hover:bg-gray-100 rounded-xl"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
          <Button
            onClick={openCreate}
            className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold gap-2 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Nuevo cliente
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-2xl border border-gray-100 shadow-sm bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500">{s.label}</p>
                  <p className="text-2xl font-bold text-primary-dark mt-1 truncate">
                    {typeof s.value === 'number' ? s.value.toLocaleString('es-MX') : s.value}
                  </p>
                </div>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', s.bg)}>
                  <Icon className={cn('w-4 h-4', s.color)} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Toolbar: búsqueda, luego Filtrar + chips */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative min-w-[min(100%,220px)] flex-1 basis-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nombre, email, teléfono o empresa…"
            className="pl-10 pr-10 h-10 bg-white border-gray-200 rounded-full text-sm focus-visible:ring-2 focus-visible:ring-orange-400/30 focus-visible:border-orange-400/50"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setPage(1) }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Smart filter */}
        <div className="relative shrink-0" ref={filterRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={cn(
              'flex items-center gap-1.5 h-10 px-4 rounded-full border text-sm font-semibold transition-all',
              filterOpen || activeFilters.length > 0
                ? 'bg-primary-dark text-white border-primary-dark shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            )}
          >
            <Filter className="h-4 w-4" />
            Filtrar
            {activeFilters.length > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-orange-400 text-[10px] font-black text-white">
                {activeFilters.length}
              </span>
            )}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', filterOpen ? 'rotate-180' : '')} />
          </button>

          <AnchoredFilterPanel ref={filterPanelRef} open={filterOpen} anchorRef={filterRef} maxWidth={320}>
                <div className="p-4 space-y-4">
                  {/* Segmento */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Segmento</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(SEGMENT_LABEL) as CustomerSegment[]).map(seg => {
                        const active = segmentFilter === seg
                        return (
                          <button
                            key={seg}
                            type="button"
                            onClick={() => { setSegmentFilter(active ? 'all' : seg); setPage(1) }}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                              active
                                ? cn(SEGMENT_STYLE[seg], 'ring-1 ring-inset ring-current')
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                            )}
                          >
                            {SEGMENT_LABEL[seg]}
                            {active && <Check className="h-2.5 w-2.5 ml-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Tipo */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Tipo</p>
                    <div className="flex gap-1.5">
                      {(['individual', 'business'] as CustomerType[]).map(t => {
                        const active = typeFilter === t
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => { setTypeFilter(active ? 'all' : t); setPage(1) }}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                              active ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                            )}
                          >
                            {TYPE_LABEL[t]}
                            {active && <Check className="h-2.5 w-2.5 ml-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Estado activo */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Estado</p>
                    <div className="flex gap-1.5">
                      {[
                        { v: 'active' as const, l: 'Activos', on: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
                        { v: 'inactive' as const, l: 'Inactivos', on: 'bg-gray-100 text-gray-600 border-gray-300' },
                      ].map(({ v, l, on }) => {
                        const active = activeFilter === v
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => { setActiveFilter(active ? 'all' : v); setPage(1) }}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                              active ? on : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                            )}
                          >
                            {l}
                            {active && <Check className="h-2.5 w-2.5 ml-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Pedidos */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Pedidos</p>
                    <div className="flex gap-1.5">
                      {[
                        { v: 'with' as const, l: 'Con pedidos', on: 'bg-primary-cyan/10 text-primary-dark border-primary-cyan/50' },
                        { v: 'without' as const, l: 'Sin pedidos', on: 'bg-amber-50 text-amber-700 border-amber-300' },
                      ].map(({ v, l, on }) => {
                        const active = hasOrdersFilter === v
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => { setHasOrdersFilter(active ? 'all' : v); setPage(1) }}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                              active ? on : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                            )}
                          >
                            {l}
                            {active && <Check className="h-2.5 w-2.5 ml-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Marketing */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Marketing</p>
                    <div className="flex gap-1.5">
                      {[
                        { v: true, l: 'Acepta marketing', on: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
                        { v: false, l: 'No acepta', on: 'bg-red-50 text-red-600 border-red-200' },
                      ].map(({ v, l, on }) => {
                        const active = marketingFilter === v
                        return (
                          <button
                            key={String(v)}
                            type="button"
                            onClick={() => { setMarketingFilter(active ? null : v); setPage(1) }}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                              active ? on : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                            )}
                          >
                            {l}
                            {active && <Check className="h-2.5 w-2.5 ml-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Gasto mínimo */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Gasto mínimo total (MXN)</p>
                    <div className="relative">
                      <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={minSpentFilter}
                        onChange={(e) => { setMinSpentFilter(e.target.value); setPage(1) }}
                        placeholder="0"
                        className="w-full pl-7 pr-3 h-8 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-primary-dark"
                      />
                      {minSpentFilter && Number(minSpentFilter) > 0 && (
                        <button
                          type="button"
                          onClick={() => { setMinSpentFilter(''); setPage(1) }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {activeFilters.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="w-full text-center text-xs text-gray-400 hover:text-red-500 transition pt-1 border-t border-gray-100"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
          </AnchoredFilterPanel>
        </div>

        {/* Chips junto a Filtrar */}
        {activeFilters.length > 0 && (
          <div className="min-w-0 max-w-[min(100%,40rem)] grow-0 shrink max-h-[4.75rem] overflow-y-auto overscroll-y-contain rounded-xl border border-orange-100 bg-orange-50/50 px-2 py-1.5">
            <div className="flex flex-wrap content-start gap-1.5 gap-y-1">
              {activeFilters.map((f) => (
                <span
                  key={f.id}
                  className="inline-flex items-center gap-1 h-7 max-w-full rounded-full bg-orange-50 border border-orange-200 px-2.5 text-[11px] font-semibold text-orange-800 shrink-0"
                >
                  <span className="truncate max-w-[14rem]">{f.label}</span>
                  <button type="button" onClick={f.onRemove} className="opacity-70 hover:opacity-100 shrink-0" aria-label="Quitar filtro">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="ml-auto flex gap-1 bg-white rounded-xl p-1 border border-gray-200 shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn('p-1.5 rounded-lg transition-all', viewMode === 'table' ? 'bg-primary-dark text-white shadow-sm' : 'text-gray-400 hover:text-gray-600')}
            title="Vista tabla"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={cn('p-1.5 rounded-lg transition-all', viewMode === 'kanban' ? 'bg-primary-dark text-white shadow-sm' : 'text-gray-400 hover:text-gray-600')}
            title="Vista kanban"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
      <div className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Cliente</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Contacto</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Tipo</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Segmento</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">Pedidos</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">LTV</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Último pedido</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-400 py-12">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                  Cargando clientes…
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-400 py-12">
                  No se encontraron clientes
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c, i) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-cyan/30 to-primary-cyan/10 flex items-center justify-center text-[11px] font-bold text-primary-dark">
                        {customerDisplayName(c).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/clientes/${c.id}`}
                          className="font-medium text-primary-dark hover:text-primary-cyan truncate block"
                        >
                          {customerDisplayName(c)}
                        </Link>
                      {c.is_affiliate && (
                        <span className="inline-flex items-center gap-1 mt-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                          <Users2 className="w-3 h-3" /> Afiliado
                        </span>
                      )}
                        {c.company_name && (
                          <span className="text-[11px] text-gray-400 truncate block">
                            <Building2 className="w-3 h-3 inline mr-1" />
                            {c.company_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="space-y-0.5">
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span className="truncate max-w-[200px]">{c.email}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {c.phone}
                        </div>
                      )}
                      {!c.email && !c.phone && (
                        <span className="text-xs text-gray-300 italic">Sin contacto</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[11px] font-medium border',
                        c.customer_type === 'business'
                          ? 'border-indigo-100 bg-indigo-50 text-indigo-700'
                          : 'border-gray-100 bg-gray-50 text-gray-600'
                      )}
                    >
                      {TYPE_LABEL[c.customer_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[11px] font-medium border', SEGMENT_STYLE[c.segment])}>
                      {SEGMENT_LABEL[c.segment]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-gray-700">
                    {c.orders_count ?? 0}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-primary-dark">
                    {fmtMXN(c.total_spent_cents ?? 0)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {fmtDate(c.last_order_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(c)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        title={c.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {c.is_active
                          ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                          : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(c)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center text-gray-400 py-12">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
              Cargando clientes…
            </div>
          ) : customers.length === 0 ? (
            <div className="col-span-full text-center text-gray-400 py-12">
              No se encontraron clientes
            </div>
          ) : (
            customers.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="rounded-2xl border border-gray-100 shadow-sm bg-white p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-cyan/30 to-primary-cyan/10 flex items-center justify-center text-xs font-bold text-primary-dark shrink-0">
                      {customerDisplayName(c).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <Link href={`/admin/clientes/${c.id}`} className="font-semibold text-primary-dark hover:text-primary-cyan truncate block">
                        {customerDisplayName(c)}
                      </Link>
                      <p className="text-xs text-gray-400 truncate">{c.email ?? c.phone ?? 'Sin contacto'}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('text-[11px] font-medium border', SEGMENT_STYLE[c.segment])}>
                    {SEGMENT_LABEL[c.segment]}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-gray-50 border border-gray-100 px-2.5 py-2">
                    <p className="text-gray-400">Pedidos</p>
                    <p className="font-semibold text-primary-dark">{c.orders_count ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-100 px-2.5 py-2">
                    <p className="text-gray-400">LTV</p>
                    <p className="font-semibold text-primary-dark">{fmtMXN(c.total_spent_cents ?? 0)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Último pedido: {fmtDate(c.last_order_at)}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => handleToggleActive(c)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" title={c.is_active ? 'Desactivar' : 'Activar'}>
                      {c.is_active ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button type="button" onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" title="Editar">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">
            Mostrando {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-gray-600 font-medium">
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Editor Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent size="lg" className="p-0 overflow-hidden flex flex-col max-h-[92vh]">
          <div className="bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#f59e0bb3] px-8 py-5 relative overflow-hidden flex-shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-black/10 backdrop-blur-md flex items-center justify-center border border-black/5">
                <UserCheck className="w-5 h-5 text-gray-900" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">
                  {editing ? 'Editar cliente' : 'Nuevo cliente'}
                </DialogTitle>
                {editing && (
                  <p className="text-sm font-semibold text-gray-900/85 truncate max-w-[min(100%,22rem)] mt-0.5" title={customerDisplayName(editing)}>
                    {customerDisplayName(editing)}
                  </p>
                )}
                <p className="text-xs text-gray-900/60 font-medium">
                  Datos, contacto, segmento y consentimientos
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Type switcher */}
            <div className="flex gap-2">
              {(['individual', 'business'] as CustomerType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, customer_type: t })}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all',
                    form.customer_type === t
                      ? 'bg-primary-cyan/10 border-primary-cyan/60 text-primary-cyan'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            {/* Identity */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre" required>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder="Juan"
                />
              </Field>
              <Field label="Apellido">
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  placeholder="Pérez"
                />
              </Field>
            </div>

            {form.customer_type === 'business' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Empresa" required>
                  <Input
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    placeholder="Mi Empresa S.A."
                  />
                </Field>
                <Field label="RFC">
                  <Input
                    value={form.tax_id}
                    onChange={(e) => setForm({ ...form, tax_id: e.target.value.toUpperCase() })}
                    placeholder="ABCD123456XYZ"
                    maxLength={13}
                  />
                </Field>
              </div>
            )}

            {/* Contact */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contacto</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="correo@dominio.com"
                  />
                </Field>
                <Field label="Teléfono">
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+52 55 1234 5678"
                  />
                </Field>
              </div>
              <Field label="WhatsApp">
                <Input
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="+52 55 1234 5678"
                />
              </Field>
            </div>

            {/* Segment + tags + birthday */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Segmento">
                <Select
                  value={form.segment}
                  onValueChange={(v) => setForm({ ...form, segment: (v ?? 'new') as CustomerSegment })}
                >
                  <SelectTrigger className="h-10 border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SEGMENT_LABEL) as CustomerSegment[]).map(s => (
                      <SelectItem key={s} value={s}>{SEGMENT_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cumpleaños">
                <Input
                  type="date"
                  value={form.birthday}
                  onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Etiquetas (separadas por coma)">
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="mayorista, reventa, frecuente"
              />
            </Field>

            {/* Marketing — una sola pregunta (email + WhatsApp siguen la misma decisión al guardar) */}
            <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/90 to-orange-50/40 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900/90">Preferencias</p>
              <p className="text-xs text-amber-950/80 mt-1 mb-3 leading-snug">
                ¿Desea recibir novedades, descuentos y comunicaciones ocasionales por correo electrónico y WhatsApp?
              </p>
              <ToggleRow
                label="Sí, quiero recibir comunicaciones"
                checked={form.accepts_marketing}
                onChange={(v) =>
                  setForm({
                    ...form,
                    accepts_marketing: v,
                    accepts_email_marketing: v,
                    accepts_whatsapp_marketing: v,
                    accepts_sms_marketing: false,
                  })
                }
              />
              <p className="text-[11px] text-amber-800/70 mt-2 leading-relaxed">
                Si activa esta opción, podremos enviarle mensajes por los datos de contacto que indicó arriba. No enviamos SMS.
              </p>
            </div>

            <Field label="Notas internas (solo admin)">
              <Textarea
                value={form.internal_notes}
                onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
                placeholder="Información visible solo para el equipo…"
                rows={3}
              />
            </Field>
          </div>

          <div className="p-5 flex justify-end gap-3 border-t bg-gray-50/50 flex-shrink-0">
            <Button
              variant="ghost"
              onClick={() => setEditorOpen(false)}
              className="rounded-xl h-10 font-bold text-gray-500 hover:bg-gray-100 px-6"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary-dark text-white hover:bg-black font-bold rounded-xl h-10 px-8 shadow-md"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <><Check className="w-4 h-4 mr-2" />{editing ? 'Guardar' : 'Crear'}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ──────────────────────────────────────────────── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-red-500 to-red-600 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-white">Eliminar cliente</DialogTitle>
                <p className="text-xs text-white/70">Esta acción no se puede deshacer</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-600">
              Se eliminará <span className="font-semibold">{deleteConfirm?.full_name ?? deleteConfirm?.email}</span> junto con sus notas y direcciones.
              Los pedidos existentes se conservarán sin cliente asignado.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => deleteConfirm && handleDelete(deleteConfirm.id)}
                className="flex-1 bg-red-500 text-white hover:bg-red-600 font-semibold rounded-xl"
              >
                Sí, eliminar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between py-1.5 group"
    >
      <span className="text-sm text-gray-700">{label}</span>
      <span className={cn(
        'relative inline-flex h-5 w-9 rounded-full transition-colors',
        checked ? 'bg-primary-cyan' : 'bg-gray-200',
      )}>
        <span className={cn(
          'absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform',
          checked && 'translate-x-4',
        )} />
      </span>
    </button>
  )
}
