'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Image as ImageIcon, Upload, Grid, List, Search, Trash2, Download,
  Eye, Filter, X, FolderOpen, Check, Copy, HardDrive, Clock, FileImage,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { MediaItem } from '@/types'

type MimeFilter = 'all' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/svg+xml' | 'image/gif'
type ViewMode = 'grid' | 'list'

const MIME_LABELS: Record<MimeFilter, string> = {
  all: 'Todos',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/svg+xml': 'SVG',
  'image/gif': 'GIF',
}

function formatSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function mimeShortLabel(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/webp': 'WEBP',
    'image/svg+xml': 'SVG',
    'image/gif': 'GIF',
  }
  return map[mime] ?? mime.split('/')[1]?.toUpperCase() ?? 'IMG'
}

export default function MediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filterType, setFilterType] = useState<MimeFilter>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch media on mount
  useEffect(() => {
    fetchMedia()
  }, [])

  const fetchMedia = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/media')
      const json = await res.json()
      if (json.error) {
        toast.error(json.error)
      }
      setMedia(json.data ?? [])
    } catch {
      toast.error('Error al cargar archivos')
    } finally {
      setLoading(false)
    }
  }

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    for (const file of fileArray) {
      const fileKey = `${file.name}-${Date.now()}`
      setUploadingFiles((prev) => new Set([...prev, fileKey]))
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/admin/media', { method: 'POST', body: formData })
        const json = await res.json()
        if (json.error) {
          toast.error(`Error subiendo ${file.name}: ${json.error}`)
        } else if (json.data) {
          setMedia((prev) => [json.data, ...prev])
          toast.success(`${file.name} subido correctamente`)
        }
      } catch {
        toast.error(`Error subiendo ${file.name}`)
      } finally {
        setUploadingFiles((prev) => {
          const next = new Set(prev)
          next.delete(fileKey)
          return next
        })
      }
    }
    setUploadOpen(false)
  }

  const handleDelete = async (id: string) => {
    const item = media.find((m) => m.id === id)
    if (!item) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, url: item.url }),
      })
      const json = await res.json()
      if (json.error) {
        toast.error(json.error)
      } else {
        setMedia((prev) => prev.filter((m) => m.id !== id))
        setSelectedItems((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        if (previewItem?.id === id) setPreviewItem(null)
        toast.success('Archivo eliminado')
      }
    } catch {
      toast.error('Error al eliminar archivo')
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
    }
  }

  const handleBulkDelete = async () => {
    const items = media
      .filter((m) => selectedItems.has(m.id))
      .map((m) => ({ id: m.id, url: m.url }))
    if (items.length === 0) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const json = await res.json()
      if (json.error) {
        toast.error(json.error)
      } else {
        setMedia((prev) => prev.filter((m) => !selectedItems.has(m.id)))
        setSelectedItems(new Set())
        toast.success(`${items.length} archivos eliminados`)
      }
    } catch {
      toast.error('Error al eliminar archivos')
    } finally {
      setDeleting(false)
      setBulkDeleteConfirm(false)
    }
  }

  const filtered = media.filter((item) => {
    const matchesSearch = item.filename.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'all' || item.mime_type === filterType
    return matchesSearch && matchesType
  })

  const totalSize = media.reduce((acc, item) => acc + item.size_bytes, 0)
  const totalSizeFormatted = formatSize(totalSize)
  const recentCount = media.filter((item) => {
    const itemDate = new Date(item.created_at)
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

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(true)
    toast.success('URL copiada al portapapeles')
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
    const files = e.dataTransfer.files
    if (files.length > 0) {
      uploadFiles(files)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      uploadFiles(files)
    }
    // Reset so the same file can be selected again
    e.target.value = ''
  }

  const filterLabel = MIME_LABELS[filterType]
  const isUploading = uploadingFiles.size > 0

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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-primary-cyan" />
            Multimedia
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Gestiona las imágenes de tu tienda
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
            <p className="text-xs text-gray-400">Tamano total</p>
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
                  {(Object.keys(MIME_LABELS) as MimeFilter[]).map((type) => (
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
                      <span className={filterType !== type ? 'ml-5.5' : ''}>{MIME_LABELS[type]}</span>
                    </button>
                  ))}
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
              aria-label="Vista en cuadricula"
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

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 text-primary-cyan animate-spin" />
          <p className="text-sm text-gray-400">Cargando archivos...</p>
        </div>
      )}

      {/* Grid view */}
      {!loading && viewMode === 'grid' && filtered.length > 0 && (
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
                {/* Thumbnail */}
                <div className="relative aspect-square">
                  <img
                    src={item.thumbnail_url ?? item.url}
                    alt={item.alt_text ?? item.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(item.id)}
                    className={cn(
                      'absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all min-w-[44px] min-h-[44px] -mt-[9px] -ml-[9px] bg-transparent',
                      selectedItems.has(item.id)
                        ? 'border-primary-cyan bg-primary-cyan'
                        : 'border-white/80 bg-black/10 opacity-0 group-hover:opacity-100'
                    )}
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
                      className="text-[10px] font-medium bg-amber-50 text-amber-600"
                    >
                      {mimeShortLabel(item.mime_type)}
                    </Badge>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs font-medium text-primary-dark truncate" title={item.filename}>
                    {item.filename}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-gray-400">{formatSize(item.size_bytes)}</span>
                    <span className="text-[10px] text-gray-400">{formatDate(item.created_at)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* List view */}
      {!loading && viewMode === 'list' && filtered.length > 0 && (
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
            <span>Tamano</span>
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
                  <img
                    src={item.thumbnail_url ?? item.url}
                    alt={item.alt_text ?? item.filename}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary-dark truncate">{item.filename}</p>
                    <p className="text-[11px] text-gray-400 sm:hidden">{formatSize(item.size_bytes)} &middot; {formatDate(item.created_at)}</p>
                  </div>
                </div>

                {/* Type */}
                <div className="hidden sm:block">
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium bg-amber-50 text-amber-600"
                  >
                    {mimeShortLabel(item.mime_type)}
                  </Badge>
                </div>

                {/* Size */}
                <span className="hidden sm:block text-sm text-gray-500">{formatSize(item.size_bytes)}</span>

                {/* Date */}
                <span className="hidden sm:block text-sm text-gray-400">{formatDate(item.created_at)}</span>

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
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-200" />
          <p className="text-gray-400 font-medium">No se encontraron archivos</p>
          <p className="text-sm text-gray-300 mt-1">
            {search || filterType !== 'all'
              ? 'Intenta cambiar los filtros de busqueda'
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
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer relative',
                isDragging
                  ? 'border-primary-cyan bg-primary-cyan/5 scale-[1.02]'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              {isUploading && (
                <div className="absolute inset-0 bg-white/80 rounded-2xl flex flex-col items-center justify-center z-10">
                  <Loader2 className="w-8 h-8 text-primary-cyan animate-spin" />
                  <p className="text-sm text-gray-500 mt-2">Subiendo {uploadingFiles.size} archivo(s)...</p>
                </div>
              )}
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
                Arrastra archivos aqui
              </p>
              <p className="text-xs text-gray-400 mt-1">
                o haz clic para seleccionar
              </p>
              <p className="text-[10px] text-gray-300 mt-3">
                JPG, PNG, SVG, WebP, GIF &middot; Max. 5 MB
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setUploadOpen(false)}>
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-1" />
                )}
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
              <span className="truncate">{previewItem?.filename}</span>
            </DialogTitle>
          </DialogHeader>
          {previewItem && (
            <div className="space-y-4 mt-2">
              {/* Large preview */}
              <div className="w-full rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
                <img
                  src={previewItem.url}
                  alt={previewItem.alt_text ?? previewItem.filename}
                  className="max-w-full max-h-[400px] object-contain"
                />
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Nombre</p>
                  <p className="text-sm font-medium text-primary-dark mt-0.5 truncate">{previewItem.filename}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Tamano</p>
                  <p className="text-sm font-medium text-primary-dark mt-0.5">{formatSize(previewItem.size_bytes)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Tipo</p>
                  <p className="text-sm font-medium text-primary-dark mt-0.5">{previewItem.mime_type}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Fecha</p>
                  <p className="text-sm font-medium text-primary-dark mt-0.5">{formatDate(previewItem.created_at)}</p>
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
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    const a = document.createElement('a')
                    a.href = previewItem.url
                    a.download = previewItem.filename
                    a.target = '_blank'
                    a.click()
                  }}
                >
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
            Esta accion no se puede deshacer. El archivo sera eliminado permanentemente.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-red-500 text-white hover:bg-red-600"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
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
            Esta accion no se puede deshacer. Los archivos seleccionados seran eliminados permanentemente.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setBulkDeleteConfirm(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-red-500 text-white hover:bg-red-600"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
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
