'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight, Calendar, Copy, Filter, Plus, Search, Ticket, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AnchoredFilterPanel } from '@/components/admin/AnchoredFilterPanel'
import { formatPrice } from '@/lib/utils/format'
import type { Coupon, CouponType } from '@/types'

type ApiList = { coupons: Coupon[]; total: number; page: number; pageSize: number; totalPages: number }
type CouponStatus = 'all' | 'active' | 'paused' | 'expired' | 'exhausted'
type AffiliateOption = { id: string; handle: string; email: string }
type CouponUsageRow = {
  id: string
  order_id: string | null
  customer_email: string | null
  customer_phone: string | null
  discount_amount: number
  created_at: string
}

type ProductOption = { id: string; name: string; sku?: string | null }
type CategoryOption = { slug: string; name: string }
type ProductForImpact = { id: string; category: string }

const EMPTY = {
  code: '', type: 'percentage' as CouponType, value: '', min_order_amount: '', max_uses: '', max_uses_per_customer: '',
  conditional_threshold: '', conditional_type: 'fixed', starts_at: '', expires_at: '', description: '',
  scope_type: 'global', scope_category_slugs: [] as string[], scope_product_ids: [] as string[], customer_tags: [] as string[],
  affiliate_id: '',
}

export default function CuponesPage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<ApiList>({ coupons: [], total: 0, page: 1, pageSize: 20, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<CouponStatus>('all')
  const [type, setType] = useState<'all' | CouponType>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const [affiliates, setAffiliates] = useState<AffiliateOption[]>([])
  const [affiliateQuery, setAffiliateQuery] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [allProducts, setAllProducts] = useState<ProductForImpact[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [tagQuery, setTagQuery] = useState('')
  const [customerTags, setCustomerTags] = useState<string[]>([])
  const [targetAudienceCount, setTargetAudienceCount] = useState(0)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [showAffiliatePicker, setShowAffiliatePicker] = useState(false)
  const [formErrors, setFormErrors] = useState<Partial<Record<string, string>>>({})
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailCoupon, setDetailCoupon] = useState<Coupon | null>(null)
  const [detailAffiliate, setDetailAffiliate] = useState<{ id: string; handle: string } | null>(null)
  const [detailUsage, setDetailUsage] = useState<CouponUsageRow[]>([])

  const fetchCoupons = useCallback(async (searchTerm = search) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: '20', status, type, search: searchTerm })
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    const res = await fetch(`/api/admin/coupons?${params}`)
    const json = await res.json()
    if (!res.ok) toast.error(json.error ?? 'Error cargando cupones')
    else setData(json.data)
    setLoading(false)
  }, [page, status, type, dateFrom, dateTo])

  useEffect(() => { void fetchCoupons() }, [page, status, type, dateFrom, dateTo, fetchCoupons])
  useEffect(() => {
    const t = setTimeout(() => { void fetchCoupons() }, 350)
    return () => clearTimeout(t)
  }, [search, fetchCoupons])
  useEffect(() => {
    fetch('/api/admin/affiliates')
      .then((r) => r.json())
      .then((json) => setAffiliates((json.data ?? []).map((a: { id: string; handle: string; email: string }) => ({ id: a.id, handle: a.handle, email: a.email }))))
    fetch('/api/admin/categories')
      .then((r) => r.json())
      .then((json) => setCategories((json.data ?? []).map((category: { slug: string; name: string }) => ({ slug: category.slug, name: category.name }))))
    fetch('/api/products')
      .then((r) => r.json())
      .then((json) => {
        const list = (json.data?.products ?? [])
          .map((p: { id: string; category: string; name: string; sku?: string }) => ({ id: p.id, category: p.category, name: p.name, sku: p.sku }))
        setAllProducts(list.map((p: { id: string; category: string }) => ({ id: p.id, category: p.category })))
        setProducts(list.slice(0, 20))
      })
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(productQuery)}`)
        .then((r) => r.json())
        .then((json) => {
          const list = (json.data?.products ?? []).map((p: { id: string; name: string; sku?: string }) => ({ id: p.id, name: p.name, sku: p.sku }))
          setProducts(list.slice(0, 20))
        })
    }, 250)
    return () => clearTimeout(t)
  }, [productQuery])

  useEffect(() => {
    fetch(`/api/admin/customers/tags?selected=${encodeURIComponent(form.customer_tags.join(','))}`)
      .then((r) => r.json())
      .then((json) => {
        setCustomerTags(json.data?.tags ?? [])
        setTargetAudienceCount(json.data?.audience_count ?? 0)
      })
  }, [form.customer_tags])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const node = event.target as Node
      if (filterRef.current?.contains(node)) return
      if (filterPanelRef.current?.contains(node)) return
      setFilterOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setForm((prev) => ({ ...prev, affiliate_id: searchParams.get('affiliateId') ?? '' }))
      setShowForm(true)
    }
  }, [searchParams])

  const resultLabel = useMemo(() => `${data.total} cupones encontrados`, [data.total])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setShowCategoryPicker(false)
    setShowProductPicker(false)
    setShowTagPicker(false)
    setShowAffiliatePicker(false)
    setShowForm(true)
  }
  const openEdit = (coupon: Coupon) => {
    setEditing(coupon)
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.type === 'percentage' ? String(coupon.value) : String(Math.round(coupon.value / 100)),
      min_order_amount: String(Math.round(coupon.min_order_amount / 100)),
      max_uses: coupon.max_uses ? String(coupon.max_uses) : '',
      max_uses_per_customer: coupon.max_uses_per_customer ? String(coupon.max_uses_per_customer) : '',
      conditional_threshold: coupon.conditional_threshold ? String(Math.round(coupon.conditional_threshold / 100)) : '',
      conditional_type: coupon.conditional_type ?? 'fixed',
      starts_at: coupon.starts_at ? coupon.starts_at.slice(0, 10) : '',
      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
      description: coupon.description ?? '',
      scope_type: coupon.scope_type ?? 'global',
      scope_category_slugs: coupon.scope_category_slugs ?? [],
      scope_product_ids: coupon.scope_product_ids ?? [],
      customer_tags: coupon.customer_tags ?? [],
      affiliate_id: coupon.affiliate_id ?? '',
    })
    setShowForm(true)
    setShowCategoryPicker(false)
    setShowProductPicker(false)
    setShowTagPicker(false)
    setShowAffiliatePicker(false)
  }

  const clearFilters = () => {
    setSearch(''); setStatus('all'); setType('all'); setDateFrom(''); setDateTo(''); setPage(1)
  }

  const generateCode = () => setForm((prev) => ({ ...prev, code: `NUREI${Math.random().toString(36).slice(2, 8).toUpperCase()}` }))

  const saveCoupon = async () => {
    const errors: Partial<Record<string, string>> = {}
    if (!form.code.trim()) errors.code = 'Código obligatorio'
    if (!form.value) errors.value = 'Valor obligatorio'
    if (!form.type) errors.type = 'Tipo obligatorio'
    if (form.type === 'conditional' && !form.conditional_threshold) errors.conditional_threshold = 'Condición obligatoria para tipo condicional'
    if (!form.scope_type) errors.scope_type = 'Alcance obligatorio'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error('Hay campos obligatorios pendientes o inválidos')
      return
    }
    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: form.type === 'percentage' ? Number(form.value) : Math.round(Number(form.value) * 100),
      conditional_type: form.type === 'conditional' ? form.conditional_type : null,
      conditional_threshold: form.type === 'conditional' && form.conditional_threshold ? Math.round(Number(form.conditional_threshold) * 100) : null,
      min_order_amount: Math.round(Number(form.min_order_amount || 0) * 100),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      max_uses_per_customer: form.max_uses_per_customer ? Number(form.max_uses_per_customer) : null,
      starts_at: form.starts_at ? `${form.starts_at}T00:00:00.000Z` : null,
      expires_at: form.expires_at ? `${form.expires_at}T23:59:59.999Z` : null,
      scope_type: form.scope_type,
      scope_category_slugs: form.scope_category_slugs,
      scope_product_ids: form.scope_product_ids,
      customer_tags: form.customer_tags,
      affiliate_id: form.affiliate_id || null,
      description: form.description || null,
    }
    const url = editing ? `/api/admin/coupons/${editing.id}` : '/api/admin/coupons'
    const method = editing ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok) toast.error(json.error ?? 'No se pudo guardar')
    else { toast.success(editing ? 'Cupón actualizado' : 'Cupón creado'); setShowForm(false); setFormErrors({}); void fetchCoupons() }
  }

  const togglePaused = async (coupon: Coupon) => {
    const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_paused: !(coupon.is_paused ?? false), is_active: true }),
    })
    if (!res.ok) toast.error('No se pudo cambiar estado del cupón')
    else {
      toast.success(coupon.is_paused ? 'Cupón reactivado' : 'Cupón pausado')
      void fetchCoupons()
    }
  }

  const selectedAffiliate = useMemo(
    () => affiliates.find((affiliate) => affiliate.id === form.affiliate_id) ?? null,
    [affiliates, form.affiliate_id]
  )
  const affectedProductsCount = useMemo(() => {
    const categorySet = new Set(form.scope_category_slugs)
    const productSet = new Set(form.scope_product_ids)
    if (categorySet.size === 0 && productSet.size === 0) return 0
    const affectedIds = new Set<string>()
    for (const product of allProducts) {
      if (categorySet.has(product.category) || productSet.has(product.id)) affectedIds.add(product.id)
    }
    for (const id of productSet) affectedIds.add(id)
    return affectedIds.size
  }, [allProducts, form.scope_category_slugs, form.scope_product_ids])

  const couponPreview = useMemo(() => {
    const amount = Number(form.value || 0)
    const minOrder = Number(form.min_order_amount || 0)
    const threshold = Number(form.conditional_threshold || 0)
    const mainLine = form.type === 'percentage'
      ? `${amount || 0}% OFF`
      : form.type === 'conditional'
        ? `${form.conditional_type === 'percentage' ? `${amount || 0}%` : `$${Math.round(amount || 0)}`} OFF condicional`
        : `$${Math.round(amount || 0)} OFF`
    const conditions: string[] = []
    if (form.type === 'conditional') {
      conditions.push(`se activa desde $${Math.round(threshold || 0)}`)
    }
    if (minOrder > 0) conditions.push(`compra minima de $${Math.round(minOrder)}`)
    if (form.scope_type !== 'global') conditions.push(`${affectedProductsCount} productos aplicables`)
    const subtitle = conditions.length > 0 ? conditions.join(' · ') : 'sin restricciones adicionales'
    return { mainLine, subtitle }
  }, [
    form.value,
    form.type,
    form.min_order_amount,
    form.conditional_threshold,
    form.scope_type,
    affectedProductsCount,
  ])

  const activeFilters = useMemo(() => {
    const filters: Array<{ id: string; label: string; onRemove: () => void }> = []
    if (status !== 'all') filters.push({ id: 'status', label: `Estado: ${status}`, onRemove: () => setStatus('all') })
    if (type !== 'all') filters.push({ id: 'type', label: `Tipo: ${type}`, onRemove: () => setType('all') })
    if (dateFrom) filters.push({ id: 'from', label: `Desde ${dateFrom}`, onRemove: () => setDateFrom('') })
    if (dateTo) filters.push({ id: 'to', label: `Hasta ${dateTo}`, onRemove: () => setDateTo('') })
    return filters
  }, [status, type, dateFrom, dateTo])

  const filteredAffiliates = affiliates.filter((affiliate) => {
    const query = affiliateQuery.trim().toLowerCase()
    if (!query) return true
    return affiliate.handle.toLowerCase().includes(query) || affiliate.email.toLowerCase().includes(query)
  })

  const filteredTags = customerTags.filter((tag) => tag.toLowerCase().includes(tagQuery.toLowerCase()))

  const openDetail = async (couponId: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    const res = await fetch(`/api/admin/coupons/${couponId}`)
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'No se pudo cargar detalle')
      setDetailLoading(false)
      return
    }
    setDetailCoupon(json.data.coupon)
    setDetailAffiliate(json.data.affiliate ?? null)
    setDetailUsage(json.data.usage ?? [])
    setDetailLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-primary-dark">Cupones</h1><p className="text-sm text-gray-400 mt-0.5">{resultLabel}</p></div>
        <Button onClick={openCreate} className="h-10 rounded-full text-sm font-semibold"><Plus className="w-4 h-4 mr-1.5" /> Crear cupón</Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código..." className="h-10 pl-9 rounded-full" />
        </div>
        <Button type="button" variant="outline" className="h-10 rounded-full text-sm font-semibold" onClick={() => setFilterOpen((open) => !open)}>
          <Filter className="h-4 w-4 mr-1.5" /> Filtrar
        </Button>
        <div className="relative" ref={filterRef}>
          <AnchoredFilterPanel ref={filterPanelRef} open={filterOpen} anchorRef={filterRef} maxWidth={320}>
            <div className="p-4 space-y-3">
              <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Estado</p><select className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value as CouponStatus)}><option value="all">Todos</option><option value="active">Activo</option><option value="paused">Pausado</option><option value="expired">Vencido</option><option value="exhausted">Agotado</option></select></div>
              <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Tipo</p><select className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm" value={type} onChange={(e) => setType(e.target.value as 'all' | CouponType)}><option value="all">Todos</option><option value="fixed">Monto fijo</option><option value="percentage">Porcentaje</option><option value="conditional">Condicional</option></select></div>
              <div className="grid grid-cols-2 gap-2"><Input type="date" className="h-9 rounded-xl" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /><Input type="date" className="h-9 rounded-xl" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
              <Button variant="ghost" className="w-full h-8 text-xs" onClick={clearFilters}>Limpiar filtros</Button>
            </div>
          </AnchoredFilterPanel>
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map((filter) => (
              <span key={filter.id} className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 h-7 text-[11px] font-semibold text-orange-800">
                {filter.label}
                <button type="button" onClick={filter.onRemove}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-gray-50/80"><TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Código</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Tipo</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Descuento</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Alcance</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Afiliado</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Usos</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Vigencia</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Estado</TableHead><TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">Acciones</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-gray-400">Cargando...</TableCell></TableRow> : data.coupons.map((c) => (
              <TableRow key={c.id} className="hover:bg-gray-50/70">
                <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                <TableCell>{c.type === 'fixed' ? 'Monto fijo' : c.type === 'percentage' ? 'Porcentaje' : 'Condicional'}</TableCell>
                <TableCell>{c.type === 'percentage' ? `${c.value}%` : formatPrice(c.value)}</TableCell>
                <TableCell>{c.scope_type === 'categories' || c.scope_type === 'products' ? 'Categorías y/o productos' : 'Global'}</TableCell>
                <TableCell>
                  {c.affiliate_id && c.affiliate_handle ? (
                    <Link href={`/admin/affiliates/${c.affiliate_id}`} className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold hover:underline">
                      @{c.affiliate_handle}
                    </Link>
                  ) : <span className="text-xs text-gray-400">Sin afiliado</span>}
                </TableCell>
                <TableCell>{c.used_count}/{c.max_uses ?? '∞'}</TableCell>
                <TableCell><div className="text-xs text-gray-500">{c.starts_at ? new Date(c.starts_at).toLocaleDateString('es-MX') : 'Inmediato'} <Calendar className="inline h-3 w-3 mx-1" /> {c.expires_at ? new Date(c.expires_at).toLocaleDateString('es-MX') : 'Sin fin'}</div></TableCell>
                <TableCell>
                  <Badge variant={c.computed_status === 'active' ? 'default' : 'secondary'}>
                    {c.computed_status === 'active' ? 'Activo' : c.computed_status === 'paused' ? 'Pausado' : c.computed_status === 'expired' ? 'Vencido' : 'Agotado'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="outline" className="h-8" onClick={() => openEdit(c)}>Editar</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => openDetail(c.id)}>Historial</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => togglePaused(c)}>{c.is_paused ? 'Reactivar' : 'Pausar'}</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => { navigator.clipboard.writeText(c.code); toast.success('Código copiado') }}><Copy className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && data.coupons.length === 0 && <TableRow><TableCell colSpan={9} className="py-12 text-center text-sm text-gray-400"><Ticket className="w-5 h-5 mx-auto mb-2" />No hay cupones para esos filtros.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">Página {data.page} de {data.totalPages}</p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" className="h-8" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent size="lg" className="p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#f59e0bb3] px-8 py-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <DialogHeader className="p-0 relative">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-black/10 backdrop-blur-md flex items-center justify-center border border-black/5">
                  <Ticket className="w-5 h-5 text-gray-900" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">{editing ? 'Editar cupón' : 'Crear cupón'}</DialogTitle>
                  <p className="text-xs text-gray-900/60 font-medium">Configura descuentos, alcance y validaciones</p>
                </div>
              </div>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2"><label className="text-xs text-gray-500">Código *</label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />{formErrors.code && <p className="text-[11px] text-red-500 mt-1">{formErrors.code}</p>}</div>
              <div className="flex items-end"><Button variant="outline" className="w-full" onClick={generateCode}>Generar código</Button></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className="text-xs text-gray-500">Tipo *</label><select className="w-full h-10 border rounded-xl px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}><option value="percentage">Porcentaje</option><option value="fixed">Monto fijo</option><option value="conditional">Condicional</option></select>{formErrors.type && <p className="text-[11px] text-red-500 mt-1">{formErrors.type}</p>}</div>
              <div><label className="text-xs text-gray-500">Valor *</label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />{formErrors.value && <p className="text-[11px] text-red-500 mt-1">{formErrors.value}</p>}</div>
              <div><label className="text-xs text-gray-500">Mínimo compra (MXN)</label><Input type="number" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })} /></div>
            </div>
            {form.type === 'conditional' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Condición activa en (MXN) *</label><Input type="number" value={form.conditional_threshold} onChange={(e) => setForm({ ...form, conditional_threshold: e.target.value })} />{formErrors.conditional_threshold && <p className="text-[11px] text-red-500 mt-1">{formErrors.conditional_threshold}</p>}</div>
                <div><label className="text-xs text-gray-500">Tipo condicional</label><select className="w-full h-10 border rounded-xl px-3 text-sm" value={form.conditional_type} onChange={(e) => setForm({ ...form, conditional_type: e.target.value as 'fixed' | 'percentage' })}><option value="fixed">Monto fijo</option><option value="percentage">Porcentaje</option></select></div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Límite global</label><Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">Límite por cliente</label><Input type="number" value={form.max_uses_per_customer} onChange={(e) => setForm({ ...form, max_uses_per_customer: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500">Inicio</label><Input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">Vence</label><Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></div>
            </div>
            <div><label className="text-xs text-gray-500">Alcance *</label><select className="w-full h-10 border rounded-xl px-3 text-sm" value={form.scope_type} onChange={(e) => setForm({ ...form, scope_type: e.target.value })}><option value="global">Global</option><option value="categories">Específico (categorías y/o productos)</option></select>{formErrors.scope_type && <p className="text-[11px] text-red-500 mt-1">{formErrors.scope_type}</p>}</div>
            {form.scope_type !== 'global' && (
              <div>
                <label className="text-xs text-gray-500">Categorías</label>
                <div className="rounded-xl border border-gray-200 p-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {form.scope_category_slugs.map((slug) => (
                      <span key={slug} className="group inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 h-7 text-[11px] font-semibold text-sky-800">
                        {categories.find((category) => category.slug === slug)?.name ?? slug}
                        <button type="button" className="opacity-0 group-hover:opacity-100" onClick={() => setForm((prev) => ({ ...prev, scope_category_slugs: prev.scope_category_slugs.filter((item) => item !== slug) }))}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  {!showCategoryPicker ? (
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs rounded-full" onClick={() => setShowCategoryPicker(true)}>Agregar categoría</Button>
                  ) : (
                    <div className="max-h-36 overflow-auto rounded-lg border border-gray-100">
                      {categories.filter((category) => !form.scope_category_slugs.includes(category.slug)).map((category) => (
                        <button key={category.slug} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-b-0" onClick={() => { setForm((prev) => ({ ...prev, scope_category_slugs: [...prev.scope_category_slugs, category.slug] })); setShowCategoryPicker(false) }}>
                          {category.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {form.scope_type !== 'global' && (
              <div>
                <label className="text-xs text-gray-500">Productos específicos</label>
                <div className="rounded-xl border border-gray-200 p-2 space-y-2">
                  {showProductPicker && <Input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Buscar por nombre o SKU..." />}
                  <div className="flex flex-wrap gap-1.5">
                    {form.scope_product_ids.map((id) => {
                      const product = products.find((item) => item.id === id)
                      return (
                        <span key={id} className="group inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 h-7 text-[11px] font-semibold text-purple-800">
                          {product?.name ?? id.slice(0, 8)}
                          <button type="button" className="opacity-0 group-hover:opacity-100" onClick={() => setForm((prev) => ({ ...prev, scope_product_ids: prev.scope_product_ids.filter((item) => item !== id) }))}><X className="w-3 h-3" /></button>
                        </span>
                      )
                    })}
                  </div>
                  {!showProductPicker ? (
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs rounded-full" onClick={() => setShowProductPicker(true)}>Agregar producto</Button>
                  ) : (
                    <div className="max-h-36 overflow-auto rounded-lg border border-gray-100">
                      {products.filter((product) => !form.scope_product_ids.includes(product.id)).map((product) => (
                        <button key={product.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-b-0" onClick={() => { setForm((prev) => ({ ...prev, scope_product_ids: [...prev.scope_product_ids, product.id] })); setShowProductPicker(false); setProductQuery('') }}>
                          <p className="font-medium text-gray-800">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.sku ?? product.id.slice(0, 8)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">{affectedProductsCount} productos afectados según condiciones actuales.</p>
                </div>
              </div>
            )}
            {form.scope_type !== 'global' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800/80 mb-1">Resumen productos afectados</p>
                <p className="text-sm text-amber-900">
                  Este cupón impacta <span className="font-bold">{affectedProductsCount}</span> productos segun las categorias y productos seleccionados.
                </p>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500">Etiquetas de cliente</label>
              <div className="rounded-xl border border-gray-200 p-2 space-y-2">
                {showTagPicker && <Input value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} placeholder="Buscar etiqueta..." />}
                <div className="flex flex-wrap gap-1.5">
                  {form.customer_tags.map((tag) => (
                    <span key={tag} className="group inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 h-7 text-[11px] font-semibold text-amber-800">
                      {tag}
                      <button type="button" className="opacity-0 group-hover:opacity-100" onClick={() => setForm((prev) => ({ ...prev, customer_tags: prev.customer_tags.filter((item) => item !== tag) }))}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                {!showTagPicker ? (
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs rounded-full" onClick={() => setShowTagPicker(true)}>Agregar etiqueta</Button>
                ) : (
                  <div className="max-h-28 overflow-auto rounded-lg border border-gray-100">
                    {filteredTags.filter((tag) => !form.customer_tags.includes(tag)).map((tag) => (
                      <button key={tag} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-b-0" onClick={() => { setForm((prev) => ({ ...prev, customer_tags: [...prev.customer_tags, tag] })); setShowTagPicker(false); setTagQuery('') }}>
                        {tag}
                      </button>
                    ))}
                    {tagQuery.trim() && !filteredTags.some((tag) => tag.toLowerCase() === tagQuery.trim().toLowerCase()) && (
                      <button type="button" className="w-full text-left px-3 py-2 text-sm font-semibold text-primary-dark hover:bg-gray-50" onClick={async () => {
                        const nextTag = tagQuery.trim()
                        if (!nextTag) return
                        const res = await fetch('/api/admin/customers/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: nextTag }) })
                        if (res.ok) {
                          setForm((prev) => ({ ...prev, customer_tags: [...prev.customer_tags, nextTag] }))
                          setShowTagPicker(false)
                          setTagQuery('')
                        }
                      }}>
                        Crear etiqueta "{tagQuery.trim()}"
                      </button>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500">{targetAudienceCount} clientes coinciden con las etiquetas seleccionadas.</p>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Afiliado (máximo uno)</label>
              <div className="rounded-xl border border-gray-200 p-2 space-y-2">
                {showAffiliatePicker && <Input value={affiliateQuery} onChange={(e) => setAffiliateQuery(e.target.value)} placeholder="Buscar afiliado por handle o email..." />}
                {selectedAffiliate ? (
                  <span className="group inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 h-7 text-[11px] font-semibold text-blue-800">
                    @{selectedAffiliate.handle}
                    <Link href={`/admin/affiliates/${selectedAffiliate.id}`} className="opacity-0 group-hover:opacity-100" title="Ver perfil">
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                    <button type="button" className="opacity-0 group-hover:opacity-100" onClick={() => setForm((prev) => ({ ...prev, affiliate_id: '' }))}><X className="w-3 h-3" /></button>
                  </span>
                ) : (
                  <>
                    {!showAffiliatePicker ? (
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs rounded-full" onClick={() => setShowAffiliatePicker(true)}>Seleccionar afiliado</Button>
                    ) : (
                      <div className="max-h-28 overflow-auto rounded-lg border border-gray-100">
                        {filteredAffiliates.map((affiliate) => (
                          <button key={affiliate.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-b-0" onClick={() => { setForm((prev) => ({ ...prev, affiliate_id: affiliate.id })); setShowAffiliatePicker(false); setAffiliateQuery('') }}>
                            <p className="font-medium text-gray-800">@{affiliate.handle}</p>
                            <p className="text-xs text-gray-500">{affiliate.email}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div><label className="text-xs text-gray-500">Descripción</label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="rounded-xl border border-primary-cyan/30 bg-primary-cyan/10 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary-dark/70 mb-1">Resumen rápido del cupón</p>
              <p className="text-base font-bold text-primary-dark">{couponPreview.mainLine}</p>
              <p className="text-xs text-primary-dark/80 mt-0.5">{couponPreview.subtitle}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={saveCoupon}>{editing ? 'Guardar cambios' : 'Crear cupón'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent size="lg" className="p-0 overflow-hidden">
          <div className="p-6 border-b">
            <DialogTitle>Detalle e historial de uso</DialogTitle>
          </div>
          <div className="p-6">
            {detailLoading ? (
              <p className="text-sm text-gray-400">Cargando...</p>
            ) : (
              <>
                {detailCoupon && (
                  <div className="mb-4">
                    <p className="font-mono font-bold text-primary-dark text-lg">{detailCoupon.code}</p>
                    {detailAffiliate ? (
                      <Link href={`/admin/affiliates/${detailAffiliate.id}`} className="text-xs text-blue-600 hover:underline">
                        Afiliado: @{detailAffiliate.handle}
                      </Link>
                    ) : (
                      <p className="text-xs text-gray-400">Sin afiliado asignado</p>
                    )}
                  </div>
                )}
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <Table>
                    <TableHeader><TableRow className="bg-gray-50/80"><TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Fecha</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Cliente</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Orden</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Descuento</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {detailUsage.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-gray-400">Sin usos registrados.</TableCell></TableRow>
                      ) : detailUsage.map((usage) => (
                        <TableRow key={usage.id}>
                          <TableCell className="text-xs text-gray-500">{new Date(usage.created_at).toLocaleString('es-MX')}</TableCell>
                          <TableCell className="text-xs">{usage.customer_email ?? usage.customer_phone ?? '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{usage.order_id ? usage.order_id.slice(0, 8) : '—'}</TableCell>
                          <TableCell className="text-sm font-semibold">{formatPrice(usage.discount_amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
