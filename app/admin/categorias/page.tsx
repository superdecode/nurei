'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Plus, GripVertical, Edit2, Trash2, ChevronRight, Save, X,
  FolderTree, Search, ToggleLeft, ToggleRight, AlertTriangle, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Category {
  id: string
  name: string
  slug: string
  emoji: string
  color: string
  description: string
  is_active: boolean
  position?: number
  productCount: number
}


function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [toggleConfirm, setToggleConfirm] = useState<Category | null>(null)

  const [formData, setFormData] = useState({
    name: '', slug: '', emoji: '🍹', color: '#00E5FF', description: '', is_active: true,
  })

  const loadCategories = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/categories')
      const json = await res.json()
      if (json.data) setCategories(json.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditingCategory(null)
    setFormData({ name: '', slug: '', emoji: '🍹', color: '#00E5FF', description: '', is_active: true })
    setDialogOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditingCategory(cat)
    setFormData({ name: cat.name, slug: cat.slug, emoji: cat.emoji || '📦', color: cat.color || '#6B7280', description: cat.description || '', is_active: cat.is_active })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) return
    const slug = formData.slug || generateSlug(formData.name)

    try {
      if (editingCategory) {
        await fetch('/api/admin/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, slug, id: editingCategory.id }),
        })
      } else {
        await fetch('/api/admin/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, slug, sort_order: categories.length, position: categories.length }),
        })
      }
      loadCategories()
      setDialogOpen(false)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/admin/categories?id=${id}`, { method: 'DELETE' })
      loadCategories()
      setDeleteConfirm(null)
    } catch (err) {
      console.error(err)
    }
  }

  const toggleActive = async (cat: Category) => {
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cat.id, is_active: !cat.is_active }),
      })
      if (!res.ok) throw new Error('toggle_failed')
      loadCategories()
      toast.success(cat.is_active ? 'Categoría desactivada' : 'Categoría activada')
    } catch (err) {
      console.error(err)
      toast.error('No se pudo actualizar el estado')
    }
  }

  const handleReorder = (newOrder: Category[]) => {
    setCategories(newOrder)
  }

  const persistReorder = async () => {
    if (search.trim()) return
    const backup = [...categories]
    setReordering(true)
    try {
      await fetch('/api/admin/categories/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: categories.map((c) => c.id) }),
      })
      toast.success('Orden actualizado — así se mostrarán las categorías en el menú')
    } catch (err) {
      setCategories(backup)
      toast.error('No se pudo actualizar el orden')
    } finally {
      setReordering(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-primary-cyan" />
            Categorías
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{categories.length} categorías · Arrastra para reordenar</p>
        </div>
        {reordering && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            Guardando orden...
          </span>
        )}
        <Button onClick={openCreate} className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold gap-2">
          <Plus className="w-4 h-4" />
          Nueva categoría
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar categoría..."
          className="pl-10 h-10 border-gray-200"
        />
      </div>

      {/* Reorderable list */}
      <Reorder.Group
        axis="y"
        values={filtered}
        onReorder={handleReorder}
        layoutScroll
        className="space-y-2"
      >
        <AnimatePresence>
          {filtered.map((cat) => (
            <Reorder.Item
              key={cat.id}
              value={cat}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.16 }}
              dragSnapToOrigin
              dragListener={!search.trim()}
              onDragEnd={() => { void persistReorder() }}
              className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all"
            >
              <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
                {/* Drag handle */}
                <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 touch-target flex-shrink-0">
                  <GripVertical className="w-5 h-5" />
                </div>

                {/* Emoji + color */}
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0"
                  style={{ backgroundColor: `${cat.color}15` }}
                >
                  {cat.emoji}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-primary-dark truncate">{cat.name}</h3>
                    {!cat.is_active && (
                      <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-400">Inactiva</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    /{cat.slug} · {cat.productCount} productos
                  </p>
                </div>

                {/* Product count badge */}
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-cyan/10 text-xs text-primary-dark border border-primary-cyan/20">
                  <Layers className="w-3 h-3" />
                  {cat.productCount}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setToggleConfirm(cat)}
                    className="group/btn relative p-2 rounded-lg transition-colors text-gray-400 hover:bg-gray-100"
                    title={cat.is_active ? 'Desactivar' : 'Activar'}
                  >
                    {cat.is_active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-gray-900 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover/btn:opacity-100">
                      {cat.is_active ? 'Desactivar' : 'Activar'}
                    </span>
                  </button>
                  <button
                    onClick={() => openEdit(cat)}
                    className="group/btn relative p-2 rounded-lg text-gray-400 hover:text-primary-cyan hover:bg-primary-cyan/10 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-gray-900 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover/btn:opacity-100">
                      Editar
                    </span>
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(cat.id)}
                    className="group/btn relative p-2 rounded-lg text-gray-300 hover:text-error hover:bg-error/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-gray-900 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover/btn:opacity-100">
                      Eliminar
                    </span>
                  </button>
                </div>
              </div>
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No se encontraron categorías</p>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg" className="p-0 overflow-hidden flex flex-col">
          {/* Header Fixed */}
          <div className="bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#f59e0bb3] px-8 py-5 relative overflow-hidden flex-shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-black/10 backdrop-blur-md flex items-center justify-center border border-black/5">
                <FolderTree className="w-5 h-5 text-gray-900" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">
                  {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                </DialogTitle>
                <p className="text-xs text-gray-900/60 font-medium whitespace-nowrap">Gestiona las categorías de productos</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            {/* Emoji + Name row */}
            <div className="flex gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Emoji</label>
                <Input
                  value={formData.emoji}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                  className="w-16 h-11 text-center text-2xl border-gray-200 shadow-sm"
                  maxLength={2}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Nombre *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({
                    ...formData,
                    name: e.target.value,
                    slug: generateSlug(e.target.value),
                  })}
                  placeholder="Ej: Ramen, Dumplings, Snacks..."
                  className="h-11 border-gray-200 shadow-sm"
                />
              </div>
            </div>

            {/* Slug */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Slug URL</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">/</span>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="nombre-categoria"
                  className="font-mono text-sm pl-5 border-gray-200 shadow-sm bg-gray-50"
                />
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">Color de acento</label>
              <div className="flex gap-2 flex-wrap">
                {['#00E5FF', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6', '#0A1F2F', '#DC2626', '#6B7280'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    className={cn(
                      'w-9 h-9 rounded-xl border-2 transition-all shadow-sm hover:scale-110',
                      formData.color === color ? 'border-primary-dark ring-2 ring-primary-dark/20 scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Descripción</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción corta de la categoría..."
                className="border-gray-200 shadow-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-primary-cyan/30 bg-primary-cyan/5 px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary-dark/70 mb-1">Productos asignados</p>
                <div className="flex items-center gap-2 text-primary-dark">
                  <Layers className="w-4 h-4" />
                  <span className="text-sm font-semibold">{editingCategory?.productCount ?? 0}</span>
                </div>
              </div>
              <div className="text-center sm:text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary-dark/70 mb-1.5">Estado</p>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))}
                  className={cn(
                    'group relative inline-flex h-8 min-w-[108px] items-center rounded-full border-2 px-1 transition-all duration-300 shadow-md hover:shadow-lg',
                    formData.is_active
                      ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100/70'
                      : 'bg-rose-50 border-rose-200 hover:bg-rose-100/70'
                  )}
                  aria-pressed={formData.is_active}
                >
                  <span
                    className={cn(
                      'h-6 w-6 rounded-full shadow-sm transition-all duration-300',
                      formData.is_active ? 'translate-x-[74px] bg-emerald-500' : 'translate-x-0 bg-rose-500'
                    )}
                  />
                  <span
                    className={cn(
                      'absolute text-[11px] font-semibold transition-colors',
                      formData.is_active ? 'text-emerald-700 left-4' : 'text-rose-700 right-4'
                    )}
                  >
                    {formData.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 flex justify-end gap-3 border-t bg-gray-50/50 flex-shrink-0">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl h-10 font-bold text-gray-500 hover:bg-gray-100 px-6"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-primary-dark text-white hover:bg-black font-bold rounded-xl h-10 px-8 shadow-md"
            >
              <Save className="w-4 h-4 mr-2" />
              {editingCategory ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent size="sm" className="p-0">
          <div className="bg-gradient-to-br from-red-500 to-red-600 px-8 py-5 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">Eliminar Categoría</DialogTitle>
                <p className="text-xs text-white/70">Esta acción no se puede deshacer</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <p className="text-sm text-gray-600 leading-relaxed">
              ¿Estás seguro de que deseas eliminar{' '}
              <span className="font-bold text-primary-dark underline decoration-error/30 underline-offset-4">
                {categories.find(c => c.id === deleteConfirm)?.name}
              </span>?
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl h-10 font-bold text-gray-500 hover:bg-gray-100"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                className="flex-1 rounded-xl h-10 font-bold shadow-sm"
              >
                Eliminar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toggleConfirm} onOpenChange={() => setToggleConfirm(null)}>
        <DialogContent size="sm" className="p-0">
          <div className="p-6 space-y-4">
            <DialogTitle className="text-base font-semibold text-gray-900">
              {toggleConfirm?.is_active ? 'Desactivar categoría' : 'Activar categoría'}
            </DialogTitle>
            <p className="text-sm text-gray-600 leading-relaxed">
              {toggleConfirm?.is_active
                ? `Se ocultará "${toggleConfirm?.name}" y se desactivarán ${toggleConfirm?.productCount ?? 0} productos del menú.`
                : `Se activará "${toggleConfirm?.name}" y se reactivarán ${toggleConfirm?.productCount ?? 0} productos relacionados.`}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setToggleConfirm(null)}>Cancelar</Button>
              <Button
                onClick={async () => {
                  if (!toggleConfirm) return
                  await toggleActive(toggleConfirm)
                  setToggleConfirm(null)
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
