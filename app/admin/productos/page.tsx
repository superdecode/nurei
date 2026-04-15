'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import {
  Plus, Search, LayoutGrid, List, Edit2, Trash2, Star, StarOff,
  ChevronUp, ChevronDown, ChevronRight, MoreHorizontal, Check, X, Package,
  ArrowUpDown, Filter, CheckSquare, Upload, Download, FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { PRODUCTS } from '@/lib/data/products'
import { formatPrice } from '@/lib/utils/format'
import type { Product, ProductCategory } from '@/types'
import { cn } from '@/lib/utils'
import Papa from 'papaparse'
import { toast } from 'sonner'

// ─── Constants ──────────────────────────────────────────────────────────

const CATEGORIES: { value: ProductCategory; label: string; emoji: string }[] = [
  { value: 'crunchy', label: 'Crunchy', emoji: '�' },
  { value: 'spicy', label: 'Spicy', emoji: '🌶️' },
  { value: 'limited_edition', label: 'Limited Edition', emoji: '�' },
  { value: 'drinks', label: 'Drinks', emoji: '🥤' },
]

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'featured', label: 'Destacados' },
] as const

type StatusFilter = typeof STATUS_FILTERS[number]['value']
type SortField = 'name' | 'category' | 'price' | 'availability_score' | 'is_active'
type SortDirection = 'asc' | 'desc'
type ViewMode = 'table' | 'grid'

const CATEGORY_COLORS: Record<ProductCategory, string> = {
  crunchy: 'bg-amber-100 text-amber-800',
  spicy: 'bg-red-100 text-red-800',
  limited_edition: 'bg-emerald-100 text-emerald-800',
  drinks: 'bg-blue-100 text-blue-800',
}

function getCategoryEmoji(cat: ProductCategory): string {
  return CATEGORIES.find(c => c.value === cat)?.emoji ?? '📦'
}

function getCategoryLabel(cat: ProductCategory): string {
  return CATEGORIES.find(c => c.value === cat)?.label ?? cat
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// ─── Default form state ─────────────────────────────────────────────────

interface ProductForm {
  name: string
  slug: string
  description: string
  category: ProductCategory
  subcategory: string
  sku: string
  origin: string
  spice_level: string
  weight_g: string
  price_pesos: string
  cost_estimate_pesos: string
  availability_score: string
  stock_quantity: string
  low_stock_threshold: string
  track_inventory: boolean
  allow_backorder: boolean
  is_active: boolean
  is_featured: boolean
  is_limited: boolean
}

const emptyForm: ProductForm = {
  name: '',
  slug: '',
  description: '',
  category: 'crunchy',
  subcategory: '',
  sku: '',
  origin: 'Japón',
  spice_level: '0',
  weight_g: '100',
  price_pesos: '',
  cost_estimate_pesos: '',
  availability_score: '80',
  stock_quantity: '0',
  low_stock_threshold: '5',
  track_inventory: true,
  allow_backorder: false,
  is_active: true,
  is_featured: false,
  is_limited: false,
}

function productToForm(p: Product): ProductForm {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description ?? '',
    category: p.category,
    subcategory: p.subcategory ?? '',
    sku: p.sku ?? '',
    origin: p.origin ?? 'Japón',
    spice_level: p.spice_level.toString(),
    weight_g: p.weight_g.toString(),
    is_limited: p.is_limited,
    price_pesos: (p.price / 100).toString(),
    cost_estimate_pesos: p.cost_estimate ? (p.cost_estimate / 100).toString() : '',
    availability_score: p.availability_score.toString(),
    stock_quantity: (p.stock_quantity ?? 0).toString(),
    low_stock_threshold: (p.low_stock_threshold ?? 5).toString(),
    track_inventory: p.track_inventory ?? true,
    allow_backorder: p.allow_backorder ?? false,
    is_active: p.is_active,
    is_featured: p.is_featured,
  }
}

function formToProduct(form: ProductForm, existingId?: string): Product {
  const now = new Date().toISOString()
  return {
    id: existingId ?? Date.now().toString(),
    name: form.name,
    slug: form.slug,
    description: form.description || null,
    category: form.category,
    subcategory: form.subcategory || null,
    sku: form.sku || `NR-${Date.now()}`,
    origin: form.origin || 'Japón',
    spice_level: parseInt(form.spice_level, 10) || 0,
    weight_g: parseInt(form.weight_g, 10) || 100,
    is_limited: form.is_limited,
    price: Math.round(parseFloat(form.price_pesos || '0') * 100),
    cost_estimate: form.cost_estimate_pesos
      ? Math.round(parseFloat(form.cost_estimate_pesos) * 100)
      : null,
    availability_score: parseInt(form.availability_score, 10) || 0,
    is_active: form.is_active,
    is_featured: form.is_featured,
    compare_at_price: null,
    image_url: null,
    image_thumbnail_url: null,
    meta_title: null,
    meta_description: null,
    stock_quantity: parseInt(form.stock_quantity, 10) || 0,
    low_stock_threshold: parseInt(form.low_stock_threshold, 10) || 5,
    track_inventory: form.track_inventory,
    allow_backorder: form.allow_backorder,
    views_count: 0,
    purchases_count: 0,
    created_at: existingId ? now : now,
    updated_at: now,
  }
}

