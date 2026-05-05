'use client'

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Save, Plus, X, ChevronDown, ChevronUp, Package, ImageIcon,
  DollarSign, Tag, Layers, Settings2, Flame, Copy, Trash2,
  ArrowLeft, ChevronLeft, ChevronRight, Loader2, GripVertical, Check, Sparkles, Search,
  SortDesc, Calendar, Trash, UploadCloud, CheckCircle2, Circle, AlertCircle, Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RichTextEditor } from '@/components/admin/RichTextEditor'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'
import { toast } from 'sonner'
import type { Product, ProductVariant, ProductStatus, UnitOfMeasure } from '@/types'

// ─── Types ──────────────────────────────────────────────────────────────

interface ProductFormData {
  name: string
  slug: string
  description: string
  category: string
  subcategory: string
  sku: string
  brand: string
  origin: string
  origin_country: string
  unit_of_measure: UnitOfMeasure
  spice_level: number
  requires_spice_level: boolean
  weight_g: string
  shipping_weight_g: string
  base_price: string
  compare_at_price: string
  cost_estimate: string
  status: ProductStatus
  campaign: string
  tags: string[]
  images: string[]
  primary_image_index: number
  has_variants: boolean
  dimensions_cm: { length: string; width: string; height: string }
  stock_quantity: string
  low_stock_threshold: string
  track_inventory: boolean
  allow_backorder: boolean
  is_featured: boolean
  is_limited: boolean
  inventory_note: string
  brand_id: string | null
}

interface VariantFormData {
  id?: string
  name: string
  sku_suffix: string
  price: string
  compare_at_price: string
  stock: string
  attributes: Record<string, string>
  image: string
  status: 'active' | 'inactive'
}

interface CategoryOption {
  slug: string
  name: string
  emoji?: string | null
}

interface NavProps {
  prev: { id: string; name: string } | null
  next: { id: string; name: string } | null
  current: number
  total: number
}

interface ProductFormProps {
  initialProduct?: Product
  initialVariants?: ProductVariant[]
  navProps?: NavProps
  draftStorageKey?: string
  onDirtyChange?: (dirty: boolean) => void
  registerSmartSave?: (fn: (() => Promise<void>) | null) => void
}

// ─── Constants ──────────────────────────────────────────────────────────



const UNITS: { value: UnitOfMeasure; label: string }[] = [
  { value: 'ml', label: 'ml' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'L', label: 'L' },
  { value: 'oz', label: 'oz' },
  { value: 'units', label: 'Unidades' },
  { value: 'box', label: 'Caja' },
  { value: 'pack', label: 'Pack' },
]

const ORIGINS = [
  'Japon', 'Corea del Sur', 'China', 'Tailandia', 'Taiwan',
  'Vietnam', 'Indonesia', 'Filipinas', 'Malasia', 'India', 'Mexico',
]

const VARIANT_AXES = ['Sabor', 'Tamano', 'Color', 'Peso', 'Presentacion']

const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Borrador',
  active: 'Activo',
  archived: 'Archivado',
}

const SPICE_CATEGORIES = ['spicy', 'snacks', 'ramen', 'salsas']

