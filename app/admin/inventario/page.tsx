'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  RefreshCcw,
  Search,
  TrendingUp,
  Pencil,
  Upload,
  Download,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Check,
  Package,
  Eye,
  Bell,
  Wrench,
  BellRing,
  History,
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { motion, AnimatePresence } from 'framer-motion'
import type { InventoryMovement, InventoryMovementType, Product, StockStatus } from '@/types'
import { computeStockStatus, stockStatusLabel } from '@/lib/inventory/stock-status'
import { cn } from '@/lib/utils'
import { AnchoredFilterPanel } from '@/components/admin/AnchoredFilterPanel'

// ─── Types ───────────────────────────────────────────────────────────────────

type InventoryProduct = Product & { sold_30d?: number; entries_30d?: number }

type InventoryApiData = {
  movements: InventoryMovement[]
  products: InventoryProduct[]
  summary: { total_in: number; total_out: number; total_adjustments: number }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MOVEMENT_TYPE_LABEL: Record<InventoryMovementType, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  venta: 'Venta',
  devolucion: 'Devolución',
}

const MOTIVO_PRESETS = [
  'Recepción de mercancía',
  'Corrección de conteo',
  'Merma / daño',
  'Devolución de cliente',
  'Ajuste por auditoría',
  'Promoción / muestra',
  'Otro',
]

const STATUS_COLORS: Record<StockStatus, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  low_stock: 'bg-amber-100 text-amber-900',
  out_of_stock: 'bg-amber-100 text-amber-900',
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

// ─── Animated counter ─────────────────────────────────────────────────────────

function useAnimatedInt(target: number, duration = 700) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 2
      setV(Math.round(target * eased))
      if (t < 1) requestAnimationFrame(tick)
    }
    const id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [target, duration])
  return v
}

// ─── Sort header ──────────────────────────────────────────────────────────────

