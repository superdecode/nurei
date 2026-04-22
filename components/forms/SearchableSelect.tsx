'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type SearchableSelectProps = {
  id?: string
  label: string
  value: string
  options: string[]
  onChange: (next: string) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  error?: string
  /** When true, value must match an option exactly (selection-only). */
  requireSelection?: boolean
  className?: string
}

export function SearchableSelect({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = 'Buscar y seleccionar…',
  disabled,
  loading,
  error,
  requireSelection = true,
  className,
}: SearchableSelectProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [options, query])

  const pick = useCallback(
    (opt: string) => {
      onChange(opt)
      setQuery(opt)
      setOpen(false)
    },
    [onChange],
  )

  const onInputBlur = useCallback(() => {
    window.setTimeout(() => {
      if (!requireSelection || options.length === 0) return
      const trimmed = query.trim()
      if (!trimmed) {
        if (value) onChange('')
        return
      }
      const exact = options.find((o) => o.toLowerCase() === trimmed.toLowerCase())
      if (exact) {
        if (exact !== value) onChange(exact)
        setQuery(exact)
        return
      }
      const partial = options.find((o) => o.toLowerCase().includes(trimmed.toLowerCase()))
      if (partial) {
        onChange(partial)
        setQuery(partial)
        return
      }
      if (value) {
        setQuery(value)
      } else {
        setQuery('')
      }
    }, 120)
  }, [onChange, options, query, requireSelection, value])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <label htmlFor={fieldId} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={fieldId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          disabled={disabled || loading}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={onInputBlur}
          placeholder={loading ? 'Cargando…' : placeholder}
          autoComplete="off"
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-9',
            error && 'border-red-500 focus-visible:ring-red-500/40',
          )}
        />
        <ChevronDown
          className={cn(
            'pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </div>
      {open && !disabled && !loading && (
        <div
          ref={listRef}
          className="absolute z-[80] mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">Sin coincidencias</p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50',
                  opt === value && 'bg-primary-cyan/10',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(opt)}
              >
                <span className="truncate">{opt}</span>
                {opt === value && <Check className="h-4 w-4 shrink-0 text-primary-cyan" />}
              </button>
            ))
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
