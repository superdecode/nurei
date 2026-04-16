'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Plus, GripVertical, Edit2, Trash2, ChevronRight, Save, X,
  FolderTree, Search, Eye, EyeOff, Package, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Category {
  id: string
  name: string
  slug: string
  emoji: string
  color: string
  description: string
  is_active: boolean
  order: number
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
          body: JSON.stringify({ ...formData, slug, sort_order: categories.length }),
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
      await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cat.id, is_active: !cat.is_active }),
      })
      loadCategories()
    } catch (err) {
      console.error(err)
    }
  }

  const handleReorder = async (newOrder: Category[]) => {
    const backup = [...categories]
    setCategories(newOrder)
    try {
      await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reorder: true,
          orders: newOrder.map((c, i) => ({ id: c.id, sort_order: i }))
        }),
      })
    } catch (err) {
      setCategories(backup)
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
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 text-xs text-gray-500">
                  <Package className="w-3 h-3" />
                  {cat.productCount}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(cat)}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      cat.is_active ? 'text-success hover:bg-success/10' : 'text-gray-300 hover:bg-gray-100'
                    )}
                    title={cat.is_active ? 'Desactivar' : 'Activar'}
                  >
                    {cat.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(cat)}
                    className="p-2 rounded-lg text-gray-400 hover:text-primary-cyan hover:bg-primary-cyan/10 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(cat.id)}
                    className="p-2 rounded-lg text-gray-300 hover:text-error hover:bg-error/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
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

            {/* Active toggle */}
            <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl border border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-700">Categoría activa</p>
                <p className="text-xs text-gray-400">Visible en la tienda para los clientes</p>
              </div>
              <button
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative shadow-sm',
                  formData.is_active ? 'bg-primary-cyan' : 'bg-gray-200'
                )}
              >
                <span className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  formData.is_active ? 'left-[22px]' : 'left-1'
                )} />
              </button>
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
    </div>
  )
}
