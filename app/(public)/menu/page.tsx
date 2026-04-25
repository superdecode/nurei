'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { Container } from '@/components/layout/Container'
import { CategoryFilter } from '@/components/productos/CategoryFilter'
import { ProductGrid } from '@/components/productos/ProductGrid'
import { FilterSheet, EMPTY_FILTERS } from '@/components/productos/FilterSheet'
import type { FilterState } from '@/components/productos/FilterSheet'
import { CartBottomBar } from '@/components/carrito/CartBottomBar'
import { PageTransition } from '@/components/motion'
import { formatPrice } from '@/lib/utils/format'
import { useCartStore } from '@/lib/stores/cart'
import { useDebounce } from '@/lib/hooks/useDebounce'
import type { Product } from '@/types'

// ── Filter helpers ─────────────────────────────────────────────────────────

function getFilterCount(f: FilterState): number {
  return (
    f.countries.length +
    f.brands.length +
    (f.onlyAvailable ? 1 : 0) +
    (f.priceMin !== null || f.priceMax !== null ? 1 : 0)
  )
}

function filterProducts(products: Product[], query: string, filters: FilterState): Product[] {
  const q = query.toLowerCase().trim()
  return products.filter((p) => {
    if (q) {
      const searchable = [p.name, p.description, p.brand, p.origin_country, p.origin, p.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!searchable.includes(q)) return false
    }
    if (filters.countries.length > 0) {
      const country = p.origin_country ?? p.origin
      if (!country || !filters.countries.includes(country)) return false
    }
    if (filters.brands.length > 0) {
      if (!p.brand || !filters.brands.includes(p.brand)) return false
    }
    const price = p.base_price ?? p.price
    if (filters.priceMin !== null && price < filters.priceMin) return false
    if (filters.priceMax !== null && price > filters.priceMax) return false
    if (filters.onlyAvailable && p.stock_status === 'out_of_stock') return false
    return true
  })
}

// ── Active filter chips (desktop + mobile) ────────────────────────────────