function SortHeader({
  active,
  dir,
  onClick,
  children,
}: {
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors',
        active ? 'text-primary-cyan' : 'text-gray-500 hover:text-gray-700'
      )}
    >
      {children}
      {active ? (
        dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : null}
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function InventoryAdminPage() {
  const [loading, setLoading] = useState(true)
  const [apiData, setApiData] = useState<InventoryApiData>({
    movements: [],
    products: [],
    summary: { total_in: 0, total_out: 0, total_adjustments: 0 },
  })
  const [categories, setCategories] = useState<{ value: string; label: string; color?: string }[]>([])
  const [inventoryView, setInventoryView] = useState<
    'todos' | 'stock_bajo' | 'mejores_ventas' | 'nuevas_entradas'
  >('todos')
  const [page, setPage] = useState(1)
  const pageSize = 14
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ─ Search & filter state ──────────────────────────────────────────────────
  const [searchDraft, setSearchDraft] = useState('')
  const [searchApplied, setSearchApplied] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [catFilter, setCatFilter] = useState('')
  const [stockStatusFilter, setStockStatusFilter] = useState<'' | StockStatus>('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [stockMin, setStockMin] = useState('')
  const [stockMax, setStockMax] = useState('')

  // ─ Movements modal ────────────────────────────────────────────────────────
  const [movementsModalOpen, setMovementsModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null)
  const [modalMovements, setModalMovements] = useState<InventoryMovement[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [movementDateFrom, setMovementDateFrom] = useState('')
  const [movementDateTo, setMovementDateTo] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState<'todos' | InventoryMovementType>(
    'todos'
  )
  const [movementSearchDraft, setMovementSearchDraft] = useState('')
  const [movementSearchApplied, setMovementSearchApplied] = useState('')
  const [movementSort, setMovementSort] = useState<{
    key: 'created_at' | 'type' | 'quantity'
    dir: 'asc' | 'desc'
  }>({ key: 'created_at', dir: 'desc' })

  // ─ Adjust modal ───────────────────────────────────────────────────────────
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustProduct, setAdjustProduct] = useState<InventoryProduct | null>(null)
  const [adjustKind, setAdjustKind] = useState<'entrada' | 'salida' | 'correccion'>('entrada')
  const [adjustValue, setAdjustValue] = useState('')
  const [adjustMotivo, setAdjustMotivo] = useState(MOTIVO_PRESETS[0])
  const [adjustNota, setAdjustNota] = useState('')

  // ─ Alert modal ────────────────────────────────────────────────────────────
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertProduct, setAlertProduct] = useState<InventoryProduct | null>(null)
  const [alertThreshold, setAlertThreshold] = useState('')

  // ─ Bulk modals ────────────────────────────────────────────────────────────
  const [bulkAdjustOpen, setBulkAdjustOpen] = useState(false)
  const [bulkAlertOpen, setBulkAlertOpen] = useState(false)
  const [bulkAdjustKind, setBulkAdjustKind] = useState<'entrada' | 'salida' | 'correccion'>(
    'entrada'
  )
  const [bulkAdjustValue, setBulkAdjustValue] = useState('')
  const [bulkAdjustMotivo, setBulkAdjustMotivo] = useState(MOTIVO_PRESETS[0])
  const [bulkAdjustNota, setBulkAdjustNota] = useState('')
  const [bulkAlertValue, setBulkAlertValue] = useState('')

  // ─ Import modal ───────────────────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<Record<string, string>[]>([])
  const [importErrors, setImportErrors] = useState<
    Array<{ row: number; sku: string; message: string }>
  >([])
  const [importValidRows, setImportValidRows] = useState<Array<Record<string, unknown>>>([])
  const [importSummary, setImportSummary] = useState<{
    total: number
    valid: number
    invalid: number
  } | null>(null)
  const [importBusy, setImportBusy] = useState(false)

  // ─── Data fetch ───────────────────────────────────────────────────────────

  const EMPTY_DATA: InventoryApiData = {
    movements: [],
    products: [],
    summary: { total_in: 0, total_out: 0, total_adjustments: 0 },
  }

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/inventory?include_products=true&limit=500')
      const json = await res.json() as { data?: InventoryApiData; error?: string }
      if (!res.ok || !json.data) {
        if (json.error) toast.error(`Error: ${json.error}`)
        return
      }
      setApiData({
        movements: json.data.movements ?? [],
        products: json.data.products ?? [],
        summary: json.data.summary ?? EMPTY_DATA.summary,
      })
    } catch {
      toast.error('No se pudo cargar inventario')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchInventory()
    fetch('/api/admin/categories')
      .then((r) => r.json())
      .then((j) => {
        const rows = (j.data ?? []) as Array<{ slug: string; name: string; color?: string | null }>
        setCategories(rows.map((c) => ({ value: c.slug, label: c.name, color: c.color ?? undefined })))
      })
      .catch(() => {})
  }, [fetchInventory])

  // ─── Debounced search ─────────────────────────────────────────────────────

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setSearchApplied(searchDraft.trim())
      setPage(1)
    }, 500)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [searchDraft])

  // ─── Summary metrics ──────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const products = apiData.products
    const low = products.filter((p) => computeStockStatus(p) !== 'available').length
    return {
      total: products.length,
      low,
      withSales: products.filter((p) => (p.sold_30d ?? 0) > 0).length,
      withEntries: products.filter((p) => (p.entries_30d ?? 0) > 0).length,
    }
  }, [apiData.products])

  const cTotal = useAnimatedInt(metrics.total)
  const cLow = useAnimatedInt(metrics.low)
  const cSales = useAnimatedInt(metrics.withSales)
  const cEntries = useAnimatedInt(metrics.withEntries)

  // ─── Active chips ─────────────────────────────────────────────────────────

  const activeChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = []
    if (catFilter) {
      const lab = categories.find((c) => c.value === catFilter)?.label ?? catFilter
      chips.push({ id: 'cat', label: lab, onRemove: () => setCatFilter('') })
    }
    if (stockStatusFilter)
      chips.push({ id: 'st', label: stockStatusLabel(stockStatusFilter), onRemove: () => setStockStatusFilter('') })
    if (priceMin)
      chips.push({ id: 'pmin', label: `≥ $${priceMin}`, onRemove: () => setPriceMin('') })
    if (priceMax)
      chips.push({ id: 'pmax', label: `≤ $${priceMax}`, onRemove: () => setPriceMax('') })
    if (stockMin)
      chips.push({ id: 'smin', label: `Stock ≥ ${stockMin}`, onRemove: () => setStockMin('') })
    if (stockMax)
      chips.push({ id: 'smax', label: `Stock ≤ ${stockMax}`, onRemove: () => setStockMax('') })
    return chips
  }, [catFilter, categories, stockStatusFilter, priceMin, priceMax, stockMin, stockMax])

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

  const clearAllFilters = () => {
    setSearchDraft(''); setSearchApplied('')
    setCatFilter('')
    setStockStatusFilter('')
    setPriceMin(''); setPriceMax('')
    setStockMin(''); setStockMax('')
    setInventoryView('todos')
    setPage(1)
  }

  // ─── Filtered & paginated products ────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let result = [...apiData.products]
    if (searchApplied) {
      const q = searchApplied.toLowerCase()
      result = result.filter(
        (p) =>
          (p.name ?? '').toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q)
      )
    }
    if (catFilter) result = result.filter((p) => p.category === catFilter)
    if (stockStatusFilter)
      result = result.filter((p) => computeStockStatus(p) === stockStatusFilter)
    const pMin = Number(priceMin); const pMax = Number(priceMax)
    if (priceMin && Number.isFinite(pMin)) result = result.filter((p) => (p.base_price ?? p.price ?? 0) / 100 >= pMin)
    if (priceMax && Number.isFinite(pMax)) result = result.filter((p) => (p.base_price ?? p.price ?? 0) / 100 <= pMax)
    const qMin = Number(stockMin); const qMax = Number(stockMax)
    if (stockMin && Number.isFinite(qMin)) result = result.filter((p) => (p.stock_quantity ?? 0) >= qMin)
    if (stockMax && Number.isFinite(qMax)) result = result.filter((p) => (p.stock_quantity ?? 0) <= qMax)
    if (inventoryView === 'stock_bajo')
      result = result.filter((p) => computeStockStatus(p) !== 'available')
    if (inventoryView === 'mejores_ventas')
      result = result.sort((a, b) => (b.sold_30d ?? 0) - (a.sold_30d ?? 0)).filter((p) => (p.sold_30d ?? 0) > 0)
    if (inventoryView === 'nuevas_entradas')
      result = result.sort((a, b) => (b.entries_30d ?? 0) - (a.entries_30d ?? 0)).filter((p) => (p.entries_30d ?? 0) > 0)
    return result
  }, [apiData.products, inventoryView, searchApplied, catFilter, stockStatusFilter, priceMin, priceMax, stockMin, stockMax])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const paginatedProducts = useMemo(() => {
    const s = (page - 1) * pageSize
    return filteredProducts.slice(s, s + pageSize)
  }, [filteredProducts, page])

  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  // ─── Selection ────────────────────────────────────────────────────────────

  const allVisibleSelected =
    paginatedProducts.length > 0 && paginatedProducts.every((p) => selectedIds.has(p.id))
  const someSelected = selectedIds.size > 0

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })

  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(paginatedProducts.map((p) => p.id)))
  }

  // ─── Open movements ───────────────────────────────────────────────────────

  const openMovementsModal = async (product: InventoryProduct) => {
    setSelectedProduct(product)
    setMovementDateFrom(''); setMovementDateTo('')
    setMovementTypeFilter('todos')
    setMovementSearchDraft(''); setMovementSearchApplied('')
    setMovementSort({ key: 'created_at', dir: 'desc' })
    setMovementsModalOpen(true)
    setModalLoading(true)
    try {
      const res = await fetch(`/api/admin/inventory?product_id=${product.id}&limit=250`)
      const json = await res.json()
      setModalMovements(json.data?.movements ?? [])
    } catch {
      setModalMovements([])
    } finally {
      setModalLoading(false)
    }
  }

  const productMovementsFiltered = useMemo(() => {
    let list = [...modalMovements]
    if (movementTypeFilter !== 'todos') list = list.filter((m) => m.type === movementTypeFilter)
    if (movementDateFrom) {
      const from = new Date(`${movementDateFrom}T00:00:00`)
      list = list.filter((m) => new Date(m.created_at) >= from)
    }
    if (movementDateTo) {
      const to = new Date(`${movementDateTo}T23:59:59`)
      list = list.filter((m) => new Date(m.created_at) <= to)
    }
    if (movementSearchApplied) {
      const q = movementSearchApplied.toLowerCase()
      list = list.filter(
        (m) =>
          (m.reason ?? '').toLowerCase().includes(q) ||
          (m.reference ?? '').toLowerCase().includes(q) ||
          MOVEMENT_TYPE_LABEL[m.type].toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      let cmp = 0
      if (movementSort.key === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (movementSort.key === 'type') cmp = a.type.localeCompare(b.type)
      if (movementSort.key === 'quantity') cmp = (a.quantity ?? 0) - (b.quantity ?? 0)
      return movementSort.dir === 'asc' ? cmp : -cmp
    })
    return list
  }, [modalMovements, movementDateFrom, movementDateTo, movementTypeFilter, movementSearchApplied, movementSort])

  const toggleSort = (key: 'created_at' | 'type' | 'quantity') =>
    setMovementSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    )

  // ─── Submit helpers ───────────────────────────────────────────────────────

  const submitAdjust = async () => {
    if (!adjustProduct) return
    const v = Number(adjustValue)
    if (!Number.isFinite(v) || v < 0) { toast.error('Cantidad inválida'); return }
    try {
      const res = await fetch('/api/admin/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: adjustProduct.id,
          kind: adjustKind,
          value: Math.round(adjustKind === 'correccion' ? v : Math.abs(v)),
          motivo: adjustMotivo,
          nota: adjustNota.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Movimiento guardado')
      setAdjustOpen(false); setAdjustValue(''); setAdjustNota('')
      fetchInventory()
    } catch { toast.error('No se pudo guardar') }
  }

  const submitAlert = async () => {
    if (!alertProduct) return
    const t = Number(alertThreshold)
    if (!Number.isFinite(t) || t < 0) { toast.error('Umbral inválido'); return }
    try {
      const res = await fetch(`/api/products/${alertProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ low_stock_threshold: Math.round(t), inventory_note: 'Alerta desde inventario' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Alerta actualizada')
      setAlertOpen(false); fetchInventory()
    } catch { toast.error('No se pudo actualizar') }
  }

  const submitBulkAdjust = async () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    const v = Number(bulkAdjustValue)
    if (!Number.isFinite(v) || v < 0) { toast.error('Valor inválido'); return }
    try {
      const res = await fetch('/api/admin/inventory/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_ids: ids,
          kind: bulkAdjustKind,
          value: Math.round(bulkAdjustKind === 'correccion' ? v : Math.abs(v)),
          motivo: bulkAdjustMotivo,
          nota: bulkAdjustNota.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Ajuste masivo aplicado')
      setBulkAdjustOpen(false); setSelectedIds(new Set()); fetchInventory()
    } catch { toast.error('Error en ajuste masivo') }
  }

  const submitBulkAlert = async () => {
    const ids = Array.from(selectedIds)
    const t = Number(bulkAlertValue)
    if (!ids.length || !Number.isFinite(t) || t < 0) { toast.error('Datos inválidos'); return }
    try {
      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: ids, action: 'set_low_stock_threshold', value: Math.round(t) }),
      })
      if (!res.ok) throw new Error()
      toast.success('Alertas actualizadas')
      setBulkAlertOpen(false); setSelectedIds(new Set()); fetchInventory()
    } catch { toast.error('Error') }
  }

  // ─── Import ───────────────────────────────────────────────────────────────

  const onImportDrop = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setImportBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/inventory/import', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setImportPreview(json.data.preview ?? [])
      setImportErrors(json.data.errors ?? [])
      setImportValidRows(json.data.rows ?? [])
      setImportSummary(json.data.summary ?? null)
    } catch { toast.error('No se pudo validar el archivo') }
    finally { setImportBusy(false) }
  }

  const confirmImport = async () => {
    if (!importValidRows.length) return
    setImportBusy(true)
    try {
      const res = await fetch('/api/admin/inventory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importValidRows }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error()
      toast.success(`Importados: ${json.data?.imported ?? 0}, fallidos: ${json.data?.failed?.length ?? 0}`)
      setImportOpen(false)
      setImportPreview([]); setImportErrors([]); setImportValidRows([]); setImportSummary(null)
      fetchInventory()
    } catch { toast.error('Error al importar') }
    finally { setImportBusy(false) }
  }

  const downloadErrorsCsv = () => {
    const lines = ['fila,sku,mensaje', ...importErrors.map((e) => `${e.row},"${e.sku.replace(/"/g, '""')}","${e.message.replace(/"/g, '""')}"`)]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'errores_importacion.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const resetImportModal = () => {
    setImportPreview([]); setImportErrors([]); setImportValidRows([]); setImportSummary(null)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onImportDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  })

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-w-0 space-y-4">
      {/* ── Header ── */}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 shrink-0">
          <h1 className="text-2xl font-bold text-primary-dark">Inventario</h1>
          <p className="text-sm text-gray-400 mt-0.5">Control de existencias y trazabilidad</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => { resetImportModal(); setImportOpen(true) }} className="gap-1.5 h-8 rounded-full text-xs font-semibold">
            <Upload className="h-3.5 w-3.5" /> Importar
          </Button>
          <Button variant="outline" onClick={fetchInventory} className="gap-1 h-8 w-8 rounded-full p-0">
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          {
            view: 'todos' as const,
            count: cTotal,
            label: 'Productos',
            sub: 'catálogo total',
            ring: 'focus-visible:ring-blue-400',
            active: 'border-blue-500 bg-blue-50 text-blue-950',
            idle: 'border-blue-200 bg-blue-50/60 text-blue-900 hover:border-blue-400',
            numColor: 'text-blue-950',
          },
          {
            view: 'stock_bajo' as const,
            count: cLow,
            label: 'Atención',
            sub: 'stock bajo o agotado',
            ring: 'focus-visible:ring-amber-400',
            active: 'border-amber-500 bg-amber-50 text-amber-950',
            idle: 'border-amber-200 bg-amber-50/70 text-amber-900 hover:border-amber-400',
            numColor: 'text-amber-950',
            icon: <AlertIcon />,
          },
          {
            view: 'mejores_ventas' as const,
            count: cSales,
            label: 'Con ventas',
            sub: 'últimos 30 días',
            ring: 'focus-visible:ring-teal-400',
            active: 'border-teal-500 bg-teal-50 text-teal-950',
            idle: 'border-teal-200 bg-teal-50/70 text-teal-900 hover:border-teal-400',
            numColor: 'text-teal-950',
            icon: <TrendingUp className="h-3.5 w-3.5" />,
          },
          {
            view: 'nuevas_entradas' as const,
            count: cEntries,
            label: 'Con entradas',
            sub: 'últimos 30 días',
            ring: 'focus-visible:ring-emerald-400',
            active: 'border-emerald-500 bg-emerald-50 text-emerald-950',
            idle: 'border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:border-emerald-400',
            numColor: 'text-emerald-950',
            icon: <ArrowUp className="h-3.5 w-3.5" />,
          },
        ].map(({ view, count, label, sub, ring, active, idle, numColor, icon }) => (
          <button
            key={view}
            type="button"
            onClick={() => { setInventoryView(view); setPage(1) }}
            className={cn(
              'rounded-xl border-2 px-3 py-2.5 text-left transition focus:outline-none',
              ring,
              inventoryView === view ? active : idle
            )}
          >
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide opacity-75">
              {icon} {label}
            </p>
            <p className={cn('mt-0.5 text-2xl font-black tabular-nums', numColor)}>{count}</p>
            <p className="text-[10px] font-medium opacity-70 truncate">{sub}</p>
          </button>
        ))}
      </div>

      {/* ── Search, luego Filtrar + chips ── */}
      <div className="flex min-w-0 flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative min-w-[min(100%,220px)] flex-1 basis-[220px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            className="h-10 pl-10 pr-10 text-sm bg-white border-gray-200 rounded-full focus-visible:ring-2 focus-visible:ring-orange-400/30 focus-visible:border-orange-400/50"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
                setSearchApplied(searchDraft.trim()); setPage(1)
              }
            }}
            placeholder="Buscar producto por nombre o SKU…"
          />
          {searchDraft && (
            <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => { setSearchDraft(''); setSearchApplied('') }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button type="button" className="h-10 shrink-0 px-5 text-sm font-semibold rounded-full"
          onClick={() => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); setSearchApplied(searchDraft.trim()); setPage(1) }}>
          Buscar
        </Button>

        {/* Smart filter */}
        <div className="relative shrink-0" ref={filterRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={cn('flex items-center gap-1.5 h-10 px-4 rounded-full border text-sm font-semibold transition-all',
              filterOpen || activeChips.length > 0 ? 'bg-primary-dark text-white border-primary-dark shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            )}
          >
            <Filter className="h-4 w-4" />
            Filtrar
            {activeChips.length > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-orange-400 text-[10px] font-black text-white">{activeChips.length}</span>
            )}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', filterOpen ? 'rotate-180' : '')} />
          </button>

          <AnchoredFilterPanel ref={filterPanelRef} open={filterOpen} anchorRef={filterRef} maxWidth={320}>
                <div className="p-4 space-y-4">
                  {/* Categoría */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Categoría</p>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((c) => {
                        const isActive = catFilter === c.value
                        return (
                          <button key={c.value} type="button" onClick={() => { setCatFilter(isActive ? '' : c.value); setPage(1) }}
                            className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                              isActive ? 'bg-primary-dark text-white border-primary-dark' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                            )}>
                            {c.label}
                            {isActive && <Check className="h-2.5 w-2.5 ml-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Stock */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Estado de stock</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[{v:'available',l:'Disponible',dot:'bg-emerald-400'},{v:'low_stock',l:'Pocas unidades',dot:'bg-amber-400'},{v:'out_of_stock',l:'Agotado',dot:'bg-amber-500'}].map(({v,l,dot}) => {
                        const isActive = stockStatusFilter === v
                        return (
                          <button key={v} type="button" onClick={() => { setStockStatusFilter((isActive ? '' : v) as '' | StockStatus); setPage(1) }}
                            className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                              isActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                            )}>
                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
                            {l}
                            {isActive && <Check className="h-2.5 w-2.5 ml-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Precio */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Precio</p>
                    <div className="flex items-center gap-2">
                      <Input className="h-8 text-xs rounded-full border-gray-200 flex-1" type="number" min={0} value={priceMin} onChange={(e) => { setPriceMin(e.target.value); setPage(1) }} placeholder="Mín. $" />
                      <span className="text-gray-400 text-xs">–</span>
                      <Input className="h-8 text-xs rounded-full border-gray-200 flex-1" type="number" min={0} value={priceMax} onChange={(e) => { setPriceMax(e.target.value); setPage(1) }} placeholder="Máx. $" />
                    </div>
                  </div>

                  {/* Stock qty */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Existencias</p>
                    <div className="flex items-center gap-2">
                      <Input className="h-8 text-xs rounded-full border-gray-200 flex-1" type="number" min={0} value={stockMin} onChange={(e) => { setStockMin(e.target.value); setPage(1) }} placeholder="Mín." />
                      <span className="text-gray-400 text-xs">–</span>
                      <Input className="h-8 text-xs rounded-full border-gray-200 flex-1" type="number" min={0} value={stockMax} onChange={(e) => { setStockMax(e.target.value); setPage(1) }} placeholder="Máx." />
                    </div>
                  </div>

                  {activeChips.length > 0 && (
                    <button type="button" onClick={() => { clearAllFilters(); setFilterOpen(false) }}
                      className="w-full text-center text-xs text-gray-400 hover:text-red-500 transition pt-1 border-t border-gray-100">
                      Limpiar filtros
                    </button>
                  )}
                </div>
          </AnchoredFilterPanel>
        </div>

        {activeChips.length > 0 && (
          <div className="min-w-0 max-w-[min(100%,40rem)] grow-0 shrink max-h-[4.75rem] overflow-y-auto overscroll-y-contain rounded-xl border border-orange-100 bg-orange-50/50 px-2 py-1.5">
            <div className="flex flex-wrap content-start gap-1.5 gap-y-1">
              {activeChips.map((chip) => (
                <span key={chip.id} className="inline-flex items-center gap-1 h-7 max-w-full rounded-full bg-orange-50 border border-orange-200 px-2.5 text-[11px] font-semibold text-orange-800 shrink-0">
                  <span className="truncate max-w-[14rem]">{chip.label}</span>
                  <button type="button" onClick={chip.onRemove} className="opacity-70 hover:opacity-100 shrink-0" aria-label="Quitar filtro">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bulk actions bar (same style as productos) ── */}
      <AnimatePresence>
        {someSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-2.5">
              <CheckSquare className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-bold text-gray-900">
                {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
              </span>
              <Separator orientation="vertical" className="hidden h-5 sm:block" />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs font-semibold"
                onClick={() => setBulkAdjustOpen(true)}
              >
                Ajuste masivo
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs font-semibold"
                onClick={() => setBulkAlertOpen(true)}
              >
                Alerta mínima masiva
              </Button>
              <span className="flex-1" />
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={() => setSelectedIds(new Set())}
              >
                Limpiar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Table ── */}
      <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
              <TableHead className="w-[4%] min-w-0 py-2 pl-6 pr-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                    allVisibleSelected ? 'bg-nurei-cta border-nurei-cta' : 'border-gray-300 hover:border-gray-400'
                  )}
                >
                  {allVisibleSelected && <Check className="w-3 h-3 text-gray-900" />}
                </button>
              </TableHead>
              <TableHead className="w-[5%] min-w-0 py-2 pl-2 pr-4" />
              <TableHead className="w-[30%] min-w-0 whitespace-normal p-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Producto
              </TableHead>
              <TableHead className="w-[12%] min-w-0 whitespace-normal p-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Categoría
              </TableHead>
              <TableHead className="w-[10%] min-w-0 whitespace-normal p-1.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                Stock
              </TableHead>
              <TableHead className="w-[11%] min-w-0 whitespace-normal p-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Estado
              </TableHead>
              <TableHead className="w-[8%] min-w-0 whitespace-normal p-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Alerta
              </TableHead>
              <TableHead className="w-[8%] min-w-0 whitespace-normal p-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Vendidos 30d
              </TableHead>
              <TableHead className="w-[12%] min-w-0 whitespace-normal p-1.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="border-b">
                  <TableCell className="py-2 pl-6 pr-2"><div className="w-4 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell className="py-2 pl-2 pr-4"><div className="w-10 h-10 bg-gray-100 rounded-lg animate-pulse" /></TableCell>
                  <TableCell><div className="w-32 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-16 h-4 bg-gray-100 rounded-full animate-pulse" /></TableCell>
                  <TableCell><div className="w-12 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-16 h-4 bg-gray-100 rounded-full animate-pulse" /></TableCell>
                  <TableCell><div className="w-8 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-8 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : paginatedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <div className="py-16 text-center">
                    <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 font-medium">No se encontraron productos</p>
                    <p className="text-xs text-gray-400 mt-1">Intenta cambiar los filtros</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => {
                const st = computeStockStatus(product)
                const catInfo = categories.find((c) => c.value === product.category)
                return (
                  <TableRow
                    key={product.id}
                    className={cn(
                      'border-b transition-colors group',
                      selectedIds.has(product.id) ? 'bg-primary-cyan/5' : 'hover:bg-gray-50/80'
                    )}
                  >
                    <TableCell className="min-w-0 py-2 pl-6 pr-2">
                      <button
                        type="button"
                        onClick={() => toggleSelect(product.id)}
                        className={cn(
                          'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                          selectedIds.has(product.id) ? 'bg-primary-cyan border-primary-cyan' : 'border-gray-300 hover:border-gray-400'
                        )}
                      >
                        {selectedIds.has(product.id) && <Check className="w-3 h-3 text-primary-dark" />}
                      </button>
                    </TableCell>
                    <TableCell className="min-w-0 py-2 pl-2 pr-4">
                      <div className="mx-auto h-9 w-9 max-w-full rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden">
                        {product.images?.[product.primary_image_index ?? 0] ? (
                          <img
                            src={product.images[product.primary_image_index ?? 0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 p-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-primary-dark">{product.name}</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-gray-400">{product.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 p-1.5">
                      <span
                        className="inline-block max-w-full truncate px-2 py-0.5 text-[11px] font-medium rounded-full"
                        style={catInfo?.color
                          ? { backgroundColor: `${catInfo.color}18`, borderColor: `${catInfo.color}55`, color: catInfo.color, border: '1px solid' }
                          : { backgroundColor: '#f3f4f6', color: '#4b5563' }}
                      >
                        {catInfo?.label ?? product.category}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-0 p-1.5 text-center">
                      <div className="inline-flex items-center justify-center gap-0.5">
                        <span
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            st === 'out_of_stock' ? 'text-amber-700' : st === 'low_stock' ? 'text-amber-700' : 'text-emerald-700'
                          )}
                        >
                          {product.stock_quantity ?? 0}
                        </span>
                        <button
                          type="button"
                          title="Ajustar inventario"
                          className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-primary-dark"
                          onClick={() => {
                            setAdjustProduct(product)
                            setAdjustKind('entrada'); setAdjustValue(''); setAdjustMotivo(MOTIVO_PRESETS[0]); setAdjustNota('')
                            setAdjustOpen(true)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 p-1.5">
                      <span className={cn('inline-block max-w-full truncate px-2 py-0.5 text-[11px] font-medium rounded-full', STATUS_COLORS[st])}>
                        {stockStatusLabel(st)}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-0 p-1.5 text-sm text-gray-500 tabular-nums">{product.low_stock_threshold ?? 5}</TableCell>
                    <TableCell className="min-w-0 p-1.5 text-sm text-gray-500 tabular-nums">{product.sold_30d ?? 0}</TableCell>
                    <TableCell className="min-w-0 max-w-full p-1 text-right">
                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-0.5">
                        <button
                          type="button"
                          title="Ajuste manual"
                          className="shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-primary-dark"
                          onClick={() => {
                            setAdjustProduct(product); setAdjustKind('entrada'); setAdjustValue('')
                            setAdjustMotivo(MOTIVO_PRESETS[0]); setAdjustNota(''); setAdjustOpen(true)
                          }}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Alerta mínima"
                          className="shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-primary-dark"
                          onClick={() => { setAlertProduct(product); setAlertThreshold(String(product.low_stock_threshold ?? 5)); setAlertOpen(true) }}
                        >
                          <BellRing className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Ver movimientos"
                          className="shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-primary-dark"
                          onClick={() => openMovementsModal(product)}
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2.5">
          <p className="text-xs text-gray-500">
            {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''} · Página {page} de {totalPages}
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Siguiente
            </Button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════ */}

      {/* Ajuste manual */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent size="sm" className="p-0 duration-200">
          <div className="border-b border-gray-100 px-6 py-4 pr-12">
            <DialogTitle className="text-base font-semibold">Ajuste de inventario</DialogTitle>
            {adjustProduct && (
              <p className="text-sm text-gray-500 mt-0.5">{adjustProduct.name}</p>
            )}
          </div>
          {adjustProduct && (
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-500">
                Stock actual: <span className="font-semibold text-primary-dark">{adjustProduct.stock_quantity ?? 0}</span>
              </p>
              <Select
                value={adjustKind}
                onValueChange={(v) => setAdjustKind((v ?? 'entrada') as typeof adjustKind)}
              >
                <SelectTrigger className="h-9 text-sm rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada" className="text-sm">Entrada — sumar unidades</SelectItem>
                  <SelectItem value="salida" className="text-sm">Salida — restar unidades</SelectItem>
                  <SelectItem value="correccion" className="text-sm">Corrección — fijar stock total</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="h-9 text-sm rounded-xl"
                type="number"
                min={0}
                value={adjustValue}
                onChange={(e) => setAdjustValue(e.target.value)}
                placeholder={adjustKind === 'correccion' ? 'Nuevo stock total' : 'Cantidad'}
              />
              <Select value={adjustMotivo} onValueChange={(v) => setAdjustMotivo(v ?? MOTIVO_PRESETS[0])}>
                <SelectTrigger className="h-9 text-sm rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVO_PRESETS.map((m) => (
                    <SelectItem key={m} value={m} className="text-sm">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-9 text-sm rounded-xl"
                value={adjustNota}
                onChange={(e) => setAdjustNota(e.target.value)}
                placeholder="Nota opcional"
              />
              <Button className="h-9 w-full font-semibold rounded-xl" onClick={submitAdjust}>
                Guardar movimiento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Alerta mínima */}
      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent size="sm" className="p-0 duration-200" showCloseButton>
          <div className="border-b border-gray-100 px-6 py-4">
            <DialogTitle className="text-base font-semibold">Alerta de stock mínimo</DialogTitle>
            {alertProduct && <p className="text-sm text-gray-500 mt-0.5">{alertProduct.name}</p>}
          </div>
          {alertProduct && (
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-500">
                Umbral actual: <span className="font-semibold">{alertProduct.low_stock_threshold ?? 5}</span>
              </p>
              <Input
                className="h-9 text-sm rounded-xl"
                type="number"
                min={0}
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                placeholder="Unidades mínimas"
              />
              <Button className="h-9 w-full font-semibold rounded-xl" onClick={submitAlert}>
                Guardar alerta
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk ajuste */}
      <Dialog open={bulkAdjustOpen} onOpenChange={setBulkAdjustOpen}>
        <DialogContent size="sm" className="p-0 duration-200" showCloseButton>
          <div className="border-b border-gray-100 px-6 py-4">
            <DialogTitle className="text-base font-semibold">Ajuste masivo de inventario</DialogTitle>
            <p className="text-sm text-amber-700 mt-0.5">
              Afecta a <strong>{selectedIds.size}</strong> producto{selectedIds.size !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="px-6 py-5 space-y-3">
            <Select
              value={bulkAdjustKind}
              onValueChange={(v) => setBulkAdjustKind((v ?? 'entrada') as typeof bulkAdjustKind)}
            >
              <SelectTrigger className="h-9 w-full text-sm rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
                <SelectItem value="entrada" className="text-sm py-2.5">Entrada — sumar a todos</SelectItem>
                <SelectItem value="salida" className="text-sm py-2.5">Salida — restar a todos</SelectItem>
                <SelectItem value="correccion" className="text-sm py-2.5">Corrección — mismo total en todos</SelectItem>
              </SelectContent>
            </Select>
            <Input className="h-9 text-sm rounded-xl" value={bulkAdjustValue} onChange={(e) => setBulkAdjustValue(e.target.value)} placeholder="Valor" />
            <Select value={bulkAdjustMotivo} onValueChange={(v) => setBulkAdjustMotivo(v ?? MOTIVO_PRESETS[0])}>
              <SelectTrigger className="h-9 text-sm rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOTIVO_PRESETS.map((m) => (
                  <SelectItem key={m} value={m} className="text-sm">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input className="h-9 text-sm rounded-xl" value={bulkAdjustNota} onChange={(e) => setBulkAdjustNota(e.target.value)} placeholder="Nota opcional" />
            <Button className="h-9 w-full font-semibold rounded-xl" onClick={submitBulkAdjust}>
              Confirmar ajuste masivo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk alerta */}
      <Dialog open={bulkAlertOpen} onOpenChange={setBulkAlertOpen}>
        <DialogContent size="sm" className="p-0 duration-200" showCloseButton>
          <div className="border-b border-gray-100 px-6 py-4">
            <DialogTitle className="text-base font-semibold">Alerta mínima masiva</DialogTitle>
            <p className="text-sm text-amber-700 mt-0.5">
              Aplica el mismo umbral a <strong>{selectedIds.size}</strong> producto{selectedIds.size !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="px-6 py-5 space-y-3">
            <Input className="h-9 text-sm rounded-xl" type="number" min={0} value={bulkAlertValue} onChange={(e) => setBulkAlertValue(e.target.value)} placeholder="Ej: 5 unidades" />
            <Button className="h-9 w-full font-semibold rounded-xl" onClick={submitBulkAlert}>
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) resetImportModal(); setImportOpen(o) }}>
        <DialogContent size="xl" className="p-0 duration-200" showCloseButton>
          <div className="border-b border-gray-100 px-6 py-4">
            <DialogTitle className="text-base font-semibold">Importar inventario</DialogTitle>
            <p className="text-sm text-gray-500 mt-0.5">Valida el archivo antes de confirmar la importación</p>
          </div>
          <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-4">
            {/* Template download — inside the modal */}
            <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/80 p-3.5">
              <div>
                <p className="text-sm font-semibold text-gray-800">Plantilla CSV</p>
                <p className="text-xs text-gray-500 mt-0.5">Columnas: sku, nombre, categoría, stock, precio, alerta_stock</p>
              </div>
              <a
                href="/api/admin/inventory/import/template"
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
              >
                <Download className="h-4 w-4" /> Descargar
              </a>
            </div>

            {/* Drop zone */}
            <div
              {...getRootProps()}
              className={cn(
                'cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition',
                isDragActive ? 'border-primary-cyan bg-primary-cyan/5' : 'border-gray-200 bg-gray-50/80 hover:border-gray-300'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
              <p className="font-semibold text-gray-700 text-sm">Arrastra un CSV aquí o haz clic para elegir</p>
              {importBusy && <p className="text-xs text-gray-500 mt-1">Procesando…</p>}
            </div>

            {/* Summary */}
            {importSummary && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                <p className="font-semibold text-gray-800">
                  Resultado: <span className="text-emerald-700">{importSummary.valid} válidos</span>
                  {importSummary.invalid > 0 && (
                    <> · <span className="text-red-600">{importSummary.invalid} con error</span></>
                  )}
                  <span className="text-gray-400"> / {importSummary.total} filas totales</span>
                </p>
                {importErrors.length > 0 && (
                  <Button type="button" variant="outline" size="sm" className="mt-2 h-7 text-xs rounded-lg" onClick={downloadErrorsCsv}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Descargar reporte de errores
                  </Button>
                )}
              </div>
            )}

            {/* Preview */}
            {importPreview.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Vista previa</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">SKU</TableHead>
                      <TableHead className="text-xs">Nombre</TableHead>
                      <TableHead className="text-xs">Stock</TableHead>
                      <TableHead className="text-xs">Precio</TableHead>
                      <TableHead className="text-xs">Alerta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.map((row, i) => (
                      <TableRow key={i} className="text-sm">
                        <TableCell className="font-mono text-xs">{row.sku ?? '—'}</TableCell>
                        <TableCell className="text-xs">{row.nombre ?? '—'}</TableCell>
                        <TableCell className="text-xs">{row.stock ?? '—'}</TableCell>
                        <TableCell className="text-xs">{row.precio ?? '—'}</TableCell>
                        <TableCell className="text-xs">{row.alerta_stock ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <Button
              className="h-9 w-full font-semibold rounded-xl"
              disabled={!importValidRows.length || importBusy}
              onClick={confirmImport}
            >
              {importBusy
                ? 'Importando…'
                : importValidRows.length > 0
                ? `Confirmar importación (${importValidRows.length} registros)`
                : 'Carga un archivo CSV para importar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Movements modal */}
      <Dialog open={movementsModalOpen} onOpenChange={setMovementsModalOpen}>
        <DialogContent
          size="xl"
          className="p-0 overflow-hidden flex flex-col min-h-[70vh] duration-200 data-[closed]:duration-200"
          showCloseButton
        >
          {/* Gradient header with system color + product identity */}
          <div className="relative overflow-hidden bg-gradient-to-r from-primary-dark to-primary-dark/90 px-6 py-5 border-b border-white/10">
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary-cyan/80">
                <History className="h-3.5 w-3.5" />
                Historial de movimientos
              </div>
              <DialogTitle className="sr-only">
                Movimientos — {selectedProduct?.name}
              </DialogTitle>
              {selectedProduct && (
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/20 shadow-sm">
                    <Package className="h-5 w-5 text-primary-cyan" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-white leading-tight truncate">{selectedProduct.name}</h2>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/60">
                      {selectedProduct.sku && (
                        <span className="font-mono">SKU: <span className="text-white/90 font-semibold">{selectedProduct.sku}</span></span>
                      )}
                      <span>Stock actual: <span className="text-white font-semibold tabular-nums">{selectedProduct.stock_quantity ?? 0}</span></span>
                      {typeof selectedProduct.low_stock_threshold === 'number' && (
                        <span>Alerta: <span className="text-white font-semibold tabular-nums">{selectedProduct.low_stock_threshold}</span></span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Input type="date" className="h-9 text-sm rounded-xl border-gray-200" value={movementDateFrom} onChange={(e) => setMovementDateFrom(e.target.value)} />
              <Input type="date" className="h-9 text-sm rounded-xl border-gray-200" value={movementDateTo} onChange={(e) => setMovementDateTo(e.target.value)} />
              <Select
                value={movementTypeFilter}
                onValueChange={(v) => setMovementTypeFilter((v ?? 'todos') as typeof movementTypeFilter)}
              >
                <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-sm">Todos los tipos</SelectItem>
                  {(Object.keys(MOVEMENT_TYPE_LABEL) as InventoryMovementType[]).map((t) => (
                    <SelectItem key={t} value={t} className="text-sm">{MOVEMENT_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1.5">
                <Input
                  className="h-9 flex-1 text-sm rounded-xl border-gray-200"
                  value={movementSearchDraft}
                  onChange={(e) => setMovementSearchDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setMovementSearchApplied(movementSearchDraft.trim()) }}
                  placeholder="Buscar…"
                />
                <Button type="button" className="h-9 shrink-0 px-3 text-sm rounded-xl" onClick={() => setMovementSearchApplied(movementSearchDraft.trim())}>
                  Buscar
                </Button>
              </div>
            </div>

            {/* Table — polished card */}
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              {modalLoading ? (
                <p className="text-sm text-gray-500 py-12 text-center">Cargando historial…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80 border-b border-gray-100">
                      <TableHead className="py-2.5">
                        <SortHeader active={movementSort.key === 'created_at'} dir={movementSort.dir} onClick={() => toggleSort('created_at')}>
                          Fecha
                        </SortHeader>
                      </TableHead>
                      <TableHead className="py-2.5">
                        <SortHeader active={movementSort.key === 'type'} dir={movementSort.dir} onClick={() => toggleSort('type')}>
                          Tipo
                        </SortHeader>
                      </TableHead>
                      <TableHead className="py-2.5">
                        <SortHeader active={movementSort.key === 'quantity'} dir={movementSort.dir} onClick={() => toggleSort('quantity')}>
                          Cant.
                        </SortHeader>
                      </TableHead>
                      <TableHead className="py-2.5 text-xs font-semibold text-gray-500">Detalle</TableHead>
                      <TableHead className="py-2.5 text-xs font-semibold text-gray-500">Referencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productMovementsFiltered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-2 text-gray-400">
                            <History className="h-8 w-8 opacity-40" />
                            <p className="text-sm">Sin movimientos para los filtros aplicados.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      productMovementsFiltered.map((movement) => {
                        const qty = movement.quantity ?? 0
                        const positive = qty >= 0
                        return (
                          <TableRow key={movement.id} className="border-b border-gray-50 last:border-0 hover:bg-amber-50/30 transition-colors">
                            <TableCell className="whitespace-nowrap text-xs text-gray-500">
                              {new Date(movement.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                {MOVEMENT_TYPE_LABEL[movement.type]}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={cn(
                                'inline-flex items-center justify-center min-w-[2.5rem] h-6 px-2 rounded-full text-[11px] font-bold tabular-nums',
                                positive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                              )}>
                                {positive ? '+' : ''}{qty}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[240px] truncate text-xs text-gray-600">
                              {movement.reason ?? '—'}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-gray-400">
                              {movement.reference ?? '—'}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M8 1a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5A.75.75 0 0 1 8 1ZM8 12a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
    </svg>
  )
}