// ─── Validation ─────────────────────────────────────────────────────────

interface FormErrors {
  name?: string
  price_pesos?: string
  availability_score?: string
}

function validateForm(form: ProductForm): FormErrors {
  const errors: FormErrors = {}
  if (!form.name.trim()) errors.name = 'El nombre es obligatorio'
  if (!form.price_pesos || parseFloat(form.price_pesos) <= 0) errors.price_pesos = 'El precio debe ser mayor a $0'
  const score = parseInt(form.availability_score, 10)
  if (isNaN(score) || score < 0 || score > 100) errors.availability_score = 'Debe ser entre 0 y 100'
  return errors
}

// ─── Animation variants ─────────────────────────────────────────────────

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.25, ease: 'easeOut' as const },
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.04, duration: 0.3, ease: 'easeOut' as const },
  }),
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
}

const filterBarVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: 'auto', transition: { duration: 0.2 } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.15 } },
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function ProductosAdminPage() {
  // Data state
  const [products, setProducts] = useState<Product[]>(() => [...PRODUCTS])

  // UI state
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [showImportModal, setShowImportModal] = useState(false)
  const [importPreview, setImportPreview] = useState<Partial<Product>[]>([])
  const [csvRawHeaders, setCsvRawHeaders] = useState<string[]>([])
  const [csvRawRows, setCsvRawRows] = useState<Record<string, string>[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importStep, setImportStep] = useState<'mapping' | 'validate'>('mapping')

  // Product fields available for mapping
  const PRODUCT_FIELDS = [
    { value: '', label: '— Ignorar —' },
    { value: 'name', label: 'Nombre *' },
    { value: 'slug', label: 'Slug' },
    { value: 'description', label: 'Descripción' },
    { value: 'category', label: 'Categoría' },
    { value: 'sku', label: 'SKU' },
    { value: 'origin', label: 'Origen' },
    { value: 'price', label: 'Precio (MXN)' },
    { value: 'weight_g', label: 'Peso (g)' },
    { value: 'spice_level', label: 'Nivel picante' },
    { value: 'availability_score', label: 'Disponibilidad %' },
    { value: 'stock_quantity', label: 'Stock' },
    { value: 'is_active', label: 'Activo (true/false)' },
    { value: 'is_featured', label: 'Destacado (true/false)' },
  ]

  // Auto-detect column mapping from header names
  const autoDetect = (headers: string[]): Record<string, string> => {
    const MAP: Record<string, string> = {
      name: 'name', nombre: 'name',
      slug: 'slug',
      description: 'description', descripcion: 'description', desc: 'description',
      category: 'category', categoria: 'category', cat: 'category',
      sku: 'sku', codigo: 'sku', code: 'sku',
      origin: 'origin', origen: 'origin', pais: 'origin',
      price: 'price', precio: 'price', costo: 'price', cost: 'price',
      weight: 'weight_g', weight_g: 'weight_g', peso: 'weight_g', 'peso(g)': 'weight_g',
      spice: 'spice_level', spice_level: 'spice_level', picante: 'spice_level',
      availability: 'availability_score', availability_score: 'availability_score', disponibilidad: 'availability_score',
      stock: 'stock_quantity', stock_quantity: 'stock_quantity', inventario: 'stock_quantity',
      is_active: 'is_active', activo: 'is_active', active: 'is_active',
      is_featured: 'is_featured', destacado: 'is_featured', featured: 'is_featured',
    }
    const result: Record<string, string> = {}
    for (const h of headers) {
      result[h] = MAP[h.toLowerCase().trim()] ?? ''
    }
    return result
  }

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[]
        const headers = results.meta.fields ?? []
        setCsvRawHeaders(headers)
        setCsvRawRows(rows)
        setColumnMapping(autoDetect(headers))
        setImportStep('mapping')
        setShowImportModal(true)
      },
      error: () => toast.error('Error al leer el archivo'),
    })
    e.target.value = ''
  }

  const buildPreviewFromMapping = () => {
    const now = new Date().toISOString()
    const parsed: Partial<Product>[] = csvRawRows.map((row) => {
      const mapped: Record<string, string> = {}
      for (const [csvCol, productField] of Object.entries(columnMapping)) {
        if (productField) mapped[productField] = row[csvCol] ?? ''
      }
      const name = mapped.name ?? ''
      const price = Math.round(parseFloat(mapped.price || '0') * 100)
      const cat = (['crunchy', 'spicy', 'limited_edition', 'drinks'].includes(mapped.category || '')
        ? mapped.category : 'crunchy') as ProductCategory
      return {
        id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        slug: mapped.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: mapped.description || null,
        category: cat,
        sku: mapped.sku || `NR-${Date.now()}`,
        origin: mapped.origin || 'Japón',
        spice_level: parseInt(mapped.spice_level || '0', 10) || 0,
        weight_g: parseInt(mapped.weight_g || '100', 10) || 100,
        price,
        is_active: mapped.is_active !== 'false',
        is_featured: mapped.is_featured === 'true',
        is_limited: false,
        availability_score: parseInt(mapped.availability_score || '100', 10) || 100,
        stock_quantity: parseInt(mapped.stock_quantity || '0', 10) || 0,
        compare_at_price: null, cost_estimate: null, image_url: null,
        image_thumbnail_url: null, meta_title: null, meta_description: null,
        subcategory: null, views_count: 0, purchases_count: 0,
        created_at: now, updated_at: now,
      }
    })
    return parsed.filter((p) => p.name)
  }

  const confirmImport = () => {
    const newProducts = importPreview as Product[]
    setProducts((prev) => [...newProducts, ...prev])
    setShowImportModal(false)
    setImportPreview([])
    setCsvRawRows([])
    setCsvRawHeaders([])
    toast.success(`${newProducts.length} productos importados`)
  }

  const downloadTemplate = () => {
    const csv = 'name,category,sku,origin,spice_level,weight_g,price,is_active,is_featured,stock_quantity\nRamen Shirakiku Tonkotsu,crunchy,NR-001,Japón,1,500,89.90,true,false,20'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nurei-productos-plantilla.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Filtering & Sorting ────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let result = [...products]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subcategory && p.subcategory.toLowerCase().includes(q))
      )
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category === categoryFilter)
    }

    // Status filter
    if (statusFilter === 'active') result = result.filter(p => p.is_active)
    if (statusFilter === 'inactive') result = result.filter(p => !p.is_active)
    if (statusFilter === 'featured') result = result.filter(p => p.is_featured)

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name, 'es'); break
        case 'category': cmp = a.category.localeCompare(b.category, 'es'); break
        case 'price': cmp = a.price - b.price; break
        case 'availability_score': cmp = a.availability_score - b.availability_score; break
        case 'is_active': cmp = (a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [products, search, categoryFilter, statusFilter, sortField, sortDir])

  // ─── Derived ────────────────────────────────────────────────────

  const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedIds.has(p.id))
  const someSelected = selectedIds.size > 0

  // Category counts for filter pills
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length }
    for (const p of products) {
      counts[p.category] = (counts[p.category] || 0) + 1
    }
    return counts
  }, [products])

  // ─── Handlers ───────────────────────────────────────────────────

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
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)))
    }
  }, [allVisibleSelected, filteredProducts])

  // Create
  const handleOpenCreate = useCallback(() => {
    setEditingProduct(null)
    setForm(emptyForm)
    setFormErrors({})
    setEditDialogOpen(true)
  }, [])

  // Edit
  const handleOpenEdit = useCallback((product: Product) => {
    setEditingProduct(product)
    setForm(productToForm(product))
    setFormErrors({})
    setEditDialogOpen(true)
  }, [])

  // Save (create or update)
  const handleSave = useCallback(() => {
    const errors = validateForm(form)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    if (editingProduct) {
      // Update existing
      const updated = formToProduct(form, editingProduct.id)
      updated.created_at = editingProduct.created_at
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? updated : p))
    } else {
      // Create new
      const created = formToProduct(form)
      setProducts(prev => [created, ...prev])
    }
    setEditDialogOpen(false)
  }, [form, editingProduct])

  // Delete
  const handleOpenDelete = useCallback((product: Product) => {
    setDeletingProduct(product)
    setDeleteDialogOpen(true)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (!deletingProduct) return
    setProducts(prev => prev.filter(p => p.id !== deletingProduct.id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(deletingProduct.id)
      return next
    })
    setDeleteDialogOpen(false)
    setDeletingProduct(null)
  }, [deletingProduct])

  // Bulk actions
  const handleBulkActivate = useCallback(() => {
    setProducts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, is_active: true, updated_at: new Date().toISOString() } : p))
    setSelectedIds(new Set())
  }, [selectedIds])

  const handleBulkDeactivate = useCallback(() => {
    setProducts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, is_active: false, updated_at: new Date().toISOString() } : p))
    setSelectedIds(new Set())
  }, [selectedIds])

  const handleBulkDelete = useCallback(() => {
    setProducts(prev => prev.filter(p => !selectedIds.has(p.id)))
    setSelectedIds(new Set())
  }, [selectedIds])

  // Toggle featured inline
  const handleToggleFeatured = useCallback((id: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_featured: !p.is_featured, updated_at: new Date().toISOString() } : p))
  }, [])

  // Form update helper
  const updateForm = useCallback((updates: Partial<ProductForm>) => {
    setForm(prev => {
      const next = { ...prev, ...updates }
      // Auto-generate slug from name
      if ('name' in updates && !editingProduct) {
        next.slug = slugify(updates.name ?? '')
      }
      return next
    })
    // Clear errors on field change
    if (Object.keys(updates).some(k => k in formErrors)) {
      setFormErrors(prev => {
        const next = { ...prev }
        for (const k of Object.keys(updates)) {
          delete next[k as keyof FormErrors]
        }
        return next
      })
    }
  }, [editingProduct, formErrors])

  // ─── Sort header helper ─────────────────────────────────────────

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

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Productos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {products.length} productos &middot; {products.filter(p => p.is_active).length} activos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 h-10 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Importar CSV</span>
            <span className="sm:hidden">CSV</span>
            <input type="file" accept=".csv,.txt" onChange={handleCSVImport} className="hidden" />
          </label>
          <Button
            onClick={handleOpenCreate}
            className="bg-nurei-cta text-gray-900 hover:bg-nurei-cta-hover font-bold gap-1.5 h-10 px-4 rounded-xl shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo producto</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
      </div>

      {/* ─── Search + View toggle ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, categoría..."
            className="pl-9 h-9 bg-white border-gray-200 rounded-xl"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 bg-white rounded-xl p-1 border border-gray-200 shadow-sm self-start">
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'p-1.5 rounded-lg transition-all',
              viewMode === 'table'
                ? 'bg-primary-dark text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-1.5 rounded-lg transition-all',
              viewMode === 'grid'
                ? 'bg-primary-dark text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Filters bar ─────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          <button
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap',
              categoryFilter === 'all'
                ? 'bg-primary-dark text-white border-primary-dark shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}
          >
            Todos
            <span className="text-[10px] opacity-70">({categoryCounts.all || 0})</span>
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap',
                categoryFilter === cat.value
                  ? 'bg-primary-dark text-white border-primary-dark shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              <span>{cat.emoji}</span>
              {cat.label}
              {(categoryCounts[cat.value] ?? 0) > 0 && (
                <span className="text-[10px] opacity-70">({categoryCounts[cat.value]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map(sf => (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                statusFilter === sf.value
                  ? 'bg-nurei-cta text-gray-900 font-bold'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              )}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Bulk actions bar ────────────────────────────────────── */}
      <AnimatePresence>
        {someSelected && (
          <motion.div
            variants={filterBarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5">
              <CheckSquare className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-bold text-gray-900">
                {selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}
              </span>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkActivate}
                  className="text-success hover:bg-success/10 text-xs h-7"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Activar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkDeactivate}
                  className="text-gray-500 hover:bg-gray-100 text-xs h-7"
                >
                  <X className="w-3 h-3 mr-1" />
                  Desactivar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-error hover:bg-error/10 text-xs h-7"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Eliminar
                </Button>
              </div>
              <span className="flex-1" />
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Limpiar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Results count ───────────────────────────────────────── */}
      {(search || categoryFilter !== 'all' || statusFilter !== 'all') && (
        <p className="text-xs text-gray-400">
          {filteredProducts.length} resultado{filteredProducts.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* ─── Table View ──────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {viewMode === 'table' ? (
          <motion.div
            key="table-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                    <TableHead className="w-10">
                      <button
                        onClick={toggleSelectAll}
                        className={cn(
                          'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                          allVisibleSelected
                            ? 'bg-nurei-cta border-nurei-cta'
                            : 'border-gray-300 hover:border-gray-400'
                        )}
                      >
                        {allVisibleSelected && <Check className="w-3 h-3 text-gray-900" />}
                      </button>
                    </TableHead>
                    <TableHead className="w-12" />
                    <TableHead>
                      <SortHeader field="name">Nombre</SortHeader>
                    </TableHead>
                    <TableHead>
                      <SortHeader field="category">Categoría</SortHeader>
                    </TableHead>
                    <TableHead>
                      <SortHeader field="price">Precio</SortHeader>
                    </TableHead>
                    <TableHead>
                      <SortHeader field="availability_score">Disponibilidad</SortHeader>
                    </TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead>
                      <SortHeader field="is_active">Estado</SortHeader>
                    </TableHead>
                    <TableHead className="w-10 text-center">
                      <Star className="w-3.5 h-3.5 mx-auto text-gray-400" />
                    </TableHead>
                    <TableHead className="w-16 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {filteredProducts.map((product, idx) => (
                      <motion.tr
                        key={product.id}
                        custom={idx}
                        variants={rowVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        layout
                        className={cn(
                          'border-b transition-colors group',
                          selectedIds.has(product.id)
                            ? 'bg-primary-cyan/5'
                            : 'hover:bg-gray-50/80'
                        )}
                      >
                        <TableCell>
                          <button
                            onClick={() => toggleSelect(product.id)}
                            className={cn(
                              'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                              selectedIds.has(product.id)
                                ? 'bg-primary-cyan border-primary-cyan'
                                : 'border-gray-300 hover:border-gray-400'
                            )}
                          >
                            {selectedIds.has(product.id) && <Check className="w-3 h-3 text-primary-dark" />}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
                            {getCategoryEmoji(product.category)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-primary-dark text-sm">{product.name}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{product.slug}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', CATEGORY_COLORS[product.category])}>
                            {getCategoryLabel(product.category)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-sm text-primary-dark">{formatPrice(product.price)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'w-2 h-2 rounded-full',
                              product.availability_score >= 80 ? 'bg-success' :
                              product.availability_score >= 50 ? 'bg-warning' : 'bg-error'
                            )} />
                            <span className="text-sm text-gray-600">{product.availability_score}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            'text-sm font-medium',
                            (product.stock_quantity ?? 0) <= (product.low_stock_threshold ?? 5) ? 'text-red-500' : 'text-gray-600'
                          )}>
                            {product.stock_quantity ?? 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-[11px] font-medium',
                            product.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          )}>
                            {product.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => handleToggleFeatured(product.id)}
                            className="transition-colors hover:scale-110"
                          >
                            {product.is_featured ? (
                              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                            ) : (
                              <StarOff className="w-4 h-4 text-gray-300 hover:text-amber-300" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleOpenEdit(product)}
                              className="text-gray-400 hover:text-primary-cyan"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleOpenDelete(product)}
                              className="text-gray-400 hover:text-error"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>

              {filteredProducts.length === 0 && (
                <div className="py-16 text-center">
                  <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No se encontraron productos</p>
                  <p className="text-xs text-gray-400 mt-1">Intenta cambiar los filtros o la búsqueda</p>
                </div>
              )}
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product, idx) => (
                  <motion.div
                    key={product.id}
                    custom={idx}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                    className={cn(
                      'bg-white rounded-xl border p-4 transition-colors',
                      selectedIds.has(product.id)
                        ? 'border-primary-cyan/40 bg-primary-cyan/5'
                        : 'border-gray-100'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleSelect(product.id)}
                        className={cn(
                          'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mt-0.5 flex-shrink-0',
                          selectedIds.has(product.id)
                            ? 'bg-primary-cyan border-primary-cyan'
                            : 'border-gray-300'
                        )}
                      >
                        {selectedIds.has(product.id) && <Check className="w-3 h-3 text-primary-dark" />}
                      </button>
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                        {getCategoryEmoji(product.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-primary-dark text-sm truncate">{product.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', CATEGORY_COLORS[product.category])}>
                                {getCategoryLabel(product.category)}
                              </span>
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-medium',
                                product.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                              )}>
                                {product.is_active ? 'Activo' : 'Inactivo'}
                              </span>
                              {product.is_featured && (
                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 -mt-1 -mr-1">
                              <MoreHorizontal className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[140px]">
                              <DropdownMenuItem onClick={() => handleOpenEdit(product)}>
                                <Edit2 className="w-3.5 h-3.5" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleFeatured(product.id)}>
                                {product.is_featured ? (
                                  <><StarOff className="w-3.5 h-3.5" /> Quitar destacado</>
                                ) : (
                                  <><Star className="w-3.5 h-3.5" /> Destacar</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => handleOpenDelete(product)}>
                                <Trash2 className="w-3.5 h-3.5" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center justify-between mt-2.5">
                          <span className="font-bold text-primary-dark">{formatPrice(product.price)}</span>
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <span className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              product.availability_score >= 80 ? 'bg-success' :
                              product.availability_score >= 50 ? 'bg-warning' : 'bg-error'
                            )} />
                            {product.availability_score}% disp.
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredProducts.length === 0 && (
                <div className="py-16 text-center">
                  <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No se encontraron productos</p>
                  <p className="text-xs text-gray-400 mt-1">Intenta cambiar los filtros o la búsqueda</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          /* ─── Grid View ─────────────────────────────────────── */
          <motion.div
            key="grid-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4"
          >
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product, idx) => (
                <motion.div
                  key={product.id}
                  custom={idx}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200 transition-all group"
                >
                  {/* Image area */}
                  <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 h-28 sm:h-36 flex items-center justify-center">
                    <span className="text-4xl sm:text-5xl">{getCategoryEmoji(product.category)}</span>
                    {/* Status overlay */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded-md text-[10px] font-medium backdrop-blur-sm',
                        product.is_active
                          ? 'bg-emerald-500/90 text-white'
                          : 'bg-gray-500/90 text-white'
                      )}>
                        {product.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    {product.is_featured && (
                      <div className="absolute top-2 right-2">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400 drop-shadow-sm" />
                      </div>
                    )}
                    {/* Quick edit overlay */}
                    <div className="absolute inset-0 bg-primary-dark/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleOpenEdit(product)}
                        className="bg-white/90 text-primary-dark hover:bg-white rounded-lg"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleOpenDelete(product)}
                        className="bg-white/90 text-error hover:bg-white rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-3 sm:p-4">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', CATEGORY_COLORS[product.category])}>
                      {getCategoryLabel(product.category)}
                    </span>
                    <p className="font-medium text-primary-dark text-sm mt-2 line-clamp-2 leading-tight">
                      {product.name}
                    </p>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="font-bold text-primary-dark">{formatPrice(product.price)}</span>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400">
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          product.availability_score >= 80 ? 'bg-success' :
                          product.availability_score >= 50 ? 'bg-warning' : 'bg-error'
                        )} />
                        {product.availability_score}%
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">No se encontraron productos</p>
                <p className="text-xs text-gray-400 mt-1">Intenta cambiar los filtros o la búsqueda</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Create / Edit Dialog ────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => setEditDialogOpen(open)}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-0">
          {/* Gradient header */}
          <div className="bg-gradient-to-r from-primary-dark to-[#0D3050] px-6 py-5 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-cyan/20 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-primary-cyan" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {editingProduct ? 'Editar producto' : 'Nuevo producto'}
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  {editingProduct ? `Modificando: ${editingProduct.name}` : 'Completa los campos para agregar el producto al catálogo'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Nombre *</label>
              <Input
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="Ej: Ramen Shirakiku Tonkotsu 500g"
                className={cn('h-9', formErrors.name && 'border-error')}
              />
              {formErrors.name && (
                <p className="text-[11px] text-error">{formErrors.name}</p>
              )}
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Slug</label>
              <Input
                value={form.slug}
                onChange={(e) => updateForm({ slug: e.target.value })}
                placeholder="ramen-shirakiku-tonkotsu"
                className="h-9 text-gray-500 font-mono text-xs"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Descripción</label>
              <Textarea
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                placeholder="Descripción opcional del producto..."
                className="min-h-[60px]"
              />
            </div>

            <Separator />

            {/* Category + Subcategory */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Categoría</label>
                <Select value={form.category} onValueChange={(val) => updateForm({ category: val as ProductCategory })}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="mr-1.5">{cat.emoji}</span>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Subcategoría</label>
                <Input
                  value={form.subcategory}
                  onChange={(e) => updateForm({ subcategory: e.target.value })}
                  placeholder="Ej: picante, original, vegano"
                  className="h-9"
                />
              </div>
            </div>

            {/* Spice + Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Nivel de picante (0-5)</label>
                <Input
                  type="number"
                  min="0"
                  max="5"
                  value={form.spice_level}
                  onChange={(e) => updateForm({ spice_level: e.target.value })}
                  placeholder="0"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Peso (g)</label>
                <Input
                  type="number"
                  value={form.weight_g}
                  onChange={(e) => updateForm({ weight_g: e.target.value })}
                  placeholder="100"
                  className="h-9"
                />
              </div>
            </div>

            <Separator />

            {/* Price + Cost */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Precio (MXN) *</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price_pesos}
                    onChange={(e) => updateForm({ price_pesos: e.target.value })}
                    placeholder="210.00"
                    className={cn('h-9 pl-7', formErrors.price_pesos && 'border-error')}
                  />
                </div>
                {form.price_pesos && (
                  <p className="text-[10px] text-gray-400">
                    = {Math.round(parseFloat(form.price_pesos || '0') * 100).toLocaleString()} centavos
                  </p>
                )}
                {formErrors.price_pesos && (
                  <p className="text-[11px] text-error">{formErrors.price_pesos}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Costo estimado (MXN)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.cost_estimate_pesos}
                    onChange={(e) => updateForm({ cost_estimate_pesos: e.target.value })}
                    placeholder="180.00"
                    className="h-9 pl-7"
                  />
                </div>
              </div>
            </div>

            {/* Availability score */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">
                Disponibilidad
                <span className={cn(
                  'ml-2 font-bold',
                  parseInt(form.availability_score) >= 80 ? 'text-success' :
                  parseInt(form.availability_score) >= 50 ? 'text-warning' : 'text-error'
                )}>
                  {form.availability_score || 0}%
                </span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={form.availability_score}
                  onChange={(e) => updateForm({ availability_score: e.target.value })}
                  className="flex-1 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-cyan
                    [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.availability_score}
                  onChange={(e) => updateForm({ availability_score: e.target.value })}
                  className={cn('w-16 h-8 text-center text-sm', formErrors.availability_score && 'border-error')}
                />
              </div>
              {formErrors.availability_score && (
                <p className="text-[11px] text-error">{formErrors.availability_score}</p>
              )}
            </div>

            <Separator />

            {/* Inventory */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inventario</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Stock actual</label>
                  <Input type="number" min="0" value={form.stock_quantity} onChange={(e) => updateForm({ stock_quantity: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Alerta stock bajo</label>
                  <Input type="number" min="0" value={form.low_stock_threshold} onChange={(e) => updateForm({ low_stock_threshold: e.target.value })} className="h-9" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <button type="button" onClick={() => updateForm({ track_inventory: !form.track_inventory })} className={cn('w-10 h-5.5 rounded-full relative transition-colors duration-200', form.track_inventory ? 'bg-primary-cyan' : 'bg-gray-300')}>
                    <span className={cn('absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200', form.track_inventory && 'translate-x-[18px]')} />
                  </button>
                  <span className="text-xs text-gray-600">Control de inventario</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <button type="button" onClick={() => updateForm({ allow_backorder: !form.allow_backorder })} className={cn('w-10 h-5.5 rounded-full relative transition-colors duration-200', form.allow_backorder ? 'bg-amber-400' : 'bg-gray-300')}>
                    <span className={cn('absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200', form.allow_backorder && 'translate-x-[18px]')} />
                  </button>
                  <span className="text-xs text-gray-600">Permitir backorder</span>
                </label>
              </div>
            </div>

            <Separator />

            {/* Toggles */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <button
                  type="button"
                  onClick={() => updateForm({ is_active: !form.is_active })}
                  className={cn(
                    'w-10 h-5.5 rounded-full relative transition-colors duration-200',
                    form.is_active ? 'bg-primary-cyan' : 'bg-gray-300'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200',
                    form.is_active && 'translate-x-[18px]'
                  )} />
                </button>
                <span className="text-sm text-gray-700">Activo</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <button
                  type="button"
                  onClick={() => updateForm({ is_featured: !form.is_featured })}
                  className={cn(
                    'w-10 h-5.5 rounded-full relative transition-colors duration-200',
                    form.is_featured ? 'bg-amber-400' : 'bg-gray-300'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200',
                    form.is_featured && 'translate-x-[18px]'
                  )} />
                </button>
                <span className="text-sm text-gray-700 flex items-center gap-1">
                  Destacado
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                </span>
              </label>
            </div>
          </div>

          <div className="px-6 pb-6 flex justify-end gap-3 border-t pt-5">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="rounded-xl h-10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold rounded-xl h-10 px-6"
            >
              {editingProduct ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ──────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => setDeleteDialogOpen(open)}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-red-600 to-red-700 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-sm font-bold text-white">Eliminar producto</h2>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-600">
              ¿Estás seguro de que deseas eliminar{' '}
              <span className="font-semibold text-primary-dark">{deletingProduct?.name}</span>?
            </p>
            <p className="text-xs text-gray-400">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => { setDeleteDialogOpen(false); setDeletingProduct(null) }}
                className="flex-1 rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                className="flex-1 rounded-xl font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── CSV Import Modal ──────────────────────────── */}
      <Dialog open={showImportModal} onOpenChange={(open) => { if (!open) { setShowImportModal(false); setImportPreview([]) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-5 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Importar productos desde CSV</h2>
                  <p className="text-xs text-white/60 mt-0.5">
                    {importStep === 'mapping'
                      ? `${csvRawRows.length} filas detectadas · Paso 1: Mapear columnas`
                      : `${importPreview.length} productos listos · Paso 2: Validar y confirmar`
                    }
                  </p>
                </div>
              </div>
              {/* Step indicator */}
              <div className="flex items-center gap-1.5">
                <div className={cn('w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center', importStep === 'mapping' ? 'bg-white text-emerald-700' : 'bg-white/30 text-white')}>1</div>
                <div className="w-4 h-0.5 bg-white/30" />
                <div className={cn('w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center', importStep === 'validate' ? 'bg-white text-emerald-700' : 'bg-white/30 text-white')}>2</div>
              </div>
            </div>
          </div>

          <div className="p-6">
            {importStep === 'mapping' ? (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                  Asocia cada columna de tu CSV al campo correspondiente del producto. Las columnas comunes fueron detectadas automáticamente.
                </div>

                {/* Column mapping table */}
                <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  <div className="grid grid-cols-[1fr,auto,1fr] gap-0 bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Columna CSV</span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide text-center px-4">→</span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Campo de producto</span>
                  </div>
                  <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                    {csvRawHeaders.map((header) => (
                      <div key={header} className="grid grid-cols-[1fr,auto,1fr] items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                          <span className="text-sm font-mono text-gray-700 truncate">{header}</span>
                          {csvRawRows[0]?.[header] && (
                            <span className="text-xs text-gray-400 truncate hidden sm:inline">· {csvRawRows[0][header]}</span>
                          )}
                        </div>
                        <span className="text-gray-300 text-sm px-2">→</span>
                        <select
                          value={columnMapping[header] ?? ''}
                          onChange={(e) => setColumnMapping(prev => ({ ...prev, [header]: e.target.value }))}
                          className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"
                        >
                          {PRODUCT_FIELDS.map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:underline">
                    <Download className="w-3 h-3" /> Descargar plantilla CSV
                  </button>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShowImportModal(false)} className="rounded-xl h-9">
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => {
                        const preview = buildPreviewFromMapping()
                        setImportPreview(preview)
                        setImportStep('validate')
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 font-semibold"
                      disabled={!Object.values(columnMapping).some(v => v === 'name')}
                    >
                      Continuar <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Validation summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-emerald-600">{importPreview.filter(p => p.name && (p.price ?? 0) > 0).length}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Listos</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-amber-600">{importPreview.filter(p => p.name && !(p.price ?? 0)).length}</p>
                    <p className="text-xs text-amber-600 mt-0.5">Sin precio</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-red-500">{csvRawRows.length - importPreview.length}</p>
                    <p className="text-xs text-red-500 mt-0.5">Omitidos</p>
                  </div>
                </div>

                {/* Preview table with validation */}
                <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left py-2.5 px-3 text-xs font-bold text-gray-400">Estado</th>
                          <th className="text-left py-2.5 px-3 text-xs font-bold text-gray-400">Nombre</th>
                          <th className="text-left py-2.5 px-3 text-xs font-bold text-gray-400 hidden sm:table-cell">Categoría</th>
                          <th className="text-right py-2.5 px-3 text-xs font-bold text-gray-400">Precio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((p, i) => {
                          const hasName = !!p.name
                          const hasPrice = (p.price ?? 0) > 0
                          const isOk = hasName && hasPrice
                          return (
                            <tr key={i} className={cn('border-b border-gray-50', isOk ? '' : 'bg-amber-50/50')}>
                              <td className="py-2 px-3">
                                {isOk ? (
                                  <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  </span>
                                ) : (
                                  <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center" title={!hasName ? 'Sin nombre' : 'Sin precio'}>
                                    <X className="w-3 h-3 text-amber-500" />
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-medium text-gray-900">{p.name || <span className="text-red-400 italic">sin nombre</span>}</td>
                              <td className="py-2 px-3 text-gray-500 hidden sm:table-cell">{p.category}</td>
                              <td className="py-2 px-3 text-right text-gray-900">{(p.price ?? 0) > 0 ? formatPrice(p.price || 0) : <span className="text-amber-500">—</span>}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button variant="outline" onClick={() => setImportStep('mapping')} className="rounded-xl h-9 text-sm gap-1">
                    ← Ajustar mapeo
                  </Button>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShowImportModal(false)} className="rounded-xl h-9">
                      Cancelar
                    </Button>
                    <Button onClick={confirmImport} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold h-9" disabled={importPreview.length === 0}>
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                      Importar {importPreview.length} productos
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