function ActiveFilterChips({
  filters,
  onRemoveCountry,
  onRemoveBrand,
  onClearPrice,
  onClearAvailability,
  onClearAll,
}: {
  filters: FilterState
  onRemoveCountry: (c: string) => void
  onRemoveBrand: (b: string) => void
  onClearPrice: () => void
  onClearAvailability: () => void
  onClearAll: () => void
}) {
  const count = getFilterCount(filters)
  if (count === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -6, height: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-wrap items-center gap-2 px-4 sm:px-0 pb-3 sm:pb-0"
    >
      {filters.countries.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onRemoveCountry(c)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-nurei-cta/10 border border-nurei-cta/30 text-[11px] font-semibold text-gray-700 hover:bg-nurei-cta/20 transition-colors"
        >
          {c} <X className="w-2.5 h-2.5" />
        </button>
      ))}
      {filters.brands.map((b) => (
        <button
          key={b}
          type="button"
          onClick={() => onRemoveBrand(b)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
        >
          {b} <X className="w-2.5 h-2.5" />
        </button>
      ))}
      {(filters.priceMin !== null || filters.priceMax !== null) && (
        <button
          type="button"
          onClick={onClearPrice}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
        >
          {filters.priceMin !== null ? formatPrice(filters.priceMin) : '…'} – {filters.priceMax !== null ? formatPrice(filters.priceMax) : '…'}
          <X className="w-2.5 h-2.5" />
        </button>
      )}
      {filters.onlyAvailable && (
        <button
          type="button"
          onClick={onClearAvailability}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          Solo disponibles <X className="w-2.5 h-2.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onClearAll}
        className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
      >
        Limpiar todo
      </button>
    </motion.div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function MenuPage() {
  const cartItemCount = useCartStore((s) => s.getItemCount())
  const cartSubtotal = useCartStore((s) => s.getSubtotal())
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [activeMobileCategory, setActiveMobileCategory] = useState<string>('all')
  const [categoryOrder, setCategoryOrder] = useState<string[]>([])
  const [categoryMeta, setCategoryMeta] = useState<Record<string, { label: string; emoji: string; color?: string }>>({})
  const [isMobile, setIsMobile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const sectionRefsMap = useRef<Record<string, HTMLElement | null>>({})
  const visibleHeightsRef = useRef<Record<string, number>>({})

  // Search + filter state
  const [rawSearch, setRawSearch] = useState('')
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const debouncedSearch = useDebounce(rawSearch, 300)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      try {
        const res = await fetch('/api/products?status=active')
        const json = await res.json()
        const loadedProducts = json.data?.products ?? []
        setProducts(loadedProducts)
        const catRes = await fetch('/api/admin/categories')
        const catJson = await catRes.json()
        const order = (catJson.data ?? []).map((c: { slug: string }) => c.slug)
        setCategoryOrder(order)
        const meta = Object.fromEntries(
          (catJson.data ?? []).map((c: { slug: string; name: string; emoji?: string | null; color?: string | null }) => [
            c.slug,
            {
              label: c.name ? c.name.charAt(0).toUpperCase() + c.name.slice(1) : c.slug,
              emoji: c.emoji || '🍜',
              color: c.color ?? undefined,
            },
          ]),
        )
        setCategoryMeta(meta)
      } catch {
        setProducts([])
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  // Derive available filter options from all products
  const availableCountries = useMemo(
    () => [...new Set(products.map((p) => p.origin_country ?? p.origin).filter((c): c is string => !!c))].sort(),
    [products],
  )
  const availableBrands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter((b): b is string => !!b))].sort(),
    [products],
  )
  const absolutePriceMin = useMemo(
    () => Math.min(...products.map((p) => p.base_price ?? p.price), 0),
    [products],
  )
  const absolutePriceMax = useMemo(
    () => Math.max(...products.map((p) => p.base_price ?? p.price), 0),
    [products],
  )

  // Group products by category
  const grouped = products.reduce((acc, p) => {
    const cat = p.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {} as Record<string, Product[]>)

  const categories = useMemo(() => {
    const present = Object.keys(grouped)
    const orderedPresent = categoryOrder.filter((slug) => present.includes(slug))
    const missing = present.filter((slug) => !orderedPresent.includes(slug))
    return [...orderedPresent, ...missing]
  }, [grouped, categoryOrder])

  const categoryChips = useMemo(
    () => [
      { value: 'all', label: 'Todo', emoji: '✨', color: undefined as string | undefined },
      ...categories.map((slug) => ({
        value: slug,
        label: categoryMeta[slug]?.label ?? slug,
        emoji: categoryMeta[slug]?.emoji ?? '🍜',
        color: categoryMeta[slug]?.color,
      })),
    ],
    [categories, categoryMeta],
  )

  // Apply search + filters to products
  const isFiltering = debouncedSearch.trim().length > 0 || getFilterCount(filters) > 0

  const filteredProducts = useMemo(
    () => filterProducts(products, debouncedSearch, filters),
    [products, debouncedSearch, filters],
  )

  const desktopProducts = useMemo(
    () => (isFiltering
      ? filteredProducts
      : selectedCategory === 'all' ? products : products.filter((p) => p.category === selectedCategory)
    ),
    [products, filteredProducts, selectedCategory, isFiltering],
  )

  // Track scroll and update active category (mobile)
  useEffect(() => {
    if (!containerRef.current || categories.length === 0) return
    const root = containerRef.current
    visibleHeightsRef.current = {}

    const observer = new IntersectionObserver(
      (entries) => {
        const rootHeight = entries[0]?.rootBounds?.height ?? root.clientHeight
        for (const entry of entries) {
          const cat = entry.target.getAttribute('data-category')
          if (!cat) continue
          visibleHeightsRef.current[cat] = entry.isIntersecting && rootHeight > 0
            ? entry.intersectionRect.height / rootHeight
            : 0
        }
        let bestCat = ''
        let bestVisibleHeight = 0
        for (const [cat, visibleHeight] of Object.entries(visibleHeightsRef.current)) {
          if (visibleHeight > bestVisibleHeight) { bestVisibleHeight = visibleHeight; bestCat = cat }
        }
        if (bestCat && bestVisibleHeight > 0) {
          setActiveMobileCategory((prev) => (prev === bestCat ? prev : bestCat))
          return
        }
        if (root.scrollTop <= 8) {
          setActiveMobileCategory((prev) => (prev === 'all' ? prev : 'all'))
        }
      },
      { root, threshold: [0, 0.05, 0.15, 0.3, 0.5, 0.75, 1] },
    )

    categories.forEach((cat) => {
      const section = sectionRefsMap.current[cat]
      if (section) observer.observe(section)
    })

    const handleScroll = () => {
      if (root.scrollTop > 8) return
      const hasVisibleCategory = Object.values(visibleHeightsRef.current).some((value) => value > 0)
      if (!hasVisibleCategory) {
        setActiveMobileCategory((prev) => (prev === 'all' ? prev : 'all'))
      }
    }
    root.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      observer.disconnect()
      root.removeEventListener('scroll', handleScroll)
    }
  }, [categories])

  const scrollToCategory = (cat: string) => {
    if (cat === 'all') {
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      setActiveMobileCategory('all')
      return
    }
    const section = sectionRefsMap.current[cat]
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveMobileCategory(cat)
    }
  }

  const filterCount = getFilterCount(filters)

  const handleApplyFilters = (newFilters: FilterState) => setFilters(newFilters)

  const removeCountry = (c: string) =>
    setFilters((f) => ({ ...f, countries: f.countries.filter((x) => x !== c) }))
  const removeBrand = (b: string) =>
    setFilters((f) => ({ ...f, brands: f.brands.filter((x) => x !== b) }))
  const clearPrice = () =>
    setFilters((f) => ({ ...f, priceMin: null, priceMax: null }))
  const clearAvailability = () =>
    setFilters((f) => ({ ...f, onlyAvailable: false }))
  const clearAll = () => {
    setFilters(EMPTY_FILTERS)
    setRawSearch('')
  }

  return (
    <PageTransition>
      <CategoryFilter
        selected={isMobile ? activeMobileCategory : selectedCategory}
        categoriesOverride={categoryChips}
        onChange={(cat) => {
          if (isMobile) {
            setSelectedCategory('all')
            scrollToCategory(cat)
            return
          }
          setSelectedCategory(cat)
        }}
        searchQuery={rawSearch}
        onSearchChange={setRawSearch}
        filterCount={filterCount}
        onOpenFilters={() => setIsFilterSheetOpen(true)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        availableCountries={availableCountries}
        availableBrands={availableBrands}
        absolutePriceMin={absolutePriceMin}
        absolutePriceMax={absolutePriceMax}
      />

      {/* Filter sheet (mobile) */}
      <FilterSheet
        open={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        availableCountries={availableCountries}
        availableBrands={availableBrands}
        absolutePriceMin={absolutePriceMin}
        absolutePriceMax={absolutePriceMax}
        filters={filters}
        onApply={handleApplyFilters}
      />

      {/* Desktop / tablet: normal layout */}
      <div className="hidden sm:block">
        <section className="pt-4 pb-24">
          <Container>
            {/* Compact info row + active filter chips */}
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3 py-2">
                <p className="text-sm text-gray-500">
                  <span className="font-black text-gray-900">Nuestro menú</span>
                  <span className="mx-1.5 text-gray-300">·</span>
                  {isFiltering ? (
                    <>
                      <span className="font-bold text-gray-800">{desktopProducts.length}</span>
                      {' resultado'}
                      {desktopProducts.length !== 1 ? 's' : ''}
                      {debouncedSearch && (
                        <span className="text-gray-400"> para &ldquo;<span className="font-semibold text-gray-600">{debouncedSearch}</span>&rdquo;</span>
                      )}
                    </>
                  ) : (
                    <>{desktopProducts.length} productos</>
                  )}
                </p>
              </div>
              <AnimatePresence>
                {getFilterCount(filters) > 0 && (
                  <ActiveFilterChips
                    filters={filters}
                    onRemoveCountry={removeCountry}
                    onRemoveBrand={removeBrand}
                    onClearPrice={clearPrice}
                    onClearAvailability={clearAvailability}
                    onClearAll={clearAll}
                  />
                )}
              </AnimatePresence>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
              </div>
            ) : desktopProducts.length === 0 && isFiltering ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <span className="text-5xl block mb-4">🔍</span>
                <p className="text-nurei-muted font-medium text-base">Sin resultados</p>
                <p className="text-sm text-nurei-muted/50 mt-1.5 mb-5">Prueba con otros términos o limpia los filtros</p>
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-5 py-2.5 rounded-full bg-nurei-cta text-gray-900 text-sm font-bold shadow-md"
                >
                  Limpiar búsqueda
                </button>
              </motion.div>
            ) : (
              <ProductGrid products={desktopProducts} category={selectedCategory} searchQuery={debouncedSearch} />
            )}
          </Container>
        </section>
      </div>

      {/* Mobile: scrollable categories */}
      <div
        ref={containerRef}
        className="sm:hidden overflow-y-auto h-[calc(100vh-120px)] pb-24"
      >
        {/* Mobile active filter chips strip */}
        <AnimatePresence>
          {getFilterCount(filters) > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pt-2 pb-1">
                <ActiveFilterChips
                  filters={filters}
                  onRemoveCountry={removeCountry}
                  onRemoveBrand={removeBrand}
                  onClearPrice={clearPrice}
                  onClearAvailability={clearAvailability}
                  onClearAll={clearAll}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {cartItemCount > 0 && !loading && (
          <div className="sticky top-0 z-20 -mx-0 mb-2 border-b border-gray-100 bg-white/95 px-4 py-2 backdrop-blur-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {cartItemCount} {cartItemCount === 1 ? 'ítem' : 'ítems'}
              </span>
              <span className="font-bold text-primary-dark tabular-nums">{formatPrice(cartSubtotal)}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
          </div>
        ) : isFiltering ? (
          // Search/filter mode on mobile: flat list
          <div>
            <div className="px-4 py-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500">
                <span className="font-black text-gray-800">{filteredProducts.length}</span> resultado{filteredProducts.length !== 1 ? 's' : ''}
                {debouncedSearch && <span> para &ldquo;<span className="font-semibold">{debouncedSearch}</span>&rdquo;</span>}
              </p>
            </div>
            {filteredProducts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16 px-6"
              >
                <span className="text-4xl block mb-3">🔍</span>
                <p className="text-nurei-muted font-medium text-sm">Sin resultados</p>
                <p className="text-xs text-nurei-muted/50 mt-1 mb-4">Prueba otros términos o limpia los filtros</p>
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-5 py-2 rounded-full bg-nurei-cta text-gray-900 text-xs font-bold shadow-md"
                >
                  Limpiar búsqueda
                </button>
              </motion.div>
            ) : (
              <Container>
                <ProductGrid products={filteredProducts} category="search" searchQuery={debouncedSearch} />
              </Container>
            )}
          </div>
        ) : (
          // Normal category-scroll mode on mobile
          <div>
            {categories.map((cat) => {
              const title =
                (categoryMeta[cat]?.label ?? cat)
                  .replace(/-/g, ' ')
                  .toUpperCase()
              return (
                <div key={cat}>
                  <div
                    ref={(el) => { sectionRefsMap.current[cat] = el }}
                    data-category={cat}
                    className="pt-1"
                  >
                    <div
                      className="flex items-center gap-2.5 px-4 py-3"
                      aria-hidden
                    >
                      <span className="flex-1 h-px bg-gray-300" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400 whitespace-nowrap">
                        {title}
                      </span>
                      <span className="flex-1 h-px bg-gray-300" />
                    </div>
                    <Container>
                      <ProductGrid products={grouped[cat]} category={cat} searchQuery={debouncedSearch} />
                    </Container>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CartBottomBar />
    </PageTransition>
  )
}
