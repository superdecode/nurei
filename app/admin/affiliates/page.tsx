'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Users2, Trash2, ToggleLeft, ToggleRight,
  X, Filter, ChevronDown, Tag, TrendingUp, Eye, Banknote,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatPrice } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────
interface Affiliate {
  id: string
  handle: string
  email: string
  bio: string | null
  first_name?: string | null
  last_name?: string | null
  commission_coupon_pct: number
  commission_cookie_pct: number
  total_earned_cents: number
  pending_payout_cents: number
  is_active: boolean
  created_at: string
  referral_slug: string | null
  clicks_count: number
  coupon_count: number
  total_orders: number
  has_payment_info: boolean
  payment_method: string | null
  bank_name: string | null
  bank_holder: string | null
}

interface AffiliateForm {
  first_name: string
  last_name: string
  email: string
  handle: string
  referral_slug: string
  existing_user_id: string
  commission_coupon_pct: string
  commission_cookie_pct: string
}

const EMPTY_FORM: AffiliateForm = {
  first_name: '', last_name: '',
  email: '', handle: '', referral_slug: '', existing_user_id: '',
  commission_coupon_pct: '10', commission_cookie_pct: '5',
}

type Candidate = {
  id: string
  email: string
  full_name: string
  first_name: string
  last_name: string
  source: 'user' | 'customer'
  customer_id: string | null
}

