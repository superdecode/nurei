'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Image as ImageIcon, Upload, Grid, List, Search, Trash2, Download,
  Eye, Filter, X, FolderOpen, Check, Copy, HardDrive, Clock, FileImage,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface MediaItem {
  id: string
  name: string
  type: 'image' | 'icon'
  size: string
  sizeBytes: number
  dimensions: string
  date: string
  color: string
  emoji: string
  url: string
}

const MOCK_MEDIA: MediaItem[] = [
  { id: '1', name: 'snack-karamucho.jpg', type: 'image', size: '245 KB', sizeBytes: 250880, dimensions: '800x600', date: '2026-03-20', color: '#F59E0B', emoji: '🍺', url: '/media/cerveza-victoria.jpg' },
  { id: '2', name: 'logo-nurei.png', type: 'icon', size: '89 KB', sizeBytes: 91136, dimensions: '512x512', date: '2026-03-18', color: '#FFD60A', emoji: '�', url: '/media/logo-nurei.png' },
  { id: '3', name: 'snack-pretz.jpg', type: 'image', size: '312 KB', sizeBytes: 319488, dimensions: '1024x768', date: '2026-03-17', color: '#10B981', emoji: '🥃', url: '/media/tequila-jimador.jpg' },
  { id: '4', name: 'banner-promo.jpg', type: 'image', size: '520 KB', sizeBytes: 532480, dimensions: '1920x600', date: '2026-03-15', color: '#8B5CF6', emoji: '🎉', url: '/media/banner-promo.jpg' },
  { id: '5', name: 'drink-calpis.jpg', type: 'image', size: '198 KB', sizeBytes: 202752, dimensions: '800x800', date: '2026-03-14', color: '#3B82F6', emoji: '🍸', url: '/media/vodka-absolut.jpg' },
  { id: '6', name: 'icono-delivery.png', type: 'icon', size: '12 KB', sizeBytes: 12288, dimensions: '64x64', date: '2026-03-13', color: '#EF4444', emoji: '🚚', url: '/media/icono-delivery.png' },
  { id: '7', name: 'ron-bacardi.jpg', type: 'image', size: '275 KB', sizeBytes: 281600, dimensions: '900x675', date: '2026-03-12', color: '#DC2626', emoji: '🍹', url: '/media/ron-bacardi.jpg' },
  { id: '8', name: 'whisky-johnnie.jpg', type: 'image', size: '340 KB', sizeBytes: 348160, dimensions: '1080x720', date: '2026-03-11', color: '#0A1F2F', emoji: '🥃', url: '/media/whisky-johnnie.jpg' },
  { id: '9', name: 'icono-carrito.png', type: 'icon', size: '8 KB', sizeBytes: 8192, dimensions: '48x48', date: '2026-03-10', color: '#F97316', emoji: '🛒', url: '/media/icono-carrito.png' },
  { id: '10', name: 'mezcal-amores.jpg', type: 'image', size: '290 KB', sizeBytes: 296960, dimensions: '850x640', date: '2026-03-09', color: '#10B981', emoji: '🌵', url: '/media/mezcal-amores.jpg' },
  { id: '11', name: 'vino-casillero.jpg', type: 'image', size: '415 KB', sizeBytes: 425000, dimensions: '1200x800', date: '2026-03-08', color: '#9333EA', emoji: '🍷', url: '/media/vino-casillero.jpg' },
  { id: '12', name: 'icono-edad.png', type: 'icon', size: '15 KB', sizeBytes: 15360, dimensions: '128x128', date: '2026-03-07', color: '#6B7280', emoji: '🔞', url: '/media/icono-edad.png' },
]

type FilterType = 'all' | 'image' | 'icon'
type ViewMode = 'grid' | 'list'

