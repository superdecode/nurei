'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Save, Plus, X, ChevronDown, ChevronUp, Package, ImageIcon,
  DollarSign, Tag, Layers, Settings2, Flame, Copy, Trash2,
  ArrowLeft, Loader2, GripVertical, Check, Sparkles, Search,
  SortDesc, Calendar, Trash, UploadCloud, CheckCircle2, Circle, AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
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

interface ProductFormProps {
  initialProduct?: Product
  initialVariants?: ProductVariant[]
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

const SPICE_CATEGORIES = ['spicy', 'snacks', 'ramen', 'salsas']

// ─── Helpers ────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function generateSku(): string {
  return `NUR-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
}

const emptyForm: ProductFormData = {
  name: '', slug: '', description: '', category: 'crunchy', subcategory: '',
  sku: '', brand: '', origin: '', origin_country: '',
  unit_of_measure: 'g', spice_level: 0, requires_spice_level: false,
  weight_g: '', shipping_weight_g: '', base_price: '', compare_at_price: '', cost_estimate: '',
  status: 'draft', campaign: '', tags: [], images: [], primary_image_index: 0,
  has_variants: false, dimensions_cm: { length: '', width: '', height: '' },
  stock_quantity: '0', low_stock_threshold: '5', track_inventory: true,
  allow_backorder: false, is_featured: false, is_limited: false,
  inventory_note: '',
}

function productToForm(p: Product): ProductFormData {
  return {
    name: p.name, slug: p.slug, description: p.description ?? '',
    category: p.category, subcategory: p.subcategory ?? '',
    sku: p.sku, brand: p.brand ?? '', origin: p.origin ?? 'Japon',
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
  title, icon: Icon, children, defaultOpen = true, titleClassName = '',
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  defaultOpen?: boolean
  titleClassName?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <Icon className="w-4 h-4 text-gray-400" />
        <span className={cn("text-sm font-bold text-gray-900 flex-1", titleClassName)}>{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
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

export default function ProductForm({ initialProduct, initialVariants }: ProductFormProps) {
  const router = useRouter()
  const isEdit = !!initialProduct

  const [form, setForm] = useState<ProductFormData>(
    initialProduct ? productToForm(initialProduct) : emptyForm
  )
  const [variants, setVariants] = useState<VariantFormData[]>(
    initialVariants?.map(variantToForm) ?? []
  )
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
  const [mediaDeleting, setMediaDeleting] = useState<string | null>(null)
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false)
  const [categories, setCategories] = useState<{value: string, label: string, emoji: string}[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/admin/categories')
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setCategories((json.data as CategoryOption[]).map((c) => ({
            value: c.slug,
            label: c.name,
            emoji: c.emoji || '📦'
          })))
        }
      })
      .catch(console.error)
  }, [])

  // Auto-detect spice level requirement based on category
  useEffect(() => {
    const shouldRequireSpice = SPICE_CATEGORIES.includes(form.category)
    if (shouldRequireSpice !== form.requires_spice_level) {
      update({ requires_spice_level: shouldRequireSpice })
    }
  }, [form.category])

  const update = useCallback((updates: Partial<ProductFormData>) => {
    setForm(prev => {
      const next = { ...prev, ...updates }
      if ('name' in updates && !isEdit) {
        next.slug = slugify(updates.name ?? '')
      }
      return next
    })
  }, [isEdit])

  const fetchMedia = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/media')
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
        const res = await fetch('/api/admin/media', { method: 'POST', body: fd })
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

  const handleMediaDelete = useCallback(async (items: Array<{ id: string; url: string }>) => {
    if (!items.length) return
    if (!confirm(`¿Eliminar ${items.length} imagen(es) permanentemente de la galería?`)) return
    
    setIsDeletingMultiple(items.length > 1)
    if (items.length === 1) setMediaDeleting(items[0].id)

    try {
      const res = await fetch('/api/admin/media', {
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

  const handleSave = async (addAnother = false) => {
    // Validation
    const errors: string[] = []
    const nextFieldErrors: Record<string, string> = {}
    if (!form.name.trim()) errors.push('Nombre del producto')
    if (!form.category) errors.push('Categoría')
    if (!form.base_price || parseFloat(form.base_price) <= 0) errors.push('Precio válido (mayor a $0)')
    if (!form.images.length) errors.push('Al menos una imagen')
    if (form.has_variants && !variants.length) errors.push('Al menos una variante (si está habilitada)')
    if (!isEdit && form.track_inventory && !form.stock_quantity.trim()) {
      errors.push('Stock inicial')
      nextFieldErrors.stock_quantity = 'Stock inicial es obligatorio'
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

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        slug: form.slug || slugify(form.name),
        description: form.description || null,
        category: form.category,
        subcategory: form.subcategory || null,
        sku: form.sku || generateSku(),
        brand: form.brand || null,
        origin: form.origin,
        origin_country: form.origin_country || form.origin,
        unit_of_measure: form.unit_of_measure,
        spice_level: form.spice_level,
        requires_spice_level: form.requires_spice_level,
        weight_g: parseInt(form.weight_g) || 0,
        shipping_weight_g: form.shipping_weight_g ? parseInt(form.shipping_weight_g) || 0 : null,
        base_price: Math.round(parseFloat(form.base_price) * 100),
        price: Math.round(parseFloat(form.base_price) * 100),
        compare_at_price: form.compare_at_price ? Math.round(parseFloat(form.compare_at_price) * 100) : null,
        cost_estimate: form.cost_estimate ? Math.round(parseFloat(form.cost_estimate) * 100) : null,
        status: form.status,
        campaign: form.campaign || null,
        tags: form.tags,
        images: form.images,
        primary_image_index: form.primary_image_index,
        has_variants: form.has_variants,
        dimensions_cm: (form.dimensions_cm.length || form.dimensions_cm.width || form.dimensions_cm.height)
          ? {
              length: parseFloat(form.dimensions_cm.length) || null,
              width: parseFloat(form.dimensions_cm.width) || null,
              height: parseFloat(form.dimensions_cm.height) || null,
            }
          : null,
        stock_quantity: parseInt(form.stock_quantity) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
        track_inventory: form.track_inventory,
        allow_backorder: form.allow_backorder,
        is_featured: form.is_featured,
        is_limited: form.is_limited,
        availability_score: 100,
        inventory_note: form.inventory_note.trim() || undefined,
      }

      let productId: string

      if (isEdit && initialProduct) {
        const res = await fetch(`/api/products/${initialProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        productId = initialProduct.id
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        productId = json.data.id
      }

