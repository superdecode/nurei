'use client'

import { useState } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Plus, GripVertical, Edit2, Trash2, ChevronRight, Save, X,
  FolderTree, Search, Eye, EyeOff, Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
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

const INITIAL_CATEGORIES: Category[] = [
  { id: '1', name: 'Ramen', slug: 'ramen', emoji: '🍜', color: '#F59E0B', description: 'Ramen instantáneo y fresco de diversas regiones', is_active: true, order: 0, productCount: 4 },
  { id: '2', name: 'Dumplings', slug: 'dumplings', emoji: '🥟', color: '#00E5FF', description: 'Gyoza, shumai, bao y otras empanadillas asiáticas', is_active: true, order: 1, productCount: 3 },
  { id: '3', name: 'Snacks Crunchy', slug: 'snacks-crunchy', emoji: '🍘', color: '#8B5CF6', description: 'Snacks crujientes de arroz, algas y maíz', is_active: true, order: 2, productCount: 2 },
  { id: '4', name: 'Salsa & Condimentos', slug: 'salsas-condimentos', emoji: '🌶️', color: '#EF4444', description: 'Salsas, pastas y aderezos asiáticos', is_active: true, order: 3, productCount: 2 },
  { id: '5', name: 'Bebidas', slug: 'bebidas', emoji: '🧋', color: '#0A1F2F', description: 'Bubble tea, matcha, té de cebada y más', is_active: true, order: 4, productCount: 2 },
  { id: '6', name: 'Dulces & Postres', slug: 'dulces-postres', emoji: '🍡', color: '#DC2626', description: 'Mochi, pocky, daifuku y dulces asiáticos', is_active: true, order: 5, productCount: 2 },
  { id: '7', name: 'Edición Limitada', slug: 'edicion-limitada', emoji: '⭐', color: '#10B981', description: 'Productos de temporada y colaboraciones especiales', is_active: false, order: 6, productCount: 0 },
  { id: '8', name: 'Otros', slug: 'otros', emoji: '🛒', color: '#6B7280', description: 'Utensilios, accesorios y artículos de cocina asiática', is_active: false, order: 7, productCount: 0 },
]

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState(INITIAL_CATEGORIES)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '', slug: '', emoji: '🍹', color: '#00E5FF', description: '', is_active: true,
  })

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
    setFormData({ name: cat.name, slug: cat.slug, emoji: cat.emoji, color: cat.color, description: cat.description, is_active: cat.is_active })
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!formData.name.trim()) return
    const slug = formData.slug || generateSlug(formData.name)

    if (editingCategory) {
      setCategories((prev) =>
        prev.map((c) => c.id === editingCategory.id ? { ...c, ...formData, slug } : c)
      )
    } else {
      const newCat: Category = {
        id: `cat-${Date.now()}`,
        ...formData,
        slug,
        order: categories.length,
        productCount: 0,
      }
      setCategories((prev) => [...prev, newCat])
    }
    setDialogOpen(false)
  }

  const handleDelete = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id))
    setDeleteConfirm(null)
  }

  const toggleActive = (id: string) => {
    setCategories((prev) =>
      prev.map((c) => c.id === id ? { ...c, is_active: !c.is_active } : c)
    )
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
        onReorder={(newOrder) => setCategories(newOrder)}
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
                    onClick={() => toggleActive(cat.id)}
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
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {/* Gradient header */}
          <div className="bg-gradient-to-r from-primary-dark to-[#0D3050] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-cyan/20 flex items-center justify-center">
                <FolderTree className="w-4.5 h-4.5 text-primary-cyan" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {editingCategory ? 'Editar categoría' : 'Nueva categoría'}
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  {editingCategory ? `Modificando: ${editingCategory.name}` : 'Completa los campos para crear la categoría'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
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

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1 rounded-xl h-10" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold rounded-xl h-10" onClick={handleSave}>
                <Save className="w-4 h-4 mr-1.5" />
                {editingCategory ? 'Guardar cambios' : 'Crear categoría'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Eliminar categoría</h2>
                <p className="text-xs text-white/70 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">Los productos asignados a esta categoría no serán eliminados, pero quedarán sin categoría.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button
                className="flex-1 bg-error text-white hover:bg-error/90 rounded-xl"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              >
                Sí, eliminar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
