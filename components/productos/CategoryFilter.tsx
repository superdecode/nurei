'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilterDropdown } from './FilterDropdown'
import type { FilterState } from './FilterSheet'

interface CategoryFilterProps {
  selected: string
  onChange: (category: string) => void
  categoriesOverride?: { value: string; label: string; emoji: string; color?: string }[]
  // Search (shared mobile + desktop)
  searchQuery?: string
  onSearchChange?: (query: string) => void
  // Mobile sheet trigger
  filterCount?: number
  onOpenFilters?: () => void
  // Desktop FilterDropdown (passed through)
  filters?: FilterState
  onApplyFilters?: (f: FilterState) => void
  availableCountries?: string[]
  availableBrands?: string[]
  absolutePriceMin?: number
  absolutePriceMax?: number
}

export function CategoryFilter({
  selected, onChange, categoriesOverride,
  searchQuery = '', onSearchChange,
  filterCount = 0, onOpenFilters,
  filters, onApplyFilters,
  availableCountries = [], availableBrands = [],
  absolutePriceMin = 0, absolutePriceMax = 0,
}: CategoryFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [categories, setCategories] = useState<{ value: string; label: string; emoji: string; color?: string }[]>([
    { value: 'all', label: 'Todo', emoji: '✨' },
  ])

  useEffect(() => {
    if (categoriesOverride && categoriesOverride.length > 0) {
      setCategories(categoriesOverride)
      return
    }
    fetch('/api/admin/categories')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          const dbCats = json.data.map((c: { slug: string; name?: string; emoji?: string | null; color?: string | null }) => ({
            value: c.slug,
            label: c.name ? c.name.charAt(0).toUpperCase() + c.name.slice(1) : c.slug,
            emoji: c.emoji || '🍜',
            color: c.color ?? undefined,
          }))
          setCategories([{ value: 'all', label: 'Todo', emoji: '✨' }, ...dbCats])
        }
      })
      .catch(() => {})
  }, [categoriesOverride])

  // Auto-focus when mobile search opens; clear query when it closes
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } else {
      onSearchChange?.('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchOpen])

  const scrollToActive = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button[data-category-chip]'))
    const button = buttons.find((el) => el.dataset.categoryChip === selected)
    if (!button) return
    button.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    const targetLeft = button.offsetLeft - (container.clientWidth - button.clientWidth) / 2
    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth)
    container.scrollTo({ left: Math.min(maxScrollLeft, Math.max(0, targetLeft)), behavior: 'smooth' })
  }, [selected])

  useEffect(() => { scrollToActive() }, [selected, categories, scrollToActive])

  const handleSearchClear = () => {
    onSearchChange?.('')
    setIsSearchOpen(false)
  }

  const hasDesktopFilter = !!(filters && onApplyFilters)

  return (
    <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-md border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Mobile: slide-in search bar (above chips row) ── */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 35 }}
              className="sm:hidden overflow-hidden"
            >
              <div className="flex items-center gap-2 pt-3 pb-1">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    placeholder="Buscar snacks, marcas, países…"
                    className="w-full h-10 pl-9 pr-9 rounded-2xl bg-gray-100 border border-transparent text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-nurei-cta/40 focus:border-nurei-cta/30 transition-all"
                    autoComplete="off"
                    enterKeyHint="search"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchChange?.('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="text-xs font-semibold text-gray-500 shrink-0 px-2 py-1 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main chips row ── */}
        <div className="relative flex items-center gap-2">

          {/* ── MOBILE LEFT: filter icon + search icon (before chips) ── */}
          <div className="sm:hidden flex items-center gap-1 shrink-0 py-3">
            {/* Filter icon */}
            {onOpenFilters && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                onClick={onOpenFilters}
                className={cn(
                  'relative flex items-center justify-center w-9 h-9 rounded-2xl transition-all duration-200',
                  filterCount > 0
                    ? 'bg-nurei-cta text-gray-900 shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                )}
                aria-label="Filtrar"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {filterCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-gray-900 text-white text-[9px] font-black"
                  >
                    {filterCount}
                  </motion.span>
                )}
              </motion.button>
            )}

            {/* Search icon */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={() => setIsSearchOpen((v) => !v)}
              className={cn(
                'relative flex items-center justify-center w-9 h-9 rounded-2xl transition-all duration-200',
                isSearchOpen || searchQuery
                  ? 'bg-nurei-cta text-gray-900 shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
              )}
              aria-label="Buscar"
            >
              {isSearchOpen && !searchQuery ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              {searchQuery && !isSearchOpen && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gray-900" />
              )}
            </motion.button>
          </div>

          {/* Right fade for mobile (covers chips before desktop tools) */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background/90 to-transparent z-10 sm:hidden" />

          {/* ── Scrollable category chips ── */}
          <div
            ref={scrollRef}
            className="flex flex-nowrap gap-2 overflow-x-auto py-3 px-1 flex-1 min-w-0"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {categories.map((cat) => {
              const isActive = selected === cat.value
              return (
                <motion.button
                  key={cat.value}
                  data-category-chip={cat.value}
                  onClick={() => onChange(cat.value)}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'relative flex-shrink-0 flex items-center gap-1.5 px-4 sm:px-5 min-h-[40px] rounded-full text-sm font-medium transition-all duration-300 border',
                    isActive
                      ? 'text-gray-900 bg-nurei-cta border-nurei-cta font-bold shadow-md'
                      : 'bg-white border-gray-100 text-gray-500 hover:text-gray-900 hover:border-yellow-300 hover:bg-yellow-50',
                  )}
                >
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span>{cat.label}</span>
                </motion.button>
              )
            })}
          </div>

          {/* ── DESKTOP/TABLET RIGHT: search input + FilterDropdown ── */}
          {hasDesktopFilter && (
            <div className="hidden sm:flex items-center gap-2 shrink-0 py-3">
              {/* Search — ~2.5× wider than filter button (filter ~100px → search ~250px) */}
              <div className="relative w-56 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder="Buscar snacks, marcas…"
                  className="w-full h-9 pl-8.5 pr-8 rounded-xl bg-gray-100 border border-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-nurei-cta/40 focus:bg-white focus:border-nurei-cta/30 transition-all"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange?.('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-400 transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {/* FilterDropdown — self-contained button + popover */}
              <FilterDropdown
                availableCountries={availableCountries}
                availableBrands={availableBrands}
                absolutePriceMin={absolutePriceMin}
                absolutePriceMax={absolutePriceMax}
                filters={filters!}
                onApply={onApplyFilters!}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
