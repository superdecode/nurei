'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, SlidersHorizontal, RotateCcw, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/utils/format'

export interface FilterState {
  countries: string[]
  brands: string[]
  priceMin: number | null
  priceMax: number | null
  onlyAvailable: boolean
}

export const EMPTY_FILTERS: FilterState = {
  countries: [],
  brands: [],
  priceMin: null,
  priceMax: null,
  onlyAvailable: false,
}

interface FilterSheetProps {
  open: boolean
  onClose: () => void
  availableCountries: string[]
  availableBrands: string[]
  absolutePriceMin: number
  absolutePriceMax: number
  filters: FilterState
  onApply: (filters: FilterState) => void
}

function Chip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
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
  min, max, valueMin, valueMax,
  onChange,
}: {
  min: number; max: number; valueMin: number; valueMax: number
  onChange: (min: number, max: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const range = max - min || 1

  const leftPct = ((valueMin - min) / range) * 100
  const rightPct = ((valueMax - min) / range) * 100

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(Number(e.target.value), valueMax - 1)
    onChange(v, valueMax)
  }

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(Number(e.target.value), valueMin + 1)
    onChange(valueMin, v)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs font-bold tabular-nums">
        <span className="text-gray-900">{formatPrice(valueMin)}</span>
        <span className="text-gray-900">{formatPrice(valueMax)}</span>
      </div>
      <div ref={trackRef} className="relative h-5 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-gray-200" />
        {/* Active track */}
        <div
          className="absolute h-1.5 rounded-full bg-nurei-cta"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        {/* Min thumb */}
        <input
          type="range"
          min={min}
          max={max}
          value={valueMin}
          onChange={handleMinChange}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
          style={{ zIndex: valueMin > max - 100 ? 5 : 3 }}
        />
        {/* Max thumb */}
        <input
          type="range"
          min={min}
          max={max}
          value={valueMax}
          onChange={handleMaxChange}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
          style={{ zIndex: 4 }}
        />
        {/* Visual thumbs */}
        <div
          className="absolute w-5 h-5 rounded-full bg-white border-2 border-nurei-cta shadow-md pointer-events-none transition-all"
          style={{ left: `calc(${leftPct}% - 10px)` }}
        />
        <div
          className="absolute w-5 h-5 rounded-full bg-white border-2 border-nurei-cta shadow-md pointer-events-none transition-all"
          style={{ left: `calc(${rightPct}% - 10px)` }}
        />
      </div>
    </div>
  )
}

export function FilterSheet({
  open, onClose,
  availableCountries, availableBrands,
  absolutePriceMin, absolutePriceMax,
  filters, onApply,
}: FilterSheetProps) {
  const [local, setLocal] = useState<FilterState>(filters)

  useEffect(() => {
    if (open) setLocal(filters)
  }, [open, filters])

  const effectivePriceMin = local.priceMin ?? absolutePriceMin
  const effectivePriceMax = local.priceMax ?? absolutePriceMax

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

  const handleClear = () => setLocal(EMPTY_FILTERS)

  const handleApply = () => {
    onApply(local)
    onClose()
  }

  const activeCount =
    local.countries.length +
    local.brands.length +
    (local.onlyAvailable ? 1 : 0) +
    (local.priceMin !== null || local.priceMax !== null ? 1 : 0)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl shadow-2xl max-h-[82vh] flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-gray-500" />
                <h2 className="text-base font-black text-gray-900">Filtros</h2>
                {activeCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-nurei-cta text-gray-900">
                    {activeCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">

              {/* Availability */}
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">Disponibilidad</h3>
                <button
                  type="button"
                  onClick={() => setLocal((f) => ({ ...f, onlyAvailable: !f.onlyAvailable }))}
                  className={cn(
                    'flex items-center justify-between w-full px-4 py-3 rounded-2xl border transition-all duration-200',
                    local.onlyAvailable
                      ? 'bg-nurei-cta/10 border-nurei-cta/40 text-gray-900'
                      : 'bg-gray-50 border-gray-200 text-gray-600',
                  )}
                >
                  <span className="text-sm font-semibold">Solo productos disponibles</span>
                  <div className={cn(
                    'w-11 h-6 rounded-full transition-colors duration-200 relative',
                    local.onlyAvailable ? 'bg-nurei-cta' : 'bg-gray-300',
                  )}>
                    <motion.div
                      animate={{ x: local.onlyAvailable ? 22 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                    />
                  </div>
                </button>
              </div>

              {/* Price range */}
              {absolutePriceMax > absolutePriceMin && (
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">Rango de precio</h3>
                  <div className="px-2">
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

              {/* Country */}
              {availableCountries.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">País de origen</h3>
                  <div className="flex flex-wrap gap-2">
                    {availableCountries.map((c) => (
                      <Chip
                        key={c}
                        label={c}
                        active={local.countries.includes(c)}
                        onClick={() => toggleCountry(c)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Brand */}
              {availableBrands.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-3">Marca</h3>
                  <div className="flex flex-wrap gap-2">
                    {availableBrands.map((b) => (
                      <Chip
                        key={b}
                        label={b}
                        active={local.brands.includes(b)}
                        onClick={() => toggleBrand(b)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom spacer for safe area */}
              <div className="h-4" />
            </div>

            {/* Apply button */}
            <div className="px-5 py-4 border-t border-gray-100 shrink-0 bg-white">
              <button
                type="button"
                onClick={handleApply}
                className="w-full h-12 rounded-2xl bg-nurei-cta text-gray-900 font-black text-sm shadow-lg shadow-nurei-cta/25 active:brightness-95 transition-all"
              >
                {activeCount > 0 ? `Ver resultados · ${activeCount} filtro${activeCount !== 1 ? 's' : ''}` : 'Ver resultados'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
