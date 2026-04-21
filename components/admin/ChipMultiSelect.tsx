'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChipOption {
  value: string
  label: string
  sublabel?: string
}

interface ChipMultiSelectProps {
  options: ChipOption[]
  value: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  maxItems?: number
  className?: string
  loading?: boolean
  onSearchChange?: (q: string) => void
}

export function ChipMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  maxItems,
  className,
  loading,
  onSearchChange,
}: ChipMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter((o) => {
    if (value.includes(o.value)) return false
    const q = query.toLowerCase()
    return !q || o.label.toLowerCase().includes(q) || (o.sublabel?.toLowerCase().includes(q) ?? false)
  })

  const selectedOptions = value.map((v) => options.find((o) => o.value === v)).filter(Boolean) as ChipOption[]

  const select = (val: string) => {
    if (maxItems && value.length >= maxItems) return
    onChange([...value, val])
    setQuery('')
    if (maxItems === 1) setOpen(false)
  }

  const remove = (val: string) => onChange(value.filter((v) => v !== val))

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        className={cn(
          'min-h-[40px] w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 cursor-pointer flex flex-wrap gap-1.5 items-center',
          open && 'ring-2 ring-primary-cyan/30 border-primary-cyan'
        )}
        onClick={() => setOpen((o) => !o)}
      >
        {selectedOptions.map((opt) => (
          <span
            key={opt.value}
            className="group inline-flex items-center gap-1 h-6 rounded-full bg-primary-cyan/10 border border-primary-cyan/30 px-2.5 text-[11px] font-semibold text-primary-dark shrink-0"
          >
            <span className="truncate max-w-[120px]">{opt.label}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(opt.value) }}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 ml-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {selectedOptions.length === 0 && (
          <span className="text-sm text-gray-400">{placeholder}</span>
        )}
        <ChevronDown className={cn('ml-auto h-4 w-4 text-gray-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); onSearchChange?.(e.target.value) }}
                onClick={(e) => e.stopPropagation()}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 rounded-lg outline-none"
              />
            </div>
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {loading && (
              <li className="px-3 py-2 text-xs text-gray-400">Cargando...</li>
            )}
            {!loading && filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-gray-400">Sin resultados</li>
            )}
            {!loading && filtered.map((opt) => (
              <li
                key={opt.value}
                onClick={(e) => { e.stopPropagation(); select(opt.value) }}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-primary-cyan/5 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-primary-dark">{opt.label}</span>
                  {opt.sublabel && <span className="text-xs text-gray-400 ml-1.5">{opt.sublabel}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