export default function MediaPage() {
  const [media, setMedia] = useState<MediaItem[]>(MOCK_MEDIA)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const filtered = media.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'all' || item.type === filterType
    return matchesSearch && matchesType
  })

  const totalSize = media.reduce((acc, item) => acc + item.sizeBytes, 0)
  const totalSizeFormatted = totalSize > 1048576
    ? `${(totalSize / 1048576).toFixed(1)} MB`
    : `${(totalSize / 1024).toFixed(0)} KB`
  const recentCount = media.filter((item) => {
    const itemDate = new Date(item.date)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return itemDate >= weekAgo
  }).length

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedItems.size === filtered.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filtered.map((item) => item.id)))
    }
  }

  const handleDelete = (id: string) => {
    setMedia((prev) => prev.filter((item) => item.id !== id))
    setSelectedItems((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setDeleteConfirm(null)
    if (previewItem?.id === id) setPreviewItem(null)
  }

  const handleBulkDelete = () => {
    setMedia((prev) => prev.filter((item) => !selectedItems.has(item.id)))
    setSelectedItems(new Set())
    setBulkDeleteConfirm(false)
  }

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const filterLabel = filterType === 'all' ? 'Todos' : filterType === 'image' ? 'Imágenes' : 'Íconos'

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.04 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-primary-cyan" />
            Multimedia
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Gestiona las imágenes e íconos de tu tienda
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedItems.size > 0 && (
            <Button
              variant="outline"
              className="text-red-500 border-red-200 hover:bg-red-50 gap-2"
              onClick={() => setBulkDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4" />
              Eliminar ({selectedItems.size})
            </Button>
          )}
          <Button
            onClick={() => setUploadOpen(true)}
            className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold gap-2"
          >
            <Upload className="w-4 h-4" />
            Subir archivo
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-cyan/10 flex items-center justify-center flex-shrink-0">
            <FileImage className="w-5 h-5 text-primary-cyan" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Total archivos</p>
            <p className="text-lg font-bold text-primary-dark">{media.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
            <HardDrive className="w-5 h-5 text-purple-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Tamaño total</p>
            <p className="text-lg font-bold text-primary-dark">{totalSizeFormatted}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-green-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Esta semana</p>
            <p className="text-lg font-bold text-primary-dark">{recentCount}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar archivo..."
            className="pl-10 h-10 border-gray-200"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filter dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              className="gap-2 h-10"
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <Filter className="w-4 h-4" />
              {filterLabel}
            </Button>
            <AnimatePresence>
              {filterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-gray-100 shadow-lg z-20 overflow-hidden min-w-[160px]"
                >
                  {(['all', 'image', 'icon'] as FilterType[]).map((type) => {
                    const label = type === 'all' ? 'Todos' : type === 'image' ? 'Imágenes' : 'Íconos'
                    return (
                      <button
                        key={type}
                        onClick={() => { setFilterType(type); setFilterOpen(false) }}
                        className={cn(
                          'flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left transition-colors',
                          filterType === type
                            ? 'bg-primary-cyan/10 text-primary-cyan font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {filterType === type && <Check className="w-3.5 h-3.5" />}
                        <span className={filterType !== type ? 'ml-5.5' : ''}>{label}</span>
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-md transition-all min-w-[44px] min-h-[44px] flex items-center justify-center',
                viewMode === 'grid'
                  ? 'bg-white shadow-sm text-primary-cyan'
                  : 'text-gray-400 hover:text-gray-600'
              )}
              aria-label="Vista en cuadrícula"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-md transition-all min-w-[44px] min-h-[44px] flex items-center justify-center',
                viewMode === 'list'
                  ? 'bg-white shadow-sm text-primary-cyan'
                  : 'text-gray-400 hover:text-gray-600'
              )}
              aria-label="Vista en lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Select all row */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <button
            onClick={toggleSelectAll}
            className={cn(
              'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
              selectedItems.size === filtered.length && filtered.length > 0
                ? 'bg-primary-cyan border-primary-cyan'
                : 'border-gray-300 hover:border-gray-400'
            )}
          >
            {selectedItems.size === filtered.length && filtered.length > 0 && (
              <Check className="w-3 h-3 text-primary-dark" />
            )}
          </button>
          <span>
            {selectedItems.size > 0
              ? `${selectedItems.size} de ${filtered.length} seleccionados`
              : `${filtered.length} archivos`}
          </span>
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && filtered.length > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((item) => (
              <motion.div
                key={item.id}
                variants={itemVariants}
                layout
                exit={{ opacity: 0, scale: 0.9 }}
                className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 overflow-hidden"
              >
                {/* Image placeholder */}
                <div className="relative aspect-square">
                  <div
                    className="w-full h-full flex items-center justify-center text-4xl"
                    style={{ backgroundColor: `${item.color}15` }}
                  >
                    {item.emoji}
                  </div>

                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(item.id)}
                    className={cn(
                      'absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all min-w-[44px] min-h-[44px] -mt-[9px] -ml-[9px] bg-transparent',
                      selectedItems.has(item.id)
                        ? 'border-primary-cyan bg-primary-cyan'
                        : 'border-white/80 bg-black/10 opacity-0 group-hover:opacity-100'
                    )}
                    style={selectedItems.has(item.id) ? {} : undefined}
                  >
                    {selectedItems.has(item.id) && <Check className="w-3.5 h-3.5 text-primary-dark" />}
                  </button>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => setPreviewItem(item)}
                      className="p-2.5 rounded-xl bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white transition-colors shadow-sm min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label="Vista previa"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(item.id)}
                      className="p-2.5 rounded-xl bg-white/90 backdrop-blur-sm text-red-500 hover:bg-white transition-colors shadow-sm min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Type badge */}
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] font-medium',
                        item.type === 'icon'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-amber-50 text-amber-600'
                      )}
                    >
                      {item.type === 'icon' ? 'ÍCONO' : 'IMG'}
                    </Badge>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs font-medium text-primary-dark truncate" title={item.name}>
                    {item.name}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-gray-400">{item.size}</span>
                    <span className="text-[10px] text-gray-400">{formatDate(item.date)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* List view */}
      {viewMode === 'list' && filtered.length > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
        >
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[auto_1fr_100px_80px_100px_100px] gap-4 items-center px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wider">
            <div className="w-5" />
            <span>Nombre</span>
            <span>Tipo</span>
            <span>Tamaño</span>
            <span>Fecha</span>
            <span className="text-right">Acciones</span>
          </div>

          <AnimatePresence mode="popLayout">
            {filtered.map((item) => (
              <motion.div
                key={item.id}
                variants={itemVariants}
                layout
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 sm:grid sm:grid-cols-[auto_1fr_100px_80px_100px_100px] sm:gap-4 px-4 py-3 border-b border-gray-50 hover:bg-gray-50/50 transition-colors group"
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(item.id)}
                  className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] -m-[9.5px]',
                    selectedItems.has(item.id)
                      ? 'bg-primary-cyan border-primary-cyan'
                      : 'border-gray-300 hover:border-gray-400'
                  )}
                >
                  {selectedItems.has(item.id) && <Check className="w-3 h-3 text-primary-dark" />}
                </button>

                {/* Name with thumbnail */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: `${item.color}15` }}
                  >
                    {item.emoji}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary-dark truncate">{item.name}</p>
                    <p className="text-[11px] text-gray-400 sm:hidden">{item.size} &middot; {formatDate(item.date)}</p>
                  </div>
                </div>

                {/* Type */}
                <div className="hidden sm:block">
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] font-medium',
                      item.type === 'icon'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-amber-50 text-amber-600'
                    )}
                  >
                    {item.type === 'icon' ? 'Ícono' : 'Imagen'}
                  </Badge>
                </div>

                {/* Size */}
                <span className="hidden sm:block text-sm text-gray-500">{item.size}</span>

                {/* Date */}
                <span className="hidden sm:block text-sm text-gray-400">{formatDate(item.date)}</span>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => setPreviewItem(item)}
                    className="p-2 rounded-lg text-gray-400 hover:text-primary-cyan hover:bg-primary-cyan/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Vista previa"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(item.id)}
                    className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-200" />
          <p className="text-gray-400 font-medium">No se encontraron archivos</p>
          <p className="text-sm text-gray-300 mt-1">
            {search || filterType !== 'all'
              ? 'Intenta cambiar los filtros de búsqueda'
              : 'Sube tu primer archivo para comenzar'}
          </p>
          {!search && filterType === 'all' && (
            <Button
              onClick={() => setUploadOpen(true)}
              className="mt-4 bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold gap-2"
            >
              <Upload className="w-4 h-4" />
              Subir archivo
            </Button>
          )}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary-cyan" />
              Subir archivos
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer',
                isDragging
                  ? 'border-primary-cyan bg-primary-cyan/5 scale-[1.02]'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div className={cn(
                'w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-colors',
                isDragging ? 'bg-primary-cyan/10' : 'bg-gray-100'
              )}>
                <Upload className={cn(
                  'w-6 h-6 transition-colors',
                  isDragging ? 'text-primary-cyan' : 'text-gray-400'
                )} />
              </div>
              <p className="text-sm font-medium text-primary-dark">
                Arrastra archivos aquí
              </p>
              <p className="text-xs text-gray-400 mt-1">
                o haz clic para seleccionar
              </p>
              <p className="text-[10px] text-gray-300 mt-3">
                JPG, PNG, SVG, WebP &middot; Máx. 5 MB
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setUploadOpen(false)}>
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
              <Button className="flex-1 bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold">
                <Upload className="w-4 h-4 mr-1" />
                Seleccionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 truncate">
              <Eye className="w-5 h-5 text-primary-cyan flex-shrink-0" />
              <span className="truncate">{previewItem?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {previewItem && (
            <div className="space-y-4 mt-2">
              {/* Large preview */}
              <div
                className="w-full aspect-video rounded-xl flex items-center justify-center text-7xl"
                style={{ backgroundColor: `${previewItem.color}15` }}
              >
                {previewItem.emoji}
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Nombre</p>
                  <p className="text-sm font-medium text-primary-dark mt-0.5 truncate">{previewItem.name}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Tamaño</p>
                  <p className="text-sm font-medium text-primary-dark mt-0.5">{previewItem.size}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Dimensiones</p>
                  <p className="text-sm font-medium text-primary-dark mt-0.5">{previewItem.dimensions} px</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Fecha</p>
                  <p className="text-sm font-medium text-primary-dark mt-0.5">{formatDate(previewItem.date)}</p>
                </div>
              </div>

              {/* URL copy */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100 truncate">
                    {previewItem.url}
                  </code>
                  <button
                    onClick={() => handleCopyUrl(previewItem.url)}
                    className={cn(
                      'p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center',
                      copiedUrl
                        ? 'bg-green-50 text-green-500'
                        : 'bg-white border border-gray-100 text-gray-400 hover:text-primary-cyan hover:border-primary-cyan/30'
                    )}
                    aria-label="Copiar URL"
                  >
                    {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 gap-2">
                  <Download className="w-4 h-4" />
                  Descargar
                </Button>
                <Button
                  className="flex-1 gap-2 bg-red-500 text-white hover:bg-red-600"
                  onClick={() => { setPreviewItem(null); setDeleteConfirm(previewItem.id) }}
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar archivo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Esta acción no se puede deshacer. El archivo será eliminado permanentemente.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-red-500 text-white hover:bg-red-600"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation dialog */}
      <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar {selectedItems.size} archivos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Esta acción no se puede deshacer. Los archivos seleccionados serán eliminados permanentemente.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setBulkDeleteConfirm(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-red-500 text-white hover:bg-red-600"
              onClick={handleBulkDelete}
            >
              Eliminar todos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Click-away for filter dropdown */}
      {filterOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setFilterOpen(false)}
        />
      )}
    </div>
  )
}
