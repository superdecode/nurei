'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, LayoutGrid, List, Edit2, Trash2,
  ChevronUp, ChevronDown, MoreHorizontal, Check, X, Package,
  ArrowUpDown, CheckSquare, Filter,
  Copy, Layers, Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { formatPrice } from '@/lib/utils/format'
import type { Product } from '@/types'
import { cn } from '@/lib/utils'
import { AnchoredFilterPanel } from '@/components/admin/AnchoredFilterPanel'
import { toast } from 'sonner'

// ─── Constants ──────────────────────────────────────────────────────────



const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'draft', label: 'Borradores' },
  { value: 'archived', label: 'Archivados' },
] as const

type StatusFilter = typeof STATUS_FILTERS[number]['value']
type SortField = 'name' | 'category' | 'price' | 'status' | 'created_at'
type SortDirection = 'asc' | 'desc'
type ViewMode = 'table' | 'grid'
type CategoryOption = { slug: string; name: string; emoji?: string | null }

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-gray-100 text-gray-500',
  archived: 'bg-orange-100 text-orange-600',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  draft: 'Borrador',
  archived: 'Archivado',
}

const CATEGORY_COLORS: Record<string, string> = {
  crunchy: 'bg-amber-100 text-amber-800',
  spicy: 'bg-red-100 text-red-800',
  limited_edition: 'bg-emerald-100 text-emerald-800',
  drinks: 'bg-blue-100 text-blue-800',
  snacks: 'bg-purple-100 text-purple-800',
  ramen: 'bg-orange-100 text-orange-800',
  dulces: 'bg-pink-100 text-pink-800',
  salsas: 'bg-green-100 text-green-800',
}



// ─── Skeleton ───────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <TableRow className="border-b">
      <TableCell><div className="w-4 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
      <TableCell><div className="w-12 h-12 bg-gray-100 rounded-lg animate-pulse" /></TableCell>
      <TableCell><div className="w-32 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
      <TableCell><div className="w-16 h-4 bg-gray-100 rounded-full animate-pulse" /></TableCell>
      <TableCell><div className="w-16 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
      <TableCell><div className="w-12 h-4 bg-gray-100 rounded-full animate-pulse" /></TableCell>
      <TableCell><div className="w-10 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
    </TableRow>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="bg-gray-100 h-32" />
      <div className="p-4 space-y-2">
        <div className="w-16 h-4 bg-gray-100 rounded-full" />
        <div className="w-full h-4 bg-gray-100 rounded" />
        <div className="w-20 h-4 bg-gray-100 rounded" />
      </div>
    </div>
  )
}