// ─── Helpers ────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function generateSku(): string {
  return `PNR-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
}

const emptyForm: ProductFormData = {
  name: '', slug: '', description: '', category: '', subcategory: '',
  sku: '', brand: '', brand_id: null, origin: '', origin_country: '',
  unit_of_measure: 'g', spice_level: 0, requires_spice_level: false,
  weight_g: '', shipping_weight_g: '', base_price: '', compare_at_price: '', cost_estimate: '',
  status: 'active', campaign: '', tags: [], images: [], primary_image_index: 0,
  has_variants: false, dimensions_cm: { length: '', width: '', height: '' },
  stock_quantity: '', low_stock_threshold: '5', track_inventory: true,
  allow_backorder: false, is_featured: false, is_limited: false,
  inventory_note: '',
}

function productToForm(p: Product): ProductFormData {
  return {
    name: p.name, slug: p.slug, description: p.description ?? '',
    category: p.category, subcategory: p.subcategory ?? '',
    sku: p.sku,
    brand: p.brand ?? '',
    brand_id: p.brand_id ?? null,
    origin: p.origin ?? 'Japon',
    origin_country: p.origin_country ?? 'Japon',
    unit_of_measure: p.unit_of_measure ?? 'g',
    spice_level: p.spice_level ?? 0,
    requires_spice_level: p.requires_spice_level ?? false,
    weight_g: (p.weight_g ?? '').toString(),
    shipping_weight_g: (p.shipping_weight_g ?? '').toString(),
    base_price: ((p.base_price ?? p.price ?? 0) / 100).toFixed(2),
    compare_at_price: p.compare_at_price ? (p.compare_at_price / 100).toFixed(2) : '',
    cost_estimate: p.cost_estimate ? (p.cost_estimate / 100).toFixed(2) : '',
    status: p.status ?? 'draft', campaign: p.campaign ?? '',
    tags: p.tags ?? [], images: p.images ?? [],
    primary_image_index: p.primary_image_index ?? 0,
    has_variants: p.has_variants ?? false,
    dimensions_cm: {
      length: p.dimensions_cm?.length?.toString() ?? '',
      width: p.dimensions_cm?.width?.toString() ?? '',
      height: p.dimensions_cm?.height?.toString() ?? '',
    },
    stock_quantity: (p.stock_quantity ?? 0).toString(),
    low_stock_threshold: (p.low_stock_threshold ?? 5).toString(),
    track_inventory: p.track_inventory ?? true,
    allow_backorder: p.allow_backorder ?? false,
    is_featured: p.is_featured ?? false,
    is_limited: p.is_limited ?? false,
    inventory_note: '',
  }
}

function variantToForm(v: ProductVariant): VariantFormData {
  return {
    id: v.id, name: v.name, sku_suffix: v.sku_suffix ?? '',
    price: (v.price / 100).toFixed(2),
    compare_at_price: v.compare_at_price ? (v.compare_at_price / 100).toFixed(2) : '',
    stock: v.stock.toString(), attributes: v.attributes,
    image: v.image ?? '', status: v.status,
  }
}

// ─── Collapsible Section ────────────────────────────────────────────────

function Section({
  title, icon: Icon, children, defaultOpen = true, titleClassName = '', headerRight,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  defaultOpen?: boolean
  titleClassName?: string
  headerRight?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-stretch gap-2 px-4 sm:px-6 py-4 hover:bg-gray-50/50 transition-colors">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 min-w-0 items-center gap-3 text-left"
        >
          <Icon className="w-4 h-4 text-gray-400 shrink-0" />
          <span className={cn('text-sm font-bold text-gray-900 flex-1 min-w-0', titleClassName)}>{title}</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
        </button>
        {headerRight && (
          <div
            className="shrink-0 flex flex-col items-end justify-center gap-1 pl-3 border-l border-gray-100"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {headerRight}
          </div>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Toggle ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn('w-10 h-5.5 rounded-full relative transition-colors duration-200', value ? 'bg-primary-cyan' : 'bg-gray-300')}
      >
        <span className={cn('absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200', value && 'translate-x-[18px]')} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function ProductForm({
  initialProduct, initialVariants, navProps, draftStorageKey, onDirtyChange, registerSmartSave,
}: ProductFormProps) {
  const router = useRouter()
  const isEdit = !!initialProduct

  const [form, setForm] = useState<ProductFormData>(() => {
    if (typeof window !== 'undefined' && draftStorageKey) {
      const saved = sessionStorage.getItem(`nurei-product-draft:${draftStorageKey}`)
      if (saved) return JSON.parse(saved).form
    }
    return initialProduct ? productToForm(initialProduct) : emptyForm
  })
  const [variants, setVariants] = useState<VariantFormData[]>(() => {
    if (typeof window !== 'undefined' && draftStorageKey) {
      const saved = sessionStorage.getItem(`nurei-product-draft:${draftStorageKey}`)
      if (saved) return JSON.parse(saved).variants
    }
    return initialVariants?.map(variantToForm) ?? []
  })

  // Sync to sessionStorage
  useEffect(() => {
    if (!draftStorageKey) return
    sessionStorage.setItem(`nurei-product-draft:${draftStorageKey}`, JSON.stringify({ form, variants }))
  }, [form, variants, draftStorageKey])
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [newAxisName, setNewAxisName] = useState('')
  const [variantAxes, setVariantAxes] = useState<string[]>([])
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false)
  const [media, setMedia] = useState<Array<{ id: string; url: string; filename: string; size_bytes: number; created_at?: string }>>([])
  const [mediaSearch, setMediaSearch] = useState('')
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all')
  const [mediaSort, setMediaSort] = useState('newest')
  const [mediaSelection, setMediaSelection] = useState<string[]>([])
  const [mediaUploading, setMediaUploading] = useState(false)
  const [mediaConvertToWebp, setMediaConvertToWebp] = useState(false)
  const [mediaUrlInput, setMediaUrlInput] = useState('')
  const [mediaUrlImporting, setMediaUrlImporting] = useState(false)
  const [mediaDeleting, setMediaDeleting] = useState<string | null>(null)
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false)
  const [categories, setCategories] = useState<{value: string, label: string, emoji: string, color?: string}[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [brandSuggestions, setBrandSuggestions] = useState<Array<{ id: string; name: string }>>([])
  const [brandSuggestOpen, setBrandSuggestOpen] = useState(false)
  const [brandManageOpen, setBrandManageOpen] = useState(false)
  const [brandList, setBrandList] = useState<Array<{ id: string; name: string }>>([])
  const [brandListLoading, setBrandListLoading] = useState(false)
  const brandDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasLoadedDraftRef = useRef(false)
  const initialSnapshotRef = useRef<string>('')
  const smartSaveRef = useRef<() => Promise<void>>(async () => {})
  const lastDirtyRef = useRef<boolean | null>(null)

  // Removed legacy localStorage load useEffect

  useEffect(() => {
    initialSnapshotRef.current = JSON.stringify({
      form: initialProduct ? productToForm(initialProduct) : emptyForm,
      variants: initialVariants?.map(variantToForm) ?? [],
    })
  }, [initialProduct, initialVariants])

  useEffect(() => {
    const currentSnapshot = JSON.stringify({ form, variants })
    const isDirty = currentSnapshot !== initialSnapshotRef.current
    if (lastDirtyRef.current === isDirty) return
    lastDirtyRef.current = isDirty
    onDirtyChange?.(isDirty)
  }, [form, variants, onDirtyChange])

  useEffect(() => {
    fetchWithCredentials('/api/admin/categories')
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setCategories((json.data as (CategoryOption & { color?: string })[]).map((c) => ({
            value: c.slug,
            label: c.name ? c.name.charAt(0).toUpperCase() + c.name.slice(1) : c.slug,
            emoji: c.emoji || '📦',
            color: c.color ?? undefined,
          })))
        }
      })
      .catch(console.error)
  }, [])

  // Auto-detect spice level requirement based on category
  useEffect(() => {
    if (!form.category) return
    const shouldRequireSpice = SPICE_CATEGORIES.includes(form.category)
    setForm((prev) => {
      if (shouldRequireSpice === prev.requires_spice_level) return prev
      return { ...prev, requires_spice_level: shouldRequireSpice }
    })
  }, [form.category])

  const update = useCallback((updates: Partial<ProductFormData>) => {
    setForm(prev => {
      const next = { ...prev, ...updates }
      if ('name' in updates && (!isEdit || !prev.slug)) {
        next.slug = slugify(updates.name ?? '')
      }
      return next
    })
  }, [isEdit])

  const loadBrandSuggestions = useCallback((q: string) => {
    if (brandDebounceRef.current) clearTimeout(brandDebounceRef.current)
    brandDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchWithCredentials(`/api/brands?q=${encodeURIComponent(q)}&limit=30`)
        const json = await res.json()
        setBrandSuggestions((json.data ?? []) as Array<{ id: string; name: string }>)
      } catch {
        setBrandSuggestions([])
      }
    }, 200)
  }, [])

  const fetchBrandList = useCallback(async () => {
    setBrandListLoading(true)
    try {
      const res = await fetchWithCredentials('/api/brands?limit=200')
      const json = await res.json()
      setBrandList((json.data ?? []) as Array<{ id: string; name: string }>)
    } catch {
      setBrandList([])
    } finally {
      setBrandListLoading(false)
    }
  }, [])

  const createBrandInline = useCallback(async () => {
    const name = form.brand.trim()
    if (!name) {
      toast.error('Escribe un nombre de marca')
      return
    }
    try {
      const res = await fetchWithCredentials('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      update({ brand_id: json.data.id as string, brand: json.data.name as string })
      toast.success('Marca creada y seleccionada')
      setBrandSuggestOpen(false)
      setBrandSuggestions([])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la marca')
    }
  }, [form.brand, update])

  const deleteBrand = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar esta marca? Los productos vinculados quedarán sin marca asignada.')) return
    try {
      const res = await fetchWithCredentials(`/api/brands/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      if (form.brand_id === id) update({ brand_id: null })
      toast.success('Marca eliminada')
      void fetchBrandList()
    } catch {
      toast.error('No se pudo eliminar')
    }
  }, [fetchBrandList, form.brand_id, update])

  useEffect(() => {
    if (brandManageOpen) void fetchBrandList()
  }, [brandManageOpen, fetchBrandList])

  const fetchMedia = useCallback(async () => {
    try {
      const res = await fetchWithCredentials('/api/admin/media')
      const json = await res.json()
      setMedia(json.data ?? [])
    } catch { /* ignore */ }
  }, [])

  const handleMediaUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    setMediaUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        if (mediaConvertToWebp) fd.append('convertToWebp', 'true')
        const res = await fetchWithCredentials('/api/admin/media', { method: 'POST', body: fd })
        const json = await res.json()
        if (json.data) {
          setMedia(prev => [json.data, ...prev])
          toast.success(`${file.name} subida`)
        } else {
          toast.error(json.error ?? 'Error al subir imagen')
        }
      }
    } catch {
      toast.error('Error al subir archivos')
    } finally {
      setMediaUploading(false)
    }
  }, [])

  const handleMediaFromUrl = useCallback(async (url: string) => {
    if (!url.trim()) return
    setMediaUrlImporting(true)
    try {
      const res = await fetchWithCredentials('/api/admin/media/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const json = await res.json()
      if (json.data) {
        setMedia(prev => [json.data, ...prev])
        setMediaUrlInput('')
        toast.success('Imagen importada como WebP')
      } else {
        toast.error(json.error ?? 'Error al importar imagen')
      }
    } catch {
      toast.error('Error al importar desde URL')
    } finally {
      setMediaUrlImporting(false)
    }
  }, [])

  const handleMediaDelete = useCallback(async (items: Array<{ id: string; url: string }>) => {
    if (!items.length) return
    if (!confirm(`¿Eliminar ${items.length} imagen(es) permanentemente de la galería?`)) return
    
    setIsDeletingMultiple(items.length > 1)
    if (items.length === 1) setMediaDeleting(items[0].id)

    try {
      const res = await fetchWithCredentials('/api/admin/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items.length === 1 ? { id: items[0].id, url: items[0].url } : { items }),
      })
      if (res.ok) {
        const itemIds = new Set(items.map(i => i.id))
        const itemUrls = new Set(items.map(i => i.url))
        setMedia(prev => prev.filter(m => !itemIds.has(m.id)))
        update({ images: form.images.filter(img => !itemUrls.has(img)) })
        toast.success(items.length === 1 ? 'Imagen eliminada' : `${items.length} imágenes eliminadas`)
      } else {
        toast.error('Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar imagen')
    } finally {
      setMediaDeleting(null)
    }
  }, [form.images, update])

  // ─── Save ───────────────────────────────────────────────────────

  const handleSave = async (addAnother = false, statusOverride?: ProductStatus) => {
    const statusToSave = statusOverride ?? form.status
    const saveAsDraft = statusToSave === 'draft'

    // Validation for publish flow only.
    const errors: string[] = []
    const nextFieldErrors: Record<string, string> = {}
    if (!saveAsDraft) {
      if (!form.name.trim()) errors.push('Nombre del producto')
      if (!form.category) errors.push('Categoría')
      if (!form.base_price || parseFloat(form.base_price) <= 0) errors.push('Precio válido (mayor a $0)')
      if (!form.images.length) errors.push('Al menos una imagen')
      if (form.track_inventory) {
        const stockRaw = form.stock_quantity.trim()
        if (!stockRaw) {
          errors.push('Stock')
          nextFieldErrors.stock_quantity = 'El stock es obligatorio con inventario activo'
        } else {
          const n = parseInt(stockRaw, 10)
          if (Number.isNaN(n) || n < 0) {
            errors.push('Stock válido')
            nextFieldErrors.stock_quantity = 'Indica un número mayor o igual a 0'
          }
        }
      }
      if (!isEdit && !form.unit_of_measure) {
        errors.push('Unidad de medida')
        nextFieldErrors.unit_of_measure = 'Selecciona una unidad de medida'
      }
      if (!isEdit && !form.weight_g.trim()) {
        errors.push('Cantidad por unidad')
        nextFieldErrors.weight_g = 'La cantidad por unidad es obligatoria'
      }

      if (errors.length > 0) {
        setFieldErrors(nextFieldErrors)
        toast.error(`Datos faltantes:\n${errors.map(e => `• ${e}`).join('\n')}`)
        return
      }
      setFieldErrors({})
    } else {
      setFieldErrors({})
    }

    const hasNamedVariant = variants.some((v) => v.name.trim().length > 0)
    const effectiveHasVariants = form.has_variants && hasNamedVariant
    if (form.has_variants && !hasNamedVariant) {
      toast.info('Variantes desactivadas: agrega al menos una variante con nombre.', { duration: 4500 })
    }

    const stockQtyParsed = form.track_inventory
      ? parseInt(form.stock_quantity.trim(), 10)
      : (form.stock_quantity.trim() === '' ? 0 : parseInt(form.stock_quantity, 10) || 0)
    const safeStockQty = Number.isFinite(stockQtyParsed) ? stockQtyParsed : 0
    const publishableName = form.name.trim() || 'Borrador sin nombre'
    const slugSeed = form.slug.trim() || (saveAsDraft ? `borrador-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : publishableName)
    const basePriceValue = parseFloat(form.base_price)
    const basePriceParsed = Number.isFinite(basePriceValue) ? Math.round(basePriceValue * 100) : 0
    const weightParsed = form.weight_g.trim() ? parseInt(form.weight_g, 10) || 0 : 0
    const compareAtValue = parseFloat(form.compare_at_price)
    const compareAtParsed = form.compare_at_price && Number.isFinite(compareAtValue) ? Math.round(compareAtValue * 100) : null
    const costEstimateValue = parseFloat(form.cost_estimate)
    const costEstimateParsed = form.cost_estimate && Number.isFinite(costEstimateValue) ? Math.round(costEstimateValue * 100) : null

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: publishableName,
        slug: slugify(slugSeed),
        description: form.description || null,
        category: form.category || 'crunchy',
        subcategory: form.subcategory || null,
        sku: form.sku || generateSku(),
        brand_id: form.brand_id,
        brand: form.brand?.trim() || null,
        origin: form.origin || 'Japon',
        origin_country: form.origin_country || form.origin || 'Japon',
        unit_of_measure: form.unit_of_measure,
        spice_level: form.spice_level,
        requires_spice_level: form.requires_spice_level,
        weight_g: weightParsed,
        shipping_weight_g: form.shipping_weight_g ? parseInt(form.shipping_weight_g, 10) || 0 : null,
        base_price: basePriceParsed,
        price: basePriceParsed,
        compare_at_price: compareAtParsed,
        cost_estimate: costEstimateParsed,
        status: statusToSave,
        campaign: form.campaign || null,
        tags: form.tags,
        images: form.images,
        primary_image_index: form.primary_image_index,
        has_variants: effectiveHasVariants,
        dimensions_cm: (form.dimensions_cm.length || form.dimensions_cm.width || form.dimensions_cm.height)
          ? {
              length: parseFloat(form.dimensions_cm.length) || null,
              width: parseFloat(form.dimensions_cm.width) || null,
              height: parseFloat(form.dimensions_cm.height) || null,
            }
          : null,
        stock_quantity: safeStockQty,
        low_stock_threshold: parseInt(form.low_stock_threshold, 10) || 5,
        track_inventory: form.track_inventory,
        allow_backorder: form.allow_backorder,
        is_featured: form.is_featured,
        is_limited: form.is_limited,
        availability_score: 100,
        inventory_note: form.inventory_note.trim() || undefined,
      }

      let productId: string

      if (isEdit && initialProduct) {
        const res = await fetchWithCredentials(`/api/products/${initialProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        productId = initialProduct.id
      } else {
        const res = await fetchWithCredentials('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        productId = json.data.id
      }

      // Save variants — solo filas con nombre; vaciar en servidor si se desactiva el modo
      if (effectiveHasVariants) {
        const variantData = variants
          .filter((v) => v.name.trim().length > 0)
          .map(v => ({
            ...(v.id ? { id: v.id } : {}),
            name: v.name.trim(),
            sku_suffix: v.sku_suffix || null,
            price: Math.round(parseFloat(v.price || '0') * 100),
            compare_at_price: v.compare_at_price ? Math.round(parseFloat(v.compare_at_price) * 100) : null,
            stock: parseInt(v.stock, 10) || 0,
            attributes: v.attributes,
            image: v.image || null,
            status: v.status,
          }))

        await fetchWithCredentials(`/api/products/${productId}/variants`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variants: variantData }),
        })
      } else if (isEdit) {
        await fetchWithCredentials(`/api/products/${productId}/variants`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variants: [] }),
        })
      }

      toast.success(isEdit ? 'Producto actualizado' : 'Producto creado')
      if (isEdit) update({ status: statusToSave, has_variants: effectiveHasVariants })
      else if (!effectiveHasVariants) update({ has_variants: false })

      if (addAnother) {
        setForm(emptyForm)
        setFieldErrors({})
        setVariants([])
        if (draftStorageKey) {
          try { sessionStorage.removeItem(`nurei-product-draft:${draftStorageKey}`) } catch {}
        }
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        if (draftStorageKey) {
          try { sessionStorage.removeItem(`nurei-product-draft:${draftStorageKey}`) } catch {}
        }
        router.push('/admin/productos')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const isReadyForActiveSave = useCallback(() => {
    if (!form.name.trim()) return false
    if (!form.category) return false
    if (!form.base_price || parseFloat(form.base_price) <= 0) return false
    if (!form.images.length) return false
    if (form.track_inventory) {
      const stockRaw = form.stock_quantity.trim()
      if (!stockRaw) return false
      const n = parseInt(stockRaw, 10)
      if (Number.isNaN(n) || n < 0) return false
    }
    if (!isEdit && !form.unit_of_measure) return false
    if (!isEdit && !form.weight_g.trim()) return false
    return true
  }, [form, isEdit])

  useEffect(() => {
    smartSaveRef.current = async () => {
      const targetStatus: ProductStatus = isReadyForActiveSave() ? 'active' : 'draft'
      await handleSave(false, targetStatus)
    }
  }, [isReadyForActiveSave, handleSave])

  useEffect(() => {
    if (!registerSmartSave) return
    registerSmartSave(() => smartSaveRef.current())
    return () => registerSmartSave(null)
  }, [registerSmartSave])

  // ─── Variant helpers ────────────────────────────────────────────

  const addVariant = () => {
    setVariants(prev => [...prev, {
      name: '', sku_suffix: '', price: form.base_price, compare_at_price: '',
      stock: '0', attributes: {}, image: '', status: 'active',
    }])
  }

  const updateVariant = (idx: number, updates: Partial<VariantFormData>) => {
    setVariants(prev => prev.map((v, i) => i === idx ? { ...v, ...updates } : v))
  }

  const removeVariant = (idx: number) => {
    setVariants(prev => prev.filter((_, i) => i !== idx))
  }

  // ─── Tag helpers ────────────────────────────────────────────────

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !form.tags.includes(tag)) {
      update({ tags: [...form.tags, tag] })
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    update({ tags: form.tags.filter(t => t !== tag) })
  }

  // ─── Discount calculation ───────────────────────────────────────

  const discountPercent = form.compare_at_price && form.base_price
    ? Math.round((1 - parseFloat(form.base_price) / parseFloat(form.compare_at_price)) * 100)
    : 0

  const totalVariantStock = variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)
  const showDraftAction = true

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto">
      {isEdit && (
        <div className="sticky top-0 z-30 bg-gray-50/95 backdrop-blur-md -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-gray-200/50 mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/admin/productos')}
                className="rounded-xl text-gray-400 hover:text-gray-600 shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              {navProps && navProps.total > 1 && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => navProps.prev && router.push(`/admin/productos/${navProps.prev.id}/edit`)}
                    disabled={!navProps.prev}
                    title={navProps.prev?.name}
                    className="h-7 w-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-gray-400 tabular-nums font-mono">{navProps.current}/{navProps.total}</span>
                  <button
                    type="button"
                    onClick={() => navProps.next && router.push(`/admin/productos/${navProps.next.id}/edit`)}
                    disabled={!navProps.next}
                    title={navProps.next?.name}
                    className="h-7 w-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-base font-bold text-gray-900 truncate">
                  {form.name || 'Editar producto'}
                </h1>
              </div>
            </div>
            {initialProduct?.created_at && (
              <div className="hidden sm:flex flex-col items-end gap-0 text-right">
                <span className="text-[10px] text-gray-400 leading-none">
                  Creado {new Date(initialProduct.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {initialProduct.updated_at && initialProduct.updated_at !== initialProduct.created_at && (
                  <span className="text-[10px] text-gray-300 leading-none mt-0.5">
                    Editado {new Date(initialProduct.updated_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6">
        {/* Left column — main content */}
        <div className="space-y-5">
          {/* 1. Basic info */}
          <Section
            title="Información básica"
            icon={Package}
            headerRight={(
              isEdit ? (
                <>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Estado</span>
                  <Select value={form.status} onValueChange={(v) => update({ status: v as ProductStatus })}>
                    <SelectTrigger className="h-9 min-w-[148px] rounded-full border-gray-200 bg-gray-50 text-xs font-bold shadow-sm">
                      <SelectValue>{PRODUCT_STATUS_LABELS[form.status]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="draft">Borrador</SelectItem>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="archived">Archivado</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Estado</span>
                  <Badge variant="secondary" className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-100">
                    Activo por defecto
                  </Badge>
                </div>
              )
            )}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Nombre *</label>
                <Input
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Ej: Ramen Shirakiku Tonkotsu 500g"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Slug</label>
                <Input
                  value={form.slug}
                  onChange={(e) => update({ slug: e.target.value })}
                  placeholder="auto-generado"
                  className="h-10 font-mono text-xs text-gray-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">SKU</label>
                <div className="flex gap-2">
                  <Input
                    value={form.sku}
                    onChange={(e) => update({ sku: e.target.value })}
                    placeholder="PNR-XXXX"
                    className="h-10 font-mono text-xs flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => update({ sku: generateSku() })}
                    className="h-10 px-3 rounded-xl text-xs"
                    title="Auto-generar"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="sm:col-span-2 space-y-1.5 relative">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-gray-500">Marca</label>
                  <button
                    type="button"
                    onClick={() => setBrandManageOpen(true)}
                    className="text-[11px] font-bold text-primary-cyan hover:underline flex items-center gap-1"
                  >
                    <Settings className="w-3 h-3" /> Gestionar marcas
                  </button>
                </div>
                <Input
                  value={form.brand}
                  onChange={(e) => {
                    update({ brand: e.target.value, brand_id: null })
                    loadBrandSuggestions(e.target.value)
                    setBrandSuggestOpen(true)
                  }}
                  onFocus={() => {
                    loadBrandSuggestions(form.brand)
                    setBrandSuggestOpen(true)
                  }}
                  onBlur={() => {
                    setTimeout(() => setBrandSuggestOpen(false), 180)
                  }}
                  placeholder="Buscar o escribir marca…"
                  className="h-10"
                  autoComplete="off"
                />
                {brandSuggestOpen && (brandSuggestions.length > 0 || (form.brand.trim().length > 0 && !brandSuggestions.some((b) => b.name.toLowerCase() === form.brand.trim().toLowerCase()))) && (
                  <div className="absolute z-40 left-0 right-0 top-full mt-1 rounded-xl border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                    {brandSuggestions.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          update({ brand_id: b.id, brand: b.name })
                          setBrandSuggestOpen(false)
                        }}
                      >
                        {b.name}
                      </button>
                    ))}
                    {form.brand.trim().length > 0
                      && !brandSuggestions.some((b) => b.name.toLowerCase() === form.brand.trim().toLowerCase()) && (
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm font-bold text-primary-cyan hover:bg-gray-50 border-t border-gray-100"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void createBrandInline()}
                      >
                        + Crear &apos;{form.brand.trim()}&apos;
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Unidad de medida {!isEdit && '*'}</label>
                <div className="flex gap-2 items-center">
                  <Select value={form.unit_of_measure || undefined} onValueChange={(v) => { if (v) update({ unit_of_measure: v as UnitOfMeasure }) }}>
                    <SelectTrigger className="h-10 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg whitespace-nowrap">
                    {form.weight_g || '—'} {form.unit_of_measure}
                  </div>
                </div>
                {fieldErrors.unit_of_measure && (
                  <p className="text-[11px] font-medium text-red-500">{fieldErrors.unit_of_measure}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Cantidad por unidad ({form.unit_of_measure}) {!isEdit && '*'}</label>
                <Input
                  type="number"
                  value={form.weight_g}
                  onChange={(e) => update({ weight_g: e.target.value })}
                  placeholder="Ej: 150"
                  className="h-10"
                />
                {fieldErrors.weight_g && (
                  <p className="text-[11px] font-medium text-red-500">{fieldErrors.weight_g}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Pais de origen</label>
                <Select value={(form.origin_country || form.origin || '') || undefined} onValueChange={(v) => { if (v) update({ origin_country: v, origin: v }) }}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORIGINS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Descripcion</label>
                <RichTextEditor
                  value={form.description}
                  onChange={(html) => update({ description: html })}
                  placeholder="Descripcion del producto..."
                  minHeight="100px"
                />
              </div>

              {/* Precios (Merged) */}
              <div className="sm:col-span-2 pt-2 border-t border-gray-100 mt-4">
                <h4 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-4">Precios &amp; Descuentos</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Precio venta (MXN) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                      <Input
                        type="number" step="0.01"
                        value={form.base_price}
                        onChange={(e) => update({ base_price: e.target.value })}
                        placeholder="0.00"
                        className="h-10 pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">
                      Precio original
                      {discountPercent > 0 && (
                        <span className="ml-2 text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
                          -{discountPercent}%
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                      <Input
                        type="number" step="0.01"
                        value={form.compare_at_price}
                        onChange={(e) => update({ compare_at_price: e.target.value })}
                        placeholder="0.00"
                        className="h-10 pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Costo estimado</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                      <Input
                        type="number" step="0.01"
                        value={form.cost_estimate}
                        onChange={(e) => update({ cost_estimate: e.target.value })}
                        placeholder="0.00"
                        className="h-10 pl-7"
                      />
                    </div>
                  </div>
                </div>
                
                {discountPercent > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 flex items-center gap-3 mt-4">
                    <span className="text-2xl font-black text-red-500">-{discountPercent}%</span>
                    <div>
                      <p className="text-xs font-bold text-red-700">Descuento activo</p>
                      <p className="text-[10px] text-red-500">
                        El cliente vera ${form.compare_at_price} tachado y ${form.base_price} como precio actual
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Organizacion (Merged) */}
              <div className="sm:col-span-2 pt-2 border-t border-gray-100 mt-4">
                <h4 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-4">Clasificación &amp; Organización</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Categoria</label>
                    <Select value={form.category ? form.category : undefined} onValueChange={(v) => { if (v) update({ category: v }) }}>
                      <SelectTrigger className="h-11 w-full text-sm">
                        <SelectValue placeholder="Escoger categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.value} value={c.value}>
                            <span className="flex items-center gap-1.5">
                              {c.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />}
                              <span>{c.emoji}</span>
                              <span>{c.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Subcategoria</label>
                    <Input
                      value={form.subcategory}
                      onChange={(e) => update({ subcategory: e.target.value })}
                      placeholder="Ej: ramen, galletas"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Campaña</label>
                    <Input
                      value={form.campaign}
                      onChange={(e) => update({ campaign: e.target.value })}
                      placeholder="Ej: Verano 2026"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Tags</label>
                    <div className="flex gap-2">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                        placeholder="Agregar tag..."
                        className="h-10 flex-1"
                      />
                      <Button type="button" variant="outline" onClick={addTag} className="h-10 px-3 rounded-xl">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {form.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)}>
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </Section>

          {/* 2. Variantes — justo después de información básica */}
          <Section title="Variantes" icon={Layers} defaultOpen>
            <div className="space-y-4">
              <Toggle
                value={form.has_variants}
                onChange={(v) => update({ has_variants: v })}
                label="Este producto tiene variantes (sabor, tamaño, etc.)"
              />
              {form.has_variants && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl">
                  El precio base se usará como referencia. Cada variante puede tener su propio precio. Si no agregas ninguna variante con nombre, el modo variantes se desactivará al guardar.
                </p>
              )}
              {form.has_variants && (
                <div className="space-y-4">
                  {variants.map((variant, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl p-4 space-y-3 relative">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-gray-300" />
                          <span className="text-xs font-bold text-gray-500">Variante {idx + 1}</span>
                        </div>
                        <button type="button" onClick={() => removeVariant(idx)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-bold">Nombre *</label>
                          <Input
                            value={variant.name}
                            onChange={(e) => updateVariant(idx, { name: e.target.value })}
                            placeholder="Ej: Fresa, 500ml, Picante"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-bold">Precio</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                            <Input
                              type="number" step="0.01"
                              value={variant.price}
                              onChange={(e) => updateVariant(idx, { price: e.target.value })}
                              className="h-9 pl-6 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-bold">Stock</label>
                          <Input
                            type="number"
                            value={variant.stock}
                            onChange={(e) => updateVariant(idx, { stock: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-bold">SKU suffix</label>
                          <Input
                            value={variant.sku_suffix}
                            onChange={(e) => updateVariant(idx, { sku_suffix: e.target.value })}
                            placeholder="-FR"
                            className="h-9 text-sm font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-bold">Precio original</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                            <Input
                              type="number" step="0.01"
                              value={variant.compare_at_price}
                              onChange={(e) => updateVariant(idx, { compare_at_price: e.target.value })}
                              className="h-9 pl-6 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addVariant}
                    className="w-full rounded-xl h-10 border-dashed border-2 text-xs font-bold"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Agregar variante
                  </Button>
                </div>
              )}
            </div>
          </Section>

          {/* 3. Images */}
          <Section title="Galería de imágenes" icon={ImageIcon} titleClassName="text-nurei-cta" defaultOpen>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-gray-400">Arrastra para reordenar. Primera imagen = portada.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { fetchMedia(); setMediaDialogOpen(true) }}
                  className="rounded-xl h-8 text-xs font-bold gap-1.5 border-dashed border-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar fotos
                </Button>
              </div>

              {form.images.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {form.images.map((img, idx) => {
                    const isPrimary = form.primary_image_index === idx
                    return (
                      <div
                        key={`${img}-${idx}`}
                        className={cn(
                          'group relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer',
                          isPrimary ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-gray-100 hover:border-gray-200'
                        )}
                        onClick={() => update({ primary_image_index: idx })}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        {isPrimary && (
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-amber-400 text-[9px] font-black text-white rounded-md uppercase">
                            Portada
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const next = form.images.filter((_, i) => i !== idx)
                            update({
                              images: next,
                              primary_image_index: form.primary_image_index >= next.length
                                ? Math.max(0, next.length - 1) : form.primary_image_index,
                            })
                          }}
                          className="absolute top-1 right-1 p-1 bg-black/50 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div
                  onClick={() => { fetchMedia(); setMediaDialogOpen(true) }}
                  className="border-2 border-dashed border-gray-200 rounded-xl py-10 flex flex-col items-center cursor-pointer hover:bg-gray-50/50 transition-colors"
                >
                  <ImageIcon className="w-8 h-8 text-gray-200 mb-2" />
                  <p className="text-xs text-gray-400">Haz clic para seleccionar fotos</p>
                </div>
              )}
            </div>
          </Section>

          {/* 5. Optional Attributes */}
          <Section title="Atributos opcionales" icon={Settings2} defaultOpen>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-8 rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50/80 to-white p-4">
                <Toggle value={form.is_featured} onChange={(v) => update({ is_featured: v })} label="Destacado (Popular)" />
                <Toggle value={form.is_limited} onChange={(v) => update({ is_limited: v })} label="Edición limitada" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Peso para envío (g) (opcional)</label>
                <Input
                  type="number"
                  value={form.shipping_weight_g}
                  onChange={(e) => update({ shipping_weight_g: e.target.value })}
                  placeholder="0"
                  className="h-10"
                />
              </div>

              {/* Spice level — only if relevant category */}
              {form.requires_spice_level && (
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-red-500" />
                    Nivel de picante
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4, 5].map(level => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => update({ spice_level: level })}
                          className={cn(
                            'w-9 h-9 rounded-lg text-sm font-bold transition-all',
                            form.spice_level >= level
                              ? level === 0 ? 'bg-gray-200 text-gray-600' : 'bg-red-500 text-white'
                              : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                          )}
                        >
                          {level === 0 ? '0' : '🌶️'}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-gray-500">
                      {['Sin picante', 'Suave', 'Medio', 'Intenso', 'Muy Intenso', 'Extremo'][form.spice_level]}
                    </span>
                  </div>
                </div>
              )}

              {/* Dimensions */}
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-500 mb-2 block">Dimensiones (cm) - opcional</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Input
                      type="number" step="0.1"
                      value={form.dimensions_cm.length}
                      onChange={(e) => update({ dimensions_cm: { ...form.dimensions_cm, length: e.target.value } })}
                      placeholder="Largo"
                      className="h-9 text-xs"
                    />
                    <p className="text-[10px] text-gray-400 mt-1 text-center">Largo</p>
                  </div>
                  <div>
                    <Input
                      type="number" step="0.1"
                      value={form.dimensions_cm.width}
                      onChange={(e) => update({ dimensions_cm: { ...form.dimensions_cm, width: e.target.value } })}
                      placeholder="Ancho"
                      className="h-9 text-xs"
                    />
                    <p className="text-[10px] text-gray-400 mt-1 text-center">Ancho</p>
                  </div>
                  <div>
                    <Input
                      type="number" step="0.1"
                      value={form.dimensions_cm.height}
                      onChange={(e) => update({ dimensions_cm: { ...form.dimensions_cm, height: e.target.value } })}
                      placeholder="Alto"
                      className="h-9 text-xs"
                    />
                    <p className="text-[10px] text-gray-400 mt-1 text-center">Alto</p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Inventario */}
          <Section title="Inventario" icon={Package} defaultOpen>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {form.track_inventory && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500">{isEdit ? 'Stock actual' : 'Stock inicial'} {form.track_inventory ? '*' : ''}</label>
                  <Input
                    type="number" min="0"
                    value={form.stock_quantity}
                    onChange={(e) => update({ stock_quantity: e.target.value })}
                    placeholder={form.track_inventory ? 'Obligatorio' : ''}
                    className="h-10"
                    disabled={form.has_variants}
                  />
                  {form.has_variants && (
                    <p className="text-[10px] text-gray-400">Stock manejado por variantes ({totalVariantStock} total)</p>
                  )}
                  {form.track_inventory && fieldErrors.stock_quantity && (
                    <p className="text-[11px] font-medium text-red-500">{fieldErrors.stock_quantity}</p>
                  )}
                </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500">Alerta stock bajo</label>
                  <Input
                    type="number" min="0"
                    value={form.low_stock_threshold}
                    onChange={(e) => update({ low_stock_threshold: e.target.value })}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Toggle value={form.track_inventory} onChange={(v) => update({ track_inventory: v })} label="Control de inventario" />
                <Toggle value={form.allow_backorder} onChange={(v) => update({ allow_backorder: v })} label="Permitir backorder" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Nota de ajuste (trazabilidad)</label>
                <Input
                  value={form.inventory_note}
                  onChange={(e) => update({ inventory_note: e.target.value })}
                  placeholder="Ej: Conteo físico, recepción de proveedor, merma..."
                  className="h-10"
                />
              </div>
            </div>
          </Section>
        </div>

        {/* Right column — sticky panel */}
        <div className="space-y-5">
          <div className="lg:sticky lg:top-20 space-y-5">
            {/* Summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resumen</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Estado</span>
                  <span className="font-medium text-gray-700">{PRODUCT_STATUS_LABELS[form.status]}</span>
                </div>
                {form.category && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Categoria</span>
                    <span className="font-medium text-gray-700">
                      {categories.find(c => c.value === form.category)?.emoji} {categories.find(c => c.value === form.category)?.label ?? form.category}
                    </span>
                  </div>
                )}
                {form.base_price && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Precio</span>
                    <span className="font-bold text-gray-900">${form.base_price}</span>
                  </div>
                )}
                {discountPercent > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Descuento</span>
                    <span className="font-bold text-red-500">-{discountPercent}%</span>
                  </div>
                )}
                {form.has_variants && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Variantes</span>
                    <span className="font-medium text-gray-700">{variants.length}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Stock</span>
                  <span className="font-medium text-gray-700">
                    {form.has_variants ? totalVariantStock : form.stock_quantity || 0}
                  </span>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex justify-between items-start">
                    <span className="text-gray-400">Tags</span>
                    <span className="text-right font-medium text-gray-700 text-xs">{form.tags.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                {showDraftAction && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleSave(false, 'draft')}
                    disabled={saving}
                    className="rounded-xl h-11 text-xs font-bold min-w-[180px]"
                  >
                    Guardar borrador
                  </Button>
                )}
                <Button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="bg-primary-dark text-white hover:bg-black font-bold rounded-xl h-11 shadow-md min-w-[220px]"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {isEdit ? 'Guardar' : 'Guardar y activar'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/productos')}
                  className="rounded-xl h-11 font-bold text-gray-500 min-w-[160px]"
                >
                  Volver
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Media selection dialog */}
      <AnimatePresence>
        {mediaDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMediaDialogOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100"
            >
              {/* Header */}
              <div className="px-8 py-5 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-cyan/10 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-primary-cyan" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-lg">Biblioteca Multimedia</h3>
                    <p className="text-xs text-gray-400 font-medium">Gestiona y selecciona las fotos de tus productos</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-gray-50 text-gray-500 border-none font-bold py-1 px-3">
                    {media.length} archivos
                  </Badge>
                  <button
                    onClick={() => setMediaDialogOpen(false)}
                    className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Toolbar: Search & Filters */}
              <div className="px-8 py-4 bg-gray-50/50 border-b border-gray-100 flex flex-wrap gap-3 items-center flex-shrink-0">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    value={mediaSearch}
                    onChange={(e) => setMediaSearch(e.target.value)}
                    placeholder="Buscar por nombre de archivo..."
                    className="pl-10 h-10 rounded-xl border-gray-200 focus:ring-primary-cyan/20 focus:border-primary-cyan bg-white text-sm"
                  />
                </div>

                <div className="flex gap-2 items-center">
                  <Select value={mediaSort} onValueChange={(v) => setMediaSort(v || '')}>
                    <SelectTrigger className="h-10 w-44 rounded-xl border-gray-200 bg-white text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <SortDesc className="w-3.5 h-3.5 text-gray-400" />
                        <SelectValue placeholder="Ordenar por" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="newest">Más recientes</SelectItem>
                      <SelectItem value="oldest">Más antiguos</SelectItem>
                      <SelectItem value="largest">Más grandes (KB)</SelectItem>
                      <SelectItem value="smallest">Más pequeños (KB)</SelectItem>
                      <SelectItem value="az">Nombre (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={mediaTypeFilter} onValueChange={(v) => setMediaTypeFilter(v || '')}>
                    <SelectTrigger className="h-10 w-32 rounded-xl border-gray-200 bg-white text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-gray-400" />
                        <SelectValue placeholder="Tipo" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="jpg">JPG</SelectItem>
                      <SelectItem value="png">PNG</SelectItem>
                      <SelectItem value="webp">WebP</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="h-10 w-px bg-gray-200 mx-1" />

                  {/* WebP toggle */}
                  <button
                    type="button"
                    onClick={() => setMediaConvertToWebp((v) => !v)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 h-10 rounded-xl text-xs font-bold border transition-all',
                      mediaConvertToWebp
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                    )}
                    title="Convertir a WebP al subir"
                  >
                    <span className={cn('w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors',
                      mediaConvertToWebp ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                    )}>
                      {mediaConvertToWebp && <Check className="w-2 h-2 text-white" />}
                    </span>
                    WebP
                  </button>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleMediaUpload(e.target.files)}
                    />
                    <div className={cn(
                      "flex items-center gap-2 px-4 h-10 rounded-xl font-bold text-xs transition-all shadow-sm",
                      mediaUploading ? "bg-gray-100 text-gray-400" : "bg-primary-cyan text-white hover:bg-cyan-600"
                    )}>
                      {mediaUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                      Subir fotos
                    </div>
                  </label>
                </div>

                {/* URL import */}
                <div className="flex gap-2 px-2 pb-2">
                  <Input
                    value={mediaUrlInput}
                    onChange={(e) => setMediaUrlInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleMediaFromUrl(mediaUrlInput) } }}
                    placeholder="Pega URL de imagen para importar como WebP…"
                    className="h-9 text-xs rounded-xl border-gray-200 flex-1"
                    disabled={mediaUrlImporting}
                  />
                  <button
                    type="button"
                    onClick={() => void handleMediaFromUrl(mediaUrlInput)}
                    disabled={!mediaUrlInput.trim() || mediaUrlImporting}
                    className="h-9 px-4 rounded-xl bg-primary-dark text-white text-xs font-bold hover:bg-black transition disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                  >
                    {mediaUrlImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                    Importar
                  </button>
                </div>
              </div>

              {/* Selection Bar (Contextual) */}
              <AnimatePresence>
                {mediaSelection.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-primary-dark px-8 py-3 flex items-center justify-between flex-shrink-0"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-white text-xs font-black">
                        {mediaSelection.length} {mediaSelection.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const newImages = [...form.images]
                            const selectedUrls = media.filter(m => mediaSelection.includes(m.id)).map(m => m.url)
                            selectedUrls.forEach(url => {
                              if (!newImages.includes(url)) newImages.push(url)
                            })
                            update({ images: newImages })
                            setMediaSelection([])
                            toast.success(`${selectedUrls.length} fotos añadidas al producto`)
                          }}
                          className="h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] uppercase tracking-wider font-black border-none"
                        >
                          Añadir al producto
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setMediaSelection([])}
                          className="h-8 rounded-lg text-white/60 hover:text-white text-[10px] uppercase tracking-wider font-black border-none"
                        >
                          Deseleccionar
                        </Button>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleMediaDelete(media.filter(m => mediaSelection.includes(m.id)))}
                      disabled={isDeletingMultiple}
                      className="h-8 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] uppercase tracking-wider font-black border-none"
                    >
                      {isDeletingMultiple ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Trash className="w-3 h-3 mr-2" />}
                      Eliminar de la galería
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Media Grid */}
              <div className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {media
                    .filter(item => {
                      const matchesSearch = item.filename.toLowerCase().includes(mediaSearch.toLowerCase())
                      const matchesType = mediaTypeFilter === 'all' || item.filename.toLowerCase().endsWith(mediaTypeFilter)
                      return matchesSearch && matchesType
                    })
                    .sort((a, b) => {
                      if (mediaSort === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
                      if (mediaSort === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
                      if (mediaSort === 'largest') return (b.size_bytes || 0) - (a.size_bytes || 0)
                      if (mediaSort === 'smallest') return (a.size_bytes || 0) - (b.size_bytes || 0)
                      if (mediaSort === 'az') return a.filename.localeCompare(b.filename)
                      return 0
                    })
                    .map(item => {
                      const isSelectedForProduct = form.images.includes(item.url)
                      const isSelectedForAction = mediaSelection.includes(item.id)
                      const isPrimary = form.images[form.primary_image_index] === item.url
                      
                      return (
                        <div
                          key={item.id}
                          className="group relative"
                        >
                          <div
                            onClick={(e) => {
                              if (e.shiftKey) {
                                // Multi-selection for management
                                setMediaSelection(prev => 
                                  prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                                )
                              } else {
                                // Toggle for product
                                if (isSelectedForProduct) {
                                  const next = form.images.filter(img => img !== item.url)
                                  update({ 
                                    images: next, 
                                    primary_image_index: Math.min(form.primary_image_index, Math.max(0, next.length - 1)) 
                                  })
                                } else {
                                  update({ images: [...form.images, item.url] })
                                }
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              setMediaSelection(prev => 
                                prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                              )
                            }}
                            className={cn(
                              'relative aspect-square rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 ring-offset-2',
                              isSelectedForProduct ? 'ring-2 ring-primary-cyan scale-[0.98]' : 'hover:scale-[1.02] shadow-sm hover:shadow-xl',
                              isSelectedForAction && 'ring-2 ring-primary-dark/50 brightness-75'
                            )}
                          >
                            <img 
                              src={item.url} 
                              alt={item.filename} 
                              className="w-full h-full object-cover" 
                              loading="lazy"
                            />
                            
                            {/* Overlay info on hover */}
                            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                              <p className="text-[10px] text-white/90 truncate font-bold">{item.filename}</p>
                              <p className="text-[9px] text-white/60">{(item.size_bytes / 1024).toFixed(1)} KB</p>
                            </div>

                            {/* Indicators */}
                            <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 pt-0.5">
                              {isSelectedForProduct && (
                                <motion.div 
                                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                                  className="w-6 h-6 rounded-full bg-primary-cyan text-white flex items-center justify-center shadow-lg"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </motion.div>
                              )}
                              {isSelectedForAction && (
                                <motion.div 
                                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                                  className="w-6 h-6 rounded-full bg-primary-dark text-white flex items-center justify-center shadow-lg"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </motion.div>
                              )}
                            </div>

                            {isPrimary && (
                              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-amber-400 text-[8px] font-black text-white rounded-lg shadow-sm uppercase tracking-tighter">
                                Principal
                              </div>
                            )}

                            {/* Quick delete button (individual) */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleMediaDelete([{ id: item.id, url: item.url }]) }}
                              className="absolute bottom-2.5 right-2.5 w-7 h-7 bg-white/20 hover:bg-red-500 backdrop-blur-md rounded-xl text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  
                  {media.length === 0 && !mediaUploading && (
                    <div className="col-span-full py-24 flex flex-col items-center justify-center bg-gray-50/50 rounded-[40px] border-2 border-dashed border-gray-100">
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
                        <ImageIcon className="w-8 h-8 text-gray-300" />
                      </div>
                      <h4 className="text-gray-900 font-bold mb-1">Tu biblioteca está vacía</h4>
                      <p className="text-gray-400 text-sm mb-8 text-center max-w-[280px]">
                        Comienza subiendo algunas fotos increíbles para tus snacks.
                      </p>
                      <label className="cursor-pointer">
                        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleMediaUpload(e.target.files)} />
                        <Button variant="outline" className="rounded-2xl h-12 px-8 font-extrabold border-2 hover:bg-gray-50">
                          <UploadCloud className="w-4 h-4 mr-2" /> Seleccionar archivos
                        </Button>
                      </label>
                    </div>
                  )}

                  {mediaUploading && (
                    <div className="aspect-square rounded-3xl border-2 border-dashed border-primary-cyan/30 flex flex-col items-center justify-center bg-primary-cyan/5 animate-pulse">
                      <Loader2 className="w-6 h-6 text-primary-cyan animate-spin mb-2" />
                      <span className="text-[10px] font-bold text-primary-cyan uppercase tracking-widest">Subiendo...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-5 bg-gray-50/80 backdrop-blur-md border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">Selección Actual</span>
                    <span className="text-sm font-black text-gray-900">{form.images.length} imágenes para el producto</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">Control</span>
                    <p className="text-[10px] text-gray-500 font-medium">Click para toggle | Shift+Click para acciones masivas</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => update({ images: [] })}
                    className="h-11 rounded-2xl text-xs font-bold text-gray-400 hover:text-red-500"
                  >
                    Limpiar selección
                  </Button>
                  <Button
                    onClick={() => setMediaDialogOpen(false)}
                    className="bg-primary-dark text-white font-black rounded-2xl h-11 px-10 shadow-xl hover:shadow-primary-dark/20 transition-all hover:-translate-y-0.5"
                  >
                    Confirmar Selección
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Dialog open={brandManageOpen} onOpenChange={setBrandManageOpen}>
        <DialogContent className="max-w-md overflow-hidden rounded-2xl border-0 p-0 gap-0 shadow-2xl">
          <div className="bg-gradient-to-br from-amber-400 via-amber-400 to-yellow-300 px-6 py-5 text-amber-950">
            <DialogTitle className="text-lg font-black tracking-tight">Gestionar marcas</DialogTitle>
            <p className="text-xs text-amber-900/70 mt-1.5 leading-relaxed">
              Lista de marcas en catálogo. Al eliminar, los productos vinculados quedarán sin marca hasta que asignes otra.
            </p>
          </div>
          <div className="p-5 bg-white">
            {brandListLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando marcas…
              </div>
            ) : (
              <ul className="max-h-[min(50vh,280px)] overflow-y-auto custom-scrollbar space-y-1.5 rounded-xl border border-gray-100 bg-gray-50/50 p-2">
                {brandList.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 bg-white border border-gray-100 shadow-sm hover:border-primary-cyan/30 transition-colors"
                  >
                    <span className="text-sm font-semibold text-gray-900 truncate">{b.name}</span>
                    <button
                      type="button"
                      onClick={() => void deleteBrand(b.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                      title="Eliminar marca"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
                {brandList.length === 0 && (
                  <li className="text-sm text-gray-400 text-center py-8 px-4">
                    No hay marcas registradas. Escribe un nombre en el campo Marca del producto y usa &quot;Crear&quot; o aplica la migración de base de datos si el servidor lo indica.
                  </li>
                )}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