// ── Skeleton ─────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-36 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          </TableCell>
          {Array.from({ length: 6 }).map((_, j) => (
            <TableCell key={j}>
              <div className="h-3.5 w-16 bg-gray-100 rounded animate-pulse" />
            </TableCell>
          ))}
          <TableCell>
            <div className="flex gap-1 justify-end">
              <div className="w-7 h-7 rounded-lg bg-gray-100 animate-pulse" />
              <div className="w-7 h-7 rounded-lg bg-gray-100 animate-pulse" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function AdminAffiliatesPage() {
  const router = useRouter()
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [couponsFilter, setCouponsFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AffiliateForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [candidateQuery, setCandidateQuery] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [showCandidateSearch, setShowCandidateSearch] = useState(false)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof AffiliateForm, string>>>({})

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    if (couponsFilter) params.set('has_coupons', couponsFilter)
    fetch(`/api/admin/affiliates?${params}`)
      .then((r) => r.json())
      .then(({ data }) => setAffiliates(data ?? []))
      .finally(() => setLoading(false))
  }, [search, statusFilter, couponsFilter])

  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

  useEffect(() => {
    if (!showCandidateSearch) return
    const t = setTimeout(() => {
      fetch(`/api/admin/affiliates/candidates?q=${encodeURIComponent(candidateQuery)}`)
        .then((r) => r.json())
        .then((json) => setCandidates(json.data ?? []))
    }, 250)
    return () => clearTimeout(t)
  }, [candidateQuery, showCandidateSearch])

  const handleCreate = async () => {
    const errors: Partial<Record<keyof AffiliateForm, string>> = {}
    if (!form.handle.trim()) errors.handle = 'Handle obligatorio'
    if (!form.referral_slug.trim()) errors.referral_slug = 'Slug obligatorio'
    if (!form.email.trim() && !form.existing_user_id) errors.email = 'Email obligatorio si no seleccionas usuario existente'
    if (form.commission_coupon_pct && (Number(form.commission_coupon_pct) < 0 || Number(form.commission_coupon_pct) > 100)) errors.commission_coupon_pct = 'Entre 0 y 100'
    if (form.commission_cookie_pct && (Number(form.commission_cookie_pct) < 0 || Number(form.commission_cookie_pct) > 100)) errors.commission_cookie_pct = 'Entre 0 y 100'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) { toast.error('Revisa los campos marcados'); return }

    setSaving(true)
    const res = await fetch('/api/admin/affiliates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        commission_coupon_pct: parseInt(form.commission_coupon_pct),
        commission_cookie_pct: parseInt(form.commission_cookie_pct),
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'Error al crear afiliado')
    } else {
      toast.success('Afiliado creado')
      if (json.warning) toast.warning(json.warning)
      setShowForm(false)
      setForm(EMPTY_FORM)
      setCandidateQuery('')
      setShowCandidateSearch(false)
      setFormErrors({})
      void load()
    }
    setSaving(false)
  }

  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.id === form.existing_user_id) ?? null,
    [candidates, form.existing_user_id]
  )

  const applyCandidate = (candidate: Candidate) => {
    const nameSource = candidate.full_name?.trim()
    const handleSeed = (nameSource || 'afiliado')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 24) || `afiliado${candidate.id.replace(/[^a-z0-9]/gi, '').slice(0, 5).toLowerCase()}`
    setForm((prev) => ({
      ...prev,
      existing_user_id: candidate.id,
      email: candidate.email,
      first_name: candidate.first_name || prev.first_name,
      last_name: candidate.last_name || prev.last_name,
      handle: prev.handle || handleSeed,
      referral_slug: prev.referral_slug || handleSeed,
    }))
    setCandidateQuery('')
    setShowCandidateSearch(false)
  }

  const toggleActive = async (id: string, isActive: boolean, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const res = await fetch(`/api/admin/affiliates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    if (!res.ok) toast.error('No se pudo actualizar estado del afiliado')
    else { toast.success(isActive ? 'Afiliado desactivado' : 'Afiliado activado'); void load() }
  }

  const removeAffiliate = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const ok = confirm('¿Eliminar afiliado? Se desvincularán sus cupones.')
    if (!ok) return
    const res = await fetch(`/api/admin/affiliates/${id}`, { method: 'DELETE' })
    if (!res.ok) toast.error('No se pudo eliminar')
    else { toast.success('Afiliado eliminado'); void load() }
  }

  const activeFilters = [statusFilter, couponsFilter].filter(Boolean).length

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Afiliados</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? 'Cargando...' : `${affiliates.length} afiliado${affiliates.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/affiliates/pagos">
            <Button variant="outline" className="rounded-xl h-10 font-semibold text-sm hidden sm:flex">
              Pagos pendientes
            </Button>
          </Link>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-bold rounded-xl h-10 px-5"
          >
            <Plus className="w-4 h-4 mr-2" /> Nuevo afiliado
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar handle o email..."
            className="pl-9 h-9 rounded-xl text-sm"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-semibold transition-colors',
              filtersOpen || activeFilters > 0
                ? 'border-primary-dark bg-primary-dark text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {activeFilters > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20 text-[10px] font-bold">
                {activeFilters}
              </span>
            )}
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', filtersOpen && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                className="absolute left-0 top-full mt-1.5 z-20 w-56 rounded-2xl border border-gray-200 bg-white shadow-xl p-3 space-y-3"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Estado</p>
                  <div className="flex flex-col gap-1">
                    {[['', 'Todos'], ['active', 'Activos'], ['inactive', 'Inactivos']].map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setStatusFilter(val)}
                        className={cn(
                          'text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                          statusFilter === val ? 'bg-primary-dark text-white' : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Cupones</p>
                  <div className="flex flex-col gap-1">
                    {[['', 'Todos'], ['yes', 'Con cupones'], ['no', 'Sin cupones']].map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCouponsFilter(val)}
                        className={cn(
                          'text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                          couponsFilter === val ? 'bg-primary-dark text-white' : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {activeFilters > 0 && (
                  <button
                    type="button"
                    onClick={() => { setStatusFilter(''); setCouponsFilter('') }}
                    className="w-full text-center text-xs text-red-500 font-semibold pt-1 hover:text-red-700"
                  >
                    Limpiar filtros
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Active filter chips */}
        {statusFilter && (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-dark/10 text-primary-dark text-xs font-semibold">
            {statusFilter === 'active' ? 'Activos' : 'Inactivos'}
            <button type="button" onClick={() => setStatusFilter('')}><X className="w-3 h-3" /></button>
          </span>
        )}
        {couponsFilter && (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-dark/10 text-primary-dark text-xs font-semibold">
            {couponsFilter === 'yes' ? 'Con cupones' : 'Sin cupones'}
            <button type="button" onClick={() => setCouponsFilter('')}><X className="w-3 h-3" /></button>
          </span>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              {[
                'Afiliado', 'Cupones', 'Ventas ref.', 'Comisión total',
                'Pendiente pago', 'Clics', 'Estatus', 'Acciones',
              ].map((h) => (
                <TableHead key={h} className="text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : affiliates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Users2 className="w-10 h-10 text-gray-200" />
                    <p className="text-sm font-medium text-gray-400">
                      {search || statusFilter || couponsFilter
                        ? 'Sin resultados para estos filtros'
                        : 'No hay afiliados registrados aún'}
                    </p>
                    {!search && !statusFilter && !couponsFilter && (
                      <Button
                        size="sm" variant="outline" className="h-7 rounded-full text-xs"
                        onClick={() => setShowForm(true)}
                      >
                        Crear primer afiliado
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              affiliates.map((a) => (
                <motion.tr
                  key={a.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-gray-50 hover:bg-gray-50/40 cursor-pointer transition-colors"
                  onClick={() => router.push(`/admin/affiliates/${a.id}`)}
                >
                  <TableCell className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-primary-cyan/10 flex items-center justify-center text-xs font-bold text-primary-cyan shrink-0">
                        {a.handle.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        {(a.first_name || a.last_name) && (
                          <p className="text-xs font-semibold text-gray-600 truncate">
                            {[a.first_name, a.last_name].filter(Boolean).join(' ')}
                          </p>
                        )}
                        <p className="font-bold text-primary-dark truncate">@{a.handle}</p>
                        <p className="text-[11px] text-gray-400 truncate max-w-[160px]">{a.email}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="py-3.5 px-4">
                    {a.coupon_count > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold">
                        <Tag className="w-2.5 h-2.5" />
                        {a.coupon_count}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">—</span>
                    )}
                  </TableCell>

                  <TableCell className="py-3.5 px-4">
                    {a.total_orders > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        {a.total_orders}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">0</span>
                    )}
                  </TableCell>

                  <TableCell className="py-3.5 px-4 font-bold text-sm text-primary-dark">
                    {formatPrice(a.total_earned_cents)}
                  </TableCell>

                  <TableCell className="py-3.5 px-4">
                    <span className={cn('font-semibold text-sm', a.pending_payout_cents > 0 ? 'text-amber-600' : 'text-gray-400')}>
                      {formatPrice(a.pending_payout_cents)}
                    </span>
                  </TableCell>

                  <TableCell className="py-3.5 px-4 text-xs text-gray-500">
                    {a.clicks_count > 0 ? a.clicks_count.toLocaleString() : '—'}
                  </TableCell>

                  <TableCell className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn(
                        'px-2 py-0.5 text-[10px] font-bold rounded-full',
                        a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {a.is_active ? 'Activo' : 'Inactivo'}
                      </span>

                    </div>
                  </TableCell>

                  <TableCell className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/affiliates/${a.id}`}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary-dark transition-colors"
                        title="Ver detalle"
                        aria-label="Ver detalle del afiliado"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/admin/affiliates/${a.id}?pay=1`}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                        title="Registrar pago"
                        aria-label="Registrar pago al afiliado"
                      >
                        <Banknote className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => toggleActive(a.id, a.is_active, e)}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
                        title={a.is_active ? 'Deshabilitar' : 'Habilitar'}
                      >
                        {a.is_active
                          ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                          : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => removeAffiliate(a.id, e)}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Create modal ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="p-0 max-w-md overflow-hidden">
          <div className="bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#f59e0bb3] px-8 py-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <DialogHeader className="p-0 relative">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-black/10 backdrop-blur-md flex items-center justify-center border border-black/5">
                  <Users2 className="w-5 h-5 text-gray-900" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">Nuevo afiliado</DialogTitle>
                  <p className="text-xs text-gray-900/60 font-medium">Crear perfil y vincular usuario o cliente</p>
                </div>
              </div>
            </DialogHeader>
          </div>
          <div className="space-y-4 p-6">
            {/* Candidate search */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Buscar usuario/cliente existente (opcional)
              </label>
              {!selectedCandidate ? (
                <>
                  {!showCandidateSearch ? (
                    <Button
                      type="button" variant="outline" className="h-9 text-xs rounded-full"
                      onClick={() => setShowCandidateSearch(true)}
                    >
                      Buscar usuario/cliente
                    </Button>
                  ) : (
                    <>
                      <Input
                        value={candidateQuery}
                        onChange={(e) => setCandidateQuery(e.target.value)}
                        placeholder="Buscar por nombre o correo..."
                        className="h-10"
                      />
                      {candidates.length > 0 && (
                        <div className="mt-2 max-h-40 overflow-auto rounded-xl border border-gray-100 bg-white">
                          {candidates.map((candidate) => (
                            <button
                              key={`${candidate.source}-${candidate.id}`}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
                              onClick={() => applyCandidate(candidate)}
                            >
                              <p className="font-semibold text-gray-800">{candidate.full_name || '(Sin nombre)'}</p>
                              <p className="text-xs text-gray-500">
                                {candidate.email} · {candidate.source === 'customer' ? 'Cliente' : 'Usuario'}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="group inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
                  <span className="font-semibold">
                    {selectedCandidate.full_name?.trim() ? selectedCandidate.full_name : 'Sin nombre en perfil'}
                  </span>
                  <span className="text-blue-500">{selectedCandidate.email}</span>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, existing_user_id: '', email: '' }))}
                    className="opacity-0 group-hover:opacity-100 hover:text-blue-900"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Nombre</label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder="María"
                  className="h-10"
                  disabled={Boolean(selectedCandidate?.customer_id)}
                />
                {selectedCandidate?.customer_id && <p className="text-[11px] text-gray-400 mt-1">Se usa el nombre del cliente vinculado.</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Apellido</label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  placeholder="García"
                  className="h-10"
                  disabled={Boolean(selectedCandidate?.customer_id)}
                />
                {selectedCandidate?.customer_id && <p className="text-[11px] text-gray-400 mt-1">Se usa el apellido del cliente vinculado.</p>}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Email</label>
              <Input
                type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="influencer@email.com"
                className="h-10"
                disabled={Boolean(form.existing_user_id)}
              />
              {formErrors.email && <p className="text-[11px] text-red-500 mt-1">{formErrors.email}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Handle (@) *</label>
              <Input
                type="text" value={form.handle}
                onChange={(e) => {
                  const next = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                  setForm({ ...form, handle: next, referral_slug: next })
                }}
                placeholder="mariafood"
                className="h-10"
              />
              {formErrors.handle && <p className="text-[11px] text-red-500 mt-1">{formErrors.handle}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Slug del link (/r/slug) *</label>
              <Input
                type="text" value={form.referral_slug}
                onChange={(e) => setForm({ ...form, referral_slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                placeholder="mariafood"
                className="h-10"
              />
              {formErrors.referral_slug && <p className="text-[11px] text-red-500 mt-1">{formErrors.referral_slug}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Comisión cupón (%)</label>
                <Input
                  type="number" value={form.commission_coupon_pct}
                  onChange={(e) => setForm({ ...form, commission_coupon_pct: e.target.value })}
                  className="h-10"
                />
                {formErrors.commission_coupon_pct && <p className="text-[11px] text-red-500 mt-1">{formErrors.commission_coupon_pct}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Comisión link (%)</label>
                <Input
                  type="number" value={form.commission_cookie_pct}
                  onChange={(e) => setForm({ ...form, commission_cookie_pct: e.target.value })}
                  className="h-10"
                />
                {formErrors.commission_cookie_pct && <p className="text-[11px] text-red-500 mt-1">{formErrors.commission_cookie_pct}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl h-10">Cancelar</Button>
              <Button
                onClick={handleCreate} disabled={saving}
                className="bg-primary-dark text-white rounded-xl h-10 px-6 font-bold"
              >
                {saving ? 'Creando...' : 'Crear afiliado'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