// ─── Animation variants ─────────────────────────────────────────────────

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.03, duration: 0.25, ease: 'easeOut' as const },
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1, scale: 1,
    transition: { delay: i * 0.04, duration: 0.3, ease: 'easeOut' as const },
  }),
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function ProductosAdminPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{value: string, label: string, emoji: string}[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [hasDiscountFilter, setHasDiscountFilter] = useState(false)
  const [stockFilterProd, setStockFilterProd] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [stockTarget, setStockTarget] = useState<Product | null>(null)
  const [stockAdjustment, setStockAdjustment] = useState('0')
  const [stockNote, setStockNote] = useState('')
  const [bulkAction, setBulkAction] = useState<'desactivar' | 'descuento' | 'alerta' | 'stock_fijo' | 'ajuste_stock'>('desactivar')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkNote, setBulkNote] = useState('')
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 14

  // ─── Fetch ────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/products?${params}`)
      const json = await res.json()
      setProducts(json.data?.products ?? [])
    } catch {
      toast.error('Error cargando productos')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter, search])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/categories')
      const json = await res.json()
      setCategories((json.data as CategoryOption[] | undefined)?.map((c) => ({
        value: c.slug,
        label: c.name,
        emoji: c.emoji || '📦'
      })) || [])
    } catch {
      console.error('Error fetching categories')
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [fetchProducts, fetchCategories])

  // ─── Filtering & Sorting (client-side additional) ──────────────

  const filteredProducts = useMemo(() => {
    let result = [...products]
    if (hasDiscountFilter) result = result.filter((p) => (p.compare_at_price ?? 0) > (p.base_price ?? p.price))
    if (stockFilterProd) {
      result = result.filter((p) => {
        const qty = p.stock_quantity ?? 0
        const threshold = p.low_stock_threshold ?? 5
        if (stockFilterProd === 'out_of_stock') return qty <= 0
        if (stockFilterProd === 'low_stock') return qty > 0 && qty <= threshold
        if (stockFilterProd === 'available') return qty > threshold
        return true
      })
    }
    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name, 'es'); break
        case 'category': cmp = a.category.localeCompare(b.category, 'es'); break
        case 'price': cmp = (a.base_price ?? a.price) - (b.base_price ?? b.price); break
        case 'status': cmp = (a.status ?? '').localeCompare(b.status ?? ''); break
        case 'created_at': cmp = (a.created_at ?? '').localeCompare(b.created_at ?? ''); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [products, sortField, sortDir, hasDiscountFilter, stockFilterProd])
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, page])

  // ─── Derived ──────────────────────────────────────────────────

  const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedIds.has(p.id))
  const someSelected = selectedIds.size > 0

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length }
    for (const p of products) {
      counts[p.category] = (counts[p.category] || 0) + 1
    }
    return counts
  }, [products])

  const statusCounts = useMemo(() => ({
    all: products.length,
    active: products.filter((p) => (p.status ?? 'active') === 'active').length,
    draft: products.filter((p) => p.status === 'draft').length,
    archived: products.filter((p) => p.status === 'archived').length,
  }), [products])

  const activeFilters = useMemo(() => {
    const f: Array<{ id: string; label: string; onRemove: () => void }> = []
    if (statusFilter !== 'all') f.push({ id: 'status', label: STATUS_LABELS[statusFilter] ?? statusFilter, onRemove: () => setStatusFilter('all') })
    if (categoryFilter !== 'all') {
      const cat = categories.find((c) => c.value === categoryFilter)
      f.push({ id: 'cat', label: cat?.label ?? categoryFilter, onRemove: () => setCategoryFilter('all') })
    }
    if (hasDiscountFilter) f.push({ id: 'discount', label: 'Con descuento', onRemove: () => setHasDiscountFilter(false) })
    if (stockFilterProd) {
      const labels: Record<string, string> = { available: 'Disponible', low_stock: 'Stock bajo', out_of_stock: 'Agotado' }
      f.push({ id: 'stock', label: labels[stockFilterProd] ?? stockFilterProd, onRemove: () => setStockFilterProd('') })
    }
    return f
  }, [statusFilter, categoryFilter, hasDiscountFilter, stockFilterProd, categories])

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

  // ─── Handlers ─────────────────────────────────────────────────

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }, [sortField])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (allVisibleSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredProducts.map(p => p.id)))
  }, [allVisibleSelected, filteredProducts])

  const handleDelete = useCallback(async () => {
    if (!deletingProduct) return
    try {
      const res = await fetch(`/api/products/${deletingProduct.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Producto eliminado')
      fetchProducts()
    } catch {
      toast.error('Error eliminando producto')
    }
    setDeleteDialogOpen(false)
    setDeletingProduct(null)
  }, [deletingProduct, fetchProducts])

  const handleDuplicate = useCallback(async (product: Product) => {
    try {
      const res = await fetch(`/api/products/${product.id}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success('Producto duplicado')
      fetchProducts()
    } catch {
      toast.error('Error duplicando')
    }
  }, [fetchProducts])

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (!confirm(`¿Eliminar ${ids.length} productos seleccionados? Esta acción no se puede deshacer.`)) return
    await Promise.all(ids.map(id => fetch(`/api/products/${id}`, { method: 'DELETE' })))
    toast.success(`${ids.length} productos eliminados`)
    setSelectedIds(new Set())
    fetchProducts()
  }, [selectedIds, fetchProducts])

  const handleQuickStockAdjust = useCallback(async () => {
    if (!stockTarget) return
    const delta = Number(stockAdjustment)
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error('Ingresa un ajuste válido')
      return
    }
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: stockTarget.id,
          type: 'ajuste',
          quantity: Math.round(delta),
          reason: stockNote.trim() || 'Ajuste rápido desde tabla de productos',
          reference: `INV-AJU-RAP-${Date.now()}`,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Inventario actualizado')
      setStockModalOpen(false)
      setStockAdjustment('0')
      setStockNote('')
      fetchProducts()
    } catch {
      toast.error('No se pudo actualizar stock')
    }
  }, [fetchProducts, stockAdjustment, stockNote, stockTarget])

  const handleBulkAction = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const payload: Record<string, unknown> = { product_ids: ids, note: bulkNote.trim() || undefined }
    if (bulkAction === 'desactivar') payload.action = 'deactivate'
    if (bulkAction === 'descuento') { payload.action = 'apply_discount'; payload.value = Number(bulkValue) }
    if (bulkAction === 'alerta') { payload.action = 'set_low_stock_threshold'; payload.value = Number(bulkValue) }
    if (bulkAction === 'stock_fijo') { payload.action = 'set_stock_quantity'; payload.value = Number(bulkValue) }
    if (bulkAction === 'ajuste_stock') { payload.action = 'adjust_stock'; payload.value = Number(bulkValue) }
    try {
      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success('Acción masiva aplicada')
      setBulkModalOpen(false)
      setSelectedIds(new Set())
      setBulkValue('')
      setBulkNote('')
      fetchProducts()
    } catch {
      toast.error('No se pudo ejecutar la acción masiva')
    }
  }, [bulkAction, bulkNote, bulkValue, fetchProducts, selectedIds])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, categoryFilter, search, viewMode])

  // Sort header helper
  function SortHeader({ field, children }: { field: SortField; children: React.ReactNode }) {
    const active = sortField === field
    return (
      <button
        onClick={() => handleSort(field)}
        className={cn(
          'flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors',
          active ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
        )}
      >
        {children}
        {active ? (
          sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    )
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header: title + action ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold text-primary-dark">Productos</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filteredProducts.length} de {products.length} productos</p>
        </div>
        <Link href="/admin/productos/new">
          <Button className="bg-nurei-cta text-gray-900 hover:bg-nurei-cta-hover font-bold gap-1.5 h-8 px-4 text-xs rounded-full shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Nuevo producto
          </Button>
        </Link>
      </div>

      {/* ── Search, luego Filtrar + chips + vista ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative min-w-[min(100%,220px)] flex-1 basis-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU, categoría…"
            className="pl-10 pr-10 h-10 bg-white border-gray-200 rounded-full text-sm focus-visible:ring-2 focus-visible:ring-orange-400/30 focus-visible:border-orange-400/50"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Smart filter */}
        <div className="relative shrink-0" ref={filterRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={cn('flex items-center gap-1.5 h-10 px-4 rounded-full border text-sm font-semibold transition-all',
              filterOpen || activeFilters.length > 0 ? 'bg-primary-dark text-white border-primary-dark shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            )}
          >
            <Filter className="h-4 w-4" />
            Filtrar
            {activeFilters.length > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-orange-400 text-[10px] font-black text-white">{activeFilters.length}</span>
            )}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', filterOpen ? 'rotate-180' : '')} />
          </button>

          <AnchoredFilterPanel ref={filterPanelRef} open={filterOpen} anchorRef={filterRef} maxWidth={320}>
                <div className="p-4 space-y-4">
                  {/* Estado */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Estado</p>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_FILTERS.filter(sf => sf.value !== 'all').map((sf) => {
                        const count = statusCounts[sf.value as keyof typeof statusCounts] ?? 0
                        const isActive = statusFilter === sf.value
                        return (
                          <button key={sf.value} type="button" onClick={() => { setStatusFilter(isActive ? 'all' : sf.value); setPage(1) }}
                            className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                              isActive ? 'bg-primary-dark text-white border-primary-dark' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                            )}>
                            {sf.label}
                            <span className={cn('text-[10px] tabular-nums', isActive ? 'opacity-70' : 'text-gray-400')}>({count})</span>
                            {isActive && <Check className="h-2.5 w-2.5 ml-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Categoría */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Categoría</p>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((cat) => {
                        const isActive = categoryFilter === cat.value
                        return (
                          <button key={cat.value} type="button" onClick={() => { setCategoryFilter(isActive ? 'all' : cat.value); setPage(1) }}
                            className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                              isActive ? 'bg-primary-dark text-white border-primary-dark' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                            )}>
                            {cat.emoji} {cat.label}
                            {(categoryCounts[cat.value] ?? 0) > 0 && <span className={cn('text-[10px] tabular-nums', isActive ? 'opacity-70' : 'text-gray-400')}>({categoryCounts[cat.value]})</span>}
                            {isActive && <Check className="h-2.5 w-2.5 ml-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Stock */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Stock</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[{v:'available',l:'Disponible',dot:'bg-emerald-400'},{v:'low_stock',l:'Stock bajo',dot:'bg-amber-400'},{v:'out_of_stock',l:'Agotado',dot:'bg-red-400'}].map(({v,l,dot}) => (
                        <button key={v} type="button" onClick={() => { setStockFilterProd(stockFilterProd === v ? '' : v) }}
                          className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                            stockFilterProd === v ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                          )}>
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
                          {l}
                          {stockFilterProd === v && <Check className="h-2.5 w-2.5 ml-0.5" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Descuento */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Precio</p>
                    <button type="button" onClick={() => setHasDiscountFilter((v) => !v)}
                      className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                        hasDiscountFilter ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                      )}>
                      Con descuento
                      {hasDiscountFilter && <Check className="h-2.5 w-2.5 ml-0.5" />}
                    </button>
                  </div>

                  {activeFilters.length > 0 && (
                    <button type="button" onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setHasDiscountFilter(false); setStockFilterProd(''); setFilterOpen(false) }}
                      className="w-full text-center text-xs text-gray-400 hover:text-red-500 transition pt-1 border-t border-gray-100">
                      Limpiar filtros
                    </button>
                  )}
                </div>
          </AnchoredFilterPanel>
        </div>

        {activeFilters.length > 0 && (
          <div className="min-w-0 max-w-[min(100%,40rem)] grow-0 shrink max-h-[4.75rem] overflow-y-auto overscroll-y-contain rounded-xl border border-orange-100 bg-orange-50/50 px-2 py-1.5">
            <div className="flex flex-wrap content-start gap-1.5 gap-y-1">
              {activeFilters.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1 h-7 max-w-full rounded-full bg-orange-50 border border-orange-200 px-2.5 text-[11px] font-semibold text-orange-800 shrink-0">
                  <span className="truncate max-w-[14rem]">{f.label}</span>
                  <button type="button" onClick={f.onRemove} className="opacity-70 hover:opacity-100 shrink-0" aria-label="Quitar filtro">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* View toggle */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-200 shadow-sm shrink-0">
          <button onClick={() => setViewMode('table')} className={cn('p-1.5 rounded-lg transition-all', viewMode === 'table' ? 'bg-primary-dark text-white shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded-lg transition-all', viewMode === 'grid' ? 'bg-primary-dark text-white shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      <AnimatePresence>
        {someSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5">
              <CheckSquare className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-bold text-gray-900">{selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}</span>
              <Separator orientation="vertical" className="h-5" />
              <Button variant="ghost" size="sm" onClick={handleBulkDelete} className="text-error hover:bg-error/10 text-xs h-7">
                <Trash2 className="w-3 h-3 mr-1" /> Eliminar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setBulkModalOpen(true)} className="text-xs h-7">
                Acciones masivas
              </Button>
              <span className="flex-1" />
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Limpiar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        viewMode === 'table' ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <Table>
              <TableBody>
                {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'table' ? (
            <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                      <TableHead className="w-10">
                        <button
                          onClick={toggleSelectAll}
                          className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                            allVisibleSelected ? 'bg-nurei-cta border-nurei-cta' : 'border-gray-300 hover:border-gray-400'
                          )}
                        >
                          {allVisibleSelected && <Check className="w-3 h-3 text-gray-900" />}
                        </button>
                      </TableHead>
                      <TableHead className="w-12" />
                      <TableHead><SortHeader field="name">Nombre</SortHeader></TableHead>
                      <TableHead><SortHeader field="category">Categoria</SortHeader></TableHead>
                      <TableHead><SortHeader field="price">Precio</SortHeader></TableHead>
                      <TableHead><SortHeader field="status">Estado</SortHeader></TableHead>
                      <TableHead className="text-center">Stock</TableHead>
                      <TableHead className="w-16 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {paginatedProducts.map((product, idx) => {
                        const catInfo = categories.find(c => c.value === product.category) ?? { value: product.category, label: product.category, emoji: '📦' }
                        const price = product.base_price ?? product.price
                        return (
                          <motion.tr
                            key={product.id}
                            custom={idx}
                            variants={rowVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            layout
                            className={cn('border-b transition-colors group cursor-pointer',
                              selectedIds.has(product.id) ? 'bg-primary-cyan/5' : 'hover:bg-gray-50/80'
                            )}
                            onClick={() => router.push(`/admin/productos/${product.id}/edit`)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => toggleSelect(product.id)}
                                className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                                  selectedIds.has(product.id) ? 'bg-primary-cyan border-primary-cyan' : 'border-gray-300 hover:border-gray-400'
                                )}
                              >
                                {selectedIds.has(product.id) && <Check className="w-3 h-3 text-primary-dark" />}
                              </button>
                            </TableCell>
                            <TableCell>
                              <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                                {product.images?.[product.primary_image_index ?? 0] ? (
                                  <img src={product.images[product.primary_image_index ?? 0]} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xl opacity-30">{catInfo.emoji}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-primary-dark text-sm">{product.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[11px] text-gray-400">{product.sku}</p>
                                  {product.has_variants && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5">
                                      <Layers className="w-2.5 h-2.5" /> Variantes
                                    </Badge>
                                  )}
                                  {product.compare_at_price && product.compare_at_price > price && (
                                    <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
                                      -{Math.round((1 - price / product.compare_at_price) * 100)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', CATEGORY_COLORS[product.category] ?? 'bg-gray-100 text-gray-600')}>
                                {catInfo.label}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="font-semibold text-sm text-primary-dark">{formatPrice(price)}</span>
                                {product.compare_at_price && product.compare_at_price > price && (
                                  <span className="text-[10px] text-gray-400 line-through ml-1">{formatPrice(product.compare_at_price)}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', STATUS_COLORS[product.status ?? 'draft'])}>
                                {STATUS_LABELS[product.status ?? 'draft']}
                              </span>
                            </TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex items-center justify-center gap-1">
                                <span className={cn('text-sm font-medium tabular-nums',
                                  (product.stock_quantity ?? 0) <= (product.low_stock_threshold ?? 5) ? 'text-red-500' : 'text-gray-600'
                                )}>
                                  {product.stock_quantity ?? 0}
                                </span>
                                <button
                                  type="button"
                                  title="Ajustar inventario"
                                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-primary-dark"
                                  onClick={() => {
                                    setStockTarget(product)
                                    setStockAdjustment('0')
                                    setStockNote('')
                                    setStockModalOpen(true)
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreHorizontal className="w-4 h-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-[140px]">
                                  <DropdownMenuItem onClick={() => router.push(`/admin/productos/${product.id}/edit`)}>
                                    <Edit2 className="w-3.5 h-3.5" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDuplicate(product)}>
                                    <Copy className="w-3.5 h-3.5" /> Duplicar
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onClick={() => { setDeletingProduct(product); setDeleteDialogOpen(true) }}>
                                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </TableBody>
                </Table>
                {filteredProducts.length === 0 && (
                  <div className="py-16 text-center">
                    <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 font-medium">No se encontraron productos</p>
                    <p className="text-xs text-gray-400 mt-1">Intenta cambiar los filtros</p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between px-2">
                <p className="text-xs text-gray-500">Página {page} de {totalPages}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Siguiente</Button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Grid View */
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4"
            >
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product, idx) => {
                  const catInfo = categories.find(c => c.value === product.category) ?? { value: product.category, label: product.category, emoji: '📦' }
                  const price = product.base_price ?? product.price
                  return (
                    <motion.div
                      key={product.id}
                      custom={idx}
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200 transition-all group cursor-pointer"
                      onClick={() => router.push(`/admin/productos/${product.id}/edit`)}
                    >
                      <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 h-28 sm:h-36 flex items-center justify-center overflow-hidden">
                        {product.images?.[product.primary_image_index ?? 0] ? (
                          <img src={product.images[product.primary_image_index ?? 0]} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-4xl sm:text-5xl opacity-30">{catInfo.emoji}</span>
                        )}
                        <div className="absolute top-2 left-2 flex gap-1">
                          <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-medium backdrop-blur-sm shadow-sm',
                            product.status === 'active' ? 'bg-emerald-500/90 text-white' :
                            product.status === 'draft' ? 'bg-gray-500/90 text-white' : 'bg-orange-500/90 text-white'
                          )}>
                            {STATUS_LABELS[product.status ?? 'draft']}
                          </span>
                          {product.has_variants && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/90 text-white backdrop-blur-sm shadow-sm flex items-center gap-0.5">
                              <Layers className="w-2.5 h-2.5" /> Var.
                            </span>
                          )}
                        </div>
                        {product.compare_at_price && product.compare_at_price > price && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-red-500 text-white">
                            -{Math.round((1 - price / product.compare_at_price) * 100)}%
                          </div>
                        )}
                      </div>
                      <div className="p-3 sm:p-4">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', CATEGORY_COLORS[product.category] ?? 'bg-gray-100 text-gray-600')}>
                          {catInfo.label}
                        </span>
                        <p className="font-medium text-primary-dark text-sm mt-2 line-clamp-2 leading-tight">{product.name}</p>
                        <div className="flex items-center justify-between mt-2.5">
                          <div>
                            <span className="font-bold text-primary-dark">{formatPrice(price)}</span>
                            {product.compare_at_price && product.compare_at_price > price && (
                              <span className="text-[10px] text-gray-400 line-through ml-1">{formatPrice(product.compare_at_price)}</span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400">{product.stock_quantity ?? 0} stock</span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-16 text-center">
                  <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No se encontraron productos</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent size="sm" className="p-0">
          <div className="bg-gradient-to-br from-red-500 to-red-600 px-8 py-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">Eliminar Producto</DialogTitle>
                <p className="text-xs text-white/70">Esta accion no se puede deshacer</p>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <p className="text-sm text-gray-600">
              Eliminar <span className="font-bold text-primary-dark">{deletingProduct?.name}</span>?
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} className="flex-1 rounded-xl h-10 font-bold text-gray-500">
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} className="flex-1 rounded-xl h-10 font-bold">
                Eliminar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={stockModalOpen} onOpenChange={setStockModalOpen}>
        <DialogContent size="sm" className="p-6 duration-300 data-[closed]:duration-200">
          <DialogTitle>Ajuste de inventario</DialogTitle>
          <div className="space-y-3 text-sm">
            <p className="text-gray-500">{stockTarget?.name}</p>
            <p>Stock actual: <span className="font-semibold">{stockTarget?.stock_quantity ?? 0}</span></p>
            <Input type="number" value={stockAdjustment} onChange={(e) => setStockAdjustment(e.target.value)} placeholder="Cantidad a sumar/restar" />
            <Input value={stockNote} onChange={(e) => setStockNote(e.target.value)} placeholder="Nota del ajuste" />
            <p className="text-xs text-gray-500">
              Nuevo total: {(stockTarget?.stock_quantity ?? 0) + (Number(stockAdjustment) || 0)}
            </p>
            <Button onClick={handleQuickStockAdjust} className="w-full">Guardar ajuste</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent size="lg" className="p-6 sm:max-w-lg">
          <DialogTitle className="text-lg">Acciones masivas ({selectedIds.size})</DialogTitle>
          <div className="mt-4 space-y-4">
            <Select value={bulkAction} onValueChange={(v) => setBulkAction(v as typeof bulkAction)}>
              <SelectTrigger className="h-12 min-h-[3rem] w-full text-base font-medium">
                <SelectValue placeholder="Tipo de acción" />
              </SelectTrigger>
              <SelectContent className="min-w-[var(--radix-select-trigger-width)] max-w-[min(100vw-2rem,28rem)]">
                <SelectItem value="desactivar" className="py-3 text-base">
                  Desactivar productos seleccionados
                </SelectItem>
                <SelectItem value="descuento" className="py-3 text-base">
                  Aplicar el mismo descuento porcentual a todos
                </SelectItem>
                <SelectItem value="alerta" className="py-3 text-base">
                  Establecer el mismo umbral de alerta de stock bajo
                </SelectItem>
                <SelectItem value="stock_fijo" className="py-3 text-base">
                  Establecer la misma cantidad de stock fija en todos
                </SelectItem>
                <SelectItem value="ajuste_stock" className="py-3 text-base">
                  Sumar o restar la misma cantidad de stock en todos
                </SelectItem>
              </SelectContent>
            </Select>
            {bulkAction !== 'desactivar' && (
              <Input
                type="number"
                className="h-12 text-base"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder="Valor numérico de la acción"
              />
            )}
            <Input className="h-12 text-base" value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="Nota opcional" />
            <Button onClick={handleBulkAction} className="h-12 w-full text-base font-bold">
              Aplicar a {selectedIds.size} producto{selectedIds.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
