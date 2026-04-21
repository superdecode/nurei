'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  hint?: string
  value: string
  onChange: (url: string) => void
  accept?: string
  previewClassName?: string
  compact?: boolean
  /** Horizontal strip: menos alto, mejor uso del espacio (logo + favicon). */
  layout?: 'vertical' | 'horizontal'
}

/** Subida a `/api/admin/media` — mismo flujo que imágenes en crear producto. */
export function SettingsImageField({
  label,
  hint,
  value,
  onChange,
  accept = 'image/png,image/jpeg,image/webp,image/svg+xml,.ico',
  previewClassName,
  compact,
  layout = 'vertical',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/admin/media', { method: 'POST', body: fd })
        const json = await res.json()
        if (json.data?.url) {
          onChange(json.data.url)
          toast.success(`${file.name} subida`)
        } else {
          toast.error(json.error ?? 'Error al subir')
        }
      }
    } catch {
      toast.error('Error al subir archivo')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const isHorizontal = layout === 'horizontal'

  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={(e) => {
          e.preventDefault()
          void upload(e.dataTransfer.files)
        }}
        className={cn(
          'w-full border-2 border-dashed border-gray-200 rounded-xl transition-colors cursor-pointer bg-gray-50/50 hover:border-primary-cyan/50',
          uploading && 'opacity-60 pointer-events-none',
          isHorizontal
            ? cn(
                'flex flex-row items-center gap-3 text-left px-4 py-2.5 sm:py-3',
                compact ? 'gap-2.5 py-2 sm:py-2.5' : '',
              )
            : cn(
                'flex flex-col items-center justify-center gap-2 hover:border-primary-cyan/50',
                compact ? 'p-4 gap-1 min-h-[88px]' : 'p-5 gap-2 min-h-[112px]',
              ),
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => void upload(e.target.files)}
        />
        {uploading ? (
          <Loader2 className={cn('text-primary-cyan animate-spin shrink-0', isHorizontal ? 'w-5 h-5' : compact ? 'w-5 h-5' : 'w-6 h-6')} />
        ) : (
          <Upload
            className={cn(
              'text-gray-300 shrink-0',
              isHorizontal ? 'w-5 h-5' : compact ? 'w-5 h-5' : 'w-6 h-6',
            )}
          />
        )}
        {isHorizontal ? (
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 leading-tight">
              {uploading ? 'Subiendo…' : 'Clic o arrastra para subir'}
            </p>
            {hint && <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{hint}</p>}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400">
              {uploading ? 'Subiendo…' : 'Haz clic o arrastra para subir'}
            </p>
            {hint && <p className="text-[10px] text-gray-300">{hint}</p>}
          </>
        )}
      </button>
      {value && (
        <div className="mt-2 flex items-start gap-2">
          <img
            src={value}
            alt=""
            className={cn(
              'object-contain rounded-lg border border-gray-100 bg-white',
              previewClassName ?? (compact ? 'h-10 w-10' : 'h-12 max-w-[200px]'),
            )}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            title="Quitar imagen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