      // Save variants
      if (form.has_variants && variants.length > 0) {
        const variantData = variants.map(v => ({
          ...(v.id ? { id: v.id } : {}),
          name: v.name,
          sku_suffix: v.sku_suffix || null,
          price: Math.round(parseFloat(v.price || '0') * 100),
          compare_at_price: v.compare_at_price ? Math.round(parseFloat(v.compare_at_price) * 100) : null,
          stock: parseInt(v.stock) || 0,
          attributes: v.attributes,
          image: v.image || null,
          status: v.status,
        }))

        await fetch(`/api/products/${productId}/variants`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variants: variantData }),
        })
      }

      toast.success(isEdit ? 'Producto actualizado' : 'Producto creado')

      if (addAnother) {
        setForm(emptyForm)
        setFieldErrors({})
        setVariants([])
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        router.push('/admin/productos')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

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

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-gray-50/95 backdrop-blur-md -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-gray-200/50 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/admin/productos')}
              className="rounded-xl text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {isEdit ? 'Editar producto' : 'Nuevo producto'}
              </h1>
              {form.name && (
                <p className="text-xs text-gray-400 truncate max-w-[200px]">{form.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEdit && (
              <Button
                variant="outline"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="hidden sm:flex rounded-xl h-9 text-xs font-bold"
              >
                Guardar y crear otro
              </Button>
            )}
            <Button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="bg-primary-dark text-white hover:bg-black font-bold rounded-xl h-9 px-6 shadow-md"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {isEdit ? 'Guardar' : 'Crear producto'}
            </Button>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6">
        {/* Left column — main content */}
        <div className="space-y-5">
          {/* 1. Basic info */}
          <Section title="Informacion basica" icon={Package}>
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
                    placeholder="NUR-XXXX"
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
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Marca</label>
                <Input
                  value={form.brand}
                  onChange={(e) => update({ brand: e.target.value })}
                  placeholder="Ej: Samyang, Glico, Lotte"
                  className="h-10"
                />
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
                <Textarea
                  value={form.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="Descripcion del producto..."
                  className="min-h-[80px]"
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

                <div className="flex flex-col gap-2 mt-4 text-xs">
                  <Toggle
                    value={form.has_variants}
                    onChange={(v) => update({ has_variants: v })}
                    label="Este producto tiene variantes (sabor, tamano, etc.)"
                  />
                  {form.has_variants && (
                    <p className="text-[11px] text-amber-600 bg-amber-50 px-3 py-2 rounded-lg ml-6 inline-block w-fit">
                      El precio base se usara como referencia. Cada variante puede tener su propio precio.
                    </p>
                  )}
                </div>
              </div>

              {/* Organizacion (Merged) */}
              <div className="sm:col-span-2 pt-2 border-t border-gray-100 mt-4">
                <h4 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-4">Clasificación &amp; Organización</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Categoria</label>
                    <Select value={form.category || undefined} onValueChange={(v) => { if (v) update({ category: v }) }}>
                      <SelectTrigger className="h-11 w-full text-sm">
                        <SelectValue placeholder="Selecciona una categoría del catálogo" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.value} value={c.value}>
                            <span className="mr-1.5">{c.emoji}</span>{c.label}
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

          {/* 2. Images */}
          <Section title="Galería de imágenes" icon={ImageIcon} titleClassName="text-nurei-cta" defaultOpen={false}>
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
          <Section title="Atributos opcionales" icon={Settings2} defaultOpen={false}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    {form.weight_g || '0'} {form.unit_of_measure}
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
                  placeholder="0"
                  className="h-10"
                />
                {fieldErrors.weight_g && (
                  <p className="text-[11px] font-medium text-red-500">{fieldErrors.weight_g}</p>
                )}
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

          {/* 6. Variants */}
          {form.has_variants && (
            <Section title={`Variantes (${variants.length})`} icon={Layers} defaultOpen={false}>
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
            </Section>
          )}

          {/* 7. Inventory */}
          <Section title="Inventario" icon={Package} defaultOpen={false}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {form.track_inventory && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500">{isEdit ? 'Stock actual' : 'Stock inicial'} {!isEdit && form.track_inventory ? '*' : ''}</label>
                  <Input
                    type="number" min="0"
                    value={form.stock_quantity}
                    onChange={(e) => update({ stock_quantity: e.target.value })}
                    className="h-10"
                    disabled={form.has_variants}
                  />
                  {form.has_variants && (
                    <p className="text-[10px] text-gray-400">Stock manejado por variantes ({totalVariantStock} total)</p>
                  )}
                  {!isEdit && form.track_inventory && fieldErrors.stock_quantity && (
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
            {/* Status */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Estado del producto</h3>

              <div className="grid grid-cols-3 gap-2">
                {['draft', 'active', 'archived'].map((status) => {
                  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
                    draft: { label: 'Borrador', color: 'text-gray-600', bg: 'bg-gray-100' },
                    active: { label: 'Activo', color: 'text-green-700', bg: 'bg-green-100' },
                    archived: { label: 'Archivado', color: 'text-orange-700', bg: 'bg-orange-100' },
                  }
                  const config = statusConfig[status]
                  const isSelected = form.status === status
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => update({ status: status as ProductStatus })}
                      className={cn(
                        'py-2.5 px-3 rounded-xl font-semibold text-xs transition-all duration-200',
                        isSelected
                          ? `${config.bg} ${config.color} ring-2 ring-offset-0 ${config.color.replace('text-', 'ring-')}`
                          : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                      )}
                    >
                      {config.label}
                    </button>
                  )
                })}
              </div>

              <Separator className="my-3" />

              <div className="space-y-2">
                <Toggle value={form.is_featured} onChange={(v) => update({ is_featured: v })} label="✨ Destacado" />
                <Toggle value={form.is_limited} onChange={(v) => update({ is_limited: v })} label="⭐ Edición limitada" />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resumen</h3>
              <div className="space-y-2 text-sm">
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push('/admin/productos')}
                className="flex-1 rounded-xl h-11 font-bold text-gray-500"
              >
                Volver
              </Button>
              <div className="flex flex-col sm:flex-row flex-1 gap-2 pl-4 border-l border-gray-100">
                <Button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="w-full bg-primary-dark text-white hover:bg-black font-bold rounded-xl h-11 shadow-md"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {isEdit ? 'Guardar' : 'Crear'}
                </Button>
                {!isEdit && (
                  <Button
                    variant="outline"
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="w-full bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border-yellow-200 rounded-xl h-11 font-bold"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crear otro
                  </Button>
                )}
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
    </div>
  )
}
