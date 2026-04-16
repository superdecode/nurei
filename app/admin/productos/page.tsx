'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, LayoutGrid, List, Edit2, Trash2, Star, StarOff,
  ChevronUp, ChevronDown, MoreHorizontal, Check, X, Package,
  ArrowUpDown, CheckSquare, Upload, Download, FileSpreadsheet,
  AlertTriangle, Copy, Loader2, Layers,
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
import type { Product, ProductStatus } from '@/types'
import { cn } from '@/lib/utils'
import Papa from 'papaparse'
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
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

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
      setCategories(json.data?.map((c: any) => ({
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
    const result = [...products]
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
  }, [products, sortField, sortDir])

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
    await Promise.all(ids.map(id => fetch(`/api/products/${id}`, { method: 'DELETE' })))
    toast.success(`${ids.length} productos eliminados`)
    setSelectedIds(new Set())
    fetchProducts()
  }, [selectedIds, fetchProducts])

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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Productos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {products.length} productos
          </p>
        </div>
        <Link href="/admin/productos/new">
          <Button className="bg-nurei-cta text-gray-900 hover:bg-nurei-cta-hover font-bold gap-1.5 h-10 px-4 rounded-xl shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo producto
          </Button>
        </Link>
      </div>

      {/* Search + View toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU..."
            className="pl-9 h-9 bg-white border-gray-200 rounded-xl"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 bg-white rounded-xl p-1 border border-gray-200 shadow-sm self-start">
          <button
            onClick={() => setViewMode('table')}
            className={cn('p-1.5 rounded-lg transition-all', viewMode === 'table' ? 'bg-primary-dark text-white shadow-sm' : 'text-gray-400 hover:text-gray-600')}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn('p-1.5 rounded-lg transition-all', viewMode === 'grid' ? 'bg-primary-dark text-white shadow-sm' : 'text-gray-400 hover:text-gray-600')}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          <button
            onClick={() => setCategoryFilter('all')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap',
              categoryFilter === 'all' ? 'bg-primary-dark text-white border-primary-dark shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}
          >
            Todos <span className="text-[10px] opacity-70">({categoryCounts.all || 0})</span>
          </button>
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap',
                categoryFilter === cat.value ? 'bg-primary-dark text-white border-primary-dark shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              {cat.emoji} {cat.label}
              {(categoryCounts[cat.value] ?? 0) > 0 && <span className="text-[10px] opacity-70">({categoryCounts[cat.value]})</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map(sf => (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value)}
              className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-all',
                statusFilter === sf.value ? 'bg-nurei-cta text-gray-900 font-bold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              )}
            >
              {sf.label}
            </button>
          ))}
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
                      {filteredProducts.map((product, idx) => {
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
                            <TableCell className="text-center">
                              <span className={cn('text-sm font-medium',
                                (product.stock_quantity ?? 0) <= (product.low_stock_threshold ?? 5) ? 'text-red-500' : 'text-gray-600'
                              )}>
                                {product.stock_quantity ?? 0}
                              </span>
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
    </div>
  )
}
