'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SlidersHorizontal, RotateCcw, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/utils/format'
import type { FilterState } from './FilterSheet'
import { EMPTY_FILTERS } from './FilterSheet'

// ── Internal sub-components ────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 active:scale-95',
        active
          ? 'bg-nurei-cta border-nurei-cta text-gray-900 shadow-sm shadow-nurei-cta/20'
          : 'bg-white border-gray-200 text-gray-600 hover:border-yellow-300 hover:bg-yellow-50',
      )}
    >
      {active && <Check className="w-3 h-3 shrink-0" />}
      {label}
    </button>
  )
}

function RangeSlider({
  min, max, valueMin, valueMax, onChange,
}: {
  min: number; max: number; valueMin: number; valueMax: number
  onChange: (min: number, max: number) => void
}) {
  const range = max - min || 1
  const leftPct = ((valueMin - min) / range) * 100
  const rightPct = ((valueMax - min) / range) * 100

  return (
    <div className="space-y-2.5">
      <div className="flex justify-between text-xs font-bold tabular-nums">
        <span className="text-gray-900">{formatPrice(valueMin)}</span>
        <span className="text-gray-900">{formatPrice(valueMax)}</span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-gray-200" />
        <div
          className="absolute h-1.5 rounded-full bg-nurei-cta"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <input
          type="range" min={min} max={max} value={valueMin}
          onChange={(e) => onChange(Math.min(Number(e.target.value), valueMax - 1), valueMax)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
          style={{ zIndex: valueMin > max - 100 ? 5 : 3 }}
        />
        <input
          type="range" min={min} max={max} value={valueMax}
          onChange={(e) => onChange(valueMin, Math.max(Number(e.target.value), valueMin + 1))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
          style={{ zIndex: 4 }}
        />
        <div
          className="absolute w-4 h-4 rounded-full bg-white border-2 border-nurei-cta shadow-md pointer-events-none"
          style={{ left: `calc(${leftPct}% - 8px)` }}
        />
        <div
          className="absolute w-4 h-4 rounded-full bg-white border-2 border-nurei-cta shadow-md pointer-events-none"
          style={{ left: `calc(${rightPct}% - 8px)` }}
        />
      </div>
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────

interface FilterDropdownProps {
  availableCountries: string[]
  availableBrands: string[]
  absolutePriceMin: number
  absolutePriceMax: number
  filters: FilterState
  onApply: (filters: FilterState) => void
}

function getCount(f: FilterState) {
  return (
    f.countries.length +
    f.brands.length +
    (f.onlyAvailable ? 1 : 0) +
    (f.priceMin !== null || f.priceMax !== null ? 1 : 0)
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export function FilterDropdown({
  availableCountries, availableBrands,
  absolutePriceMin, absolutePriceMax,
  filters, onApply,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState<FilterState>(filters)
  const panelRef = useRef<HTMLDivElement>(null)

  // Sync local state when opening
  useEffect(() => {
    if (open) setLocal(filters)
  }, [open, filters])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    // slight delay so the trigger click doesn't immediately close
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 10)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handler)
    }
  }, [open])

  const effectivePriceMin = local.priceMin ?? absolutePriceMin
  const effectivePriceMax = local.priceMax ?? absolutePriceMax
  const activeCount = getCount(filters)
  const localCount = getCount(local)

  const toggleCountry = (c: string) =>
    setLocal((f) => ({
      ...f,
      countries: f.countries.includes(c) ? f.countries.filter((x) => x !== c) : [...f.countries, c],
    }))

  const toggleBrand = (b: string) =>
    setLocal((f) => ({
      ...f,
      brands: f.brands.includes(b) ? f.brands.filter((x) => x !== b) : [...f.brands, b],
    }))

  const handlePriceChange = (min: number, max: number) =>
    setLocal((f) => ({
      ...f,
      priceMin: min === absolutePriceMin ? null : min,
      priceMax: max === absolutePriceMax ? null : max,
    }))

  const handleApply = () => {
    onApply(local)
    setOpen(false)
  }

  const handleClear = () => {
    setLocal(EMPTY_FILTERS)
  }

  return (
    <div ref={panelRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold border transition-all duration-200 whitespace-nowrap',
          open || activeCount > 0
            ? 'bg-nurei-cta border-nurei-cta text-gray-900 shadow-sm'
            : 'bg-white border-gray-200 text-gray-600 hover:border-yellow-300 hover:bg-yellow-50',
        )}
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filtrar
        {activeCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-black"
          >
            {activeCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="absolute right-0 top-[calc(100%+8px)] w-[400px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
            style={{ transformOrigin: 'top right' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-sm font-black text-gray-900">Filtros</span>
                {localCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-nurei-cta text-gray-900">
                    {localCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto max-h-[420px] px-5 py-4 space-y-5">

              {/* Availability */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">Disponibilidad</p>
                <button
                  type="button"
                  onClick={() => setLocal((f) => ({ ...f, onlyAvailable: !f.onlyAvailable }))}
                  className={cn(
                    'flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all duration-200',
                    local.onlyAvailable
                      ? 'bg-nurei-cta/10 border-nurei-cta/40 text-gray-900'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100',
                  )}
                >
                  <span className="font-medium">Solo productos disponibles</span>
                  <div className={cn(
                    'w-10 h-5 rounded-full transition-colors duration-200 relative shrink-0',
                    local.onlyAvailable ? 'bg-nurei-cta' : 'bg-gray-300',
                  )}>
                    <motion.div
                      animate={{ x: local.onlyAvailable ? 20 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                    />
                  </div>
                </button>
              </div>

              {/* Price range */}
              {absolutePriceMax > absolutePriceMin && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">Rango de precio</p>
                  <div className="px-1">
                    <RangeSlider
                      min={absolutePriceMin}
                      max={absolutePriceMax}
                      valueMin={effectivePriceMin}
                      valueMax={effectivePriceMax}
                      onChange={handlePriceChange}
                    />
                  </div>
                </div>
              )}

              {/* Countries */}
              {availableCountries.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">País de origen</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableCountries.map((c) => (
                      <Chip key={c} label={c} active={local.countries.includes(c)} onClick={() => toggleCountry(c)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Brands */}
              {availableBrands.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">Marca</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableBrands.map((b) => (
                      <Chip key={b} label={b} active={local.brands.includes(b)} onClick={() => toggleBrand(b)} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Apply footer */}
            <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={handleApply}
                className="w-full h-10 rounded-xl bg-nurei-cta text-gray-900 font-black text-sm shadow-sm shadow-nurei-cta/20 hover:shadow-md active:brightness-95 transition-all"
              >
                {localCount > 0 ? `Aplicar · ${localCount} filtro${localCount !== 1 ? 's' : ''}` : 'Aplicar filtros'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
