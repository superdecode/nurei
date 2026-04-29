'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExportButtonProps {
  report: string
  dateFrom: string
  dateTo: string
  className?: string
}

export function ExportButton({ report, dateFrom, dateTo, className }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<'csv' | 'xlsx' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setLoading(format)
    setOpen(false)
    try {
      const url = `/api/admin/analytics/export/${report}?dateFrom=${dateFrom}&dateTo=${dateTo}&format=${format}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${report}_${dateFrom}_${dateTo}.${format}`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      // silently fail
    } finally {
      setLoading(null)
    }
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
        Exportar
        <ChevronDown size={11} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden min-w-[120px]">
          <button
            onClick={() => handleExport('csv')}
            className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 text-gray-700"
          >
            Descargar CSV
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 text-gray-700"
          >
            Descargar Excel
          </button>
        </div>
      )}
    </div>
  )
}
