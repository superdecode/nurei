'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PickerOption {
  id: string
  label: string
  sublabel?: string | null
}

interface Props {
  label: string
  placeholder?: string
  value: PickerOption | null
  onChange: (option: PickerOption | null) => void
  // Returns options for a search term (empty term = recent/top)
  fetchOptions: (search: string) => Promise<PickerOption[]>
}

export function EntityPicker({ label, placeholder, value, onChange, fetchOptions }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<PickerOption[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const results = await fetchOptions(search)
        if (active) setOptions(results)
      } finally {
        if (active) setLoading(false)
      }
    }, 250)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [search, open, fetchOptions])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="space-y-1" ref={containerRef}>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {value ? (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{value.label}</p>
            {value.sublabel ? <p className="truncate text-xs text-gray-400">{value.sublabel}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-2 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder={placeholder ?? 'Buscar...'}
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          {open && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-100 bg-white p-1 shadow-lg">
              {loading ? (
                <p className="px-3 py-2 text-xs text-gray-400">Buscando...</p>
              ) : options.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">Sin resultados</p>
              ) : (
                options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChange(opt)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-900">{opt.label}</span>
                      {opt.sublabel ? <span className="block truncate text-xs text-gray-400">{opt.sublabel}</span> : null}
                    </span>
                    {value && (value as PickerOption).id === opt.id ? <Check className="h-4 w-4 text-primary-cyan" /> : null}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Shared fetchers backed by existing admin endpoints
export async function fetchCustomerOptions(search: string): Promise<PickerOption[]> {
  const url = new URL('/api/admin/customers', window.location.origin)
  if (search) url.searchParams.set('search', search)
  url.searchParams.set('limit', '20')
  const res = await fetch(url.toString())
  if (!res.ok) return []
  const json = await res.json()
  const rows = (json.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null; phone: string | null }>
  return rows.map((r) => ({
    id: r.id,
    label: r.full_name || r.email || r.phone || 'Cliente',
    sublabel: r.email || r.phone,
  }))
}

export async function fetchCompanyOptions(search: string): Promise<PickerOption[]> {
  const url = new URL('/api/admin/crm/companies', window.location.origin)
  if (search) url.searchParams.set('search', search)
  const res = await fetch(url.toString())
  if (!res.ok) return []
  const json = await res.json()
  const rows = (json.data ?? []) as Array<{ id: string; name: string; industry: string | null }>
  return rows.map((r) => ({ id: r.id, label: r.name, sublabel: r.industry }))
}
