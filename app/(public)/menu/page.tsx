'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { Container } from '@/components/layout/Container'
import { CategoryFilter } from '@/components/productos/CategoryFilter'
import { ProductGrid } from '@/components/productos/ProductGrid'
import { CartBottomBar } from '@/components/carrito/CartBottomBar'
import { PageTransition } from '@/components/motion'
import { formatPrice } from '@/lib/utils/format'
import { useCartStore } from '@/lib/stores/cart'
import type { Product } from '@/types'

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

  // Track scroll and update active category (mobile)
  useEffect(() => {
    if (!containerRef.current || categories.length === 0) return
    const root = containerRef.current

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the section with the highest intersection ratio currently visible
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) {
          const cat = visible[0].target.getAttribute('data-category')
          if (cat) setActiveMobileCategory(cat)
        }
      },
      { root, threshold: [0.1, 0.25, 0.5, 0.75] },
    )

    categories.forEach((cat) => {
      const section = sectionRefsMap.current[cat]
      if (section) observer.observe(section)
    })

    // Reset to 'all' when scrolled back to the very top
    const handleScroll = () => {
      if (root.scrollTop < 60) setActiveMobileCategory('all')
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

  const desktopProducts = useMemo(
    () => (selectedCategory === 'all' ? products : products.filter((p) => p.category === selectedCategory)),
    [products, selectedCategory],
  )

  return (
    <PageTransition>
      <CategoryFilter
        selected={isMobile ? activeMobileCategory : selectedCategory}
        categoriesOverride={categoryChips}
        onChange={(cat) => {
          if (isMobile) {
            // Mobile chips only drive/reflect scroll state; they do not apply data filtering.
            setSelectedCategory('all')
            scrollToCategory(cat)
            return
          }
          setSelectedCategory(cat)
        }}
      />

      {/* Desktop: normal layout */}
      <div className="hidden sm:block">
        <section className="py-8 pb-24">
          <Container>
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <h1 className="text-2xl font-bold text-primary-dark">Nuestro menú</h1>
                  <p className="text-sm text-gray-400 mt-1">
                    {desktopProducts.length} productos disponibles
                  </p>
                </div>
                {cartItemCount > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-right shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      Tu carrito
                    </p>
                    <p className="text-xs text-gray-600 tabular-nums">
                      {cartItemCount} {cartItemCount === 1 ? 'ítem' : 'ítems'}
                    </p>
                    <p className="text-sm font-bold text-primary-dark tabular-nums">{formatPrice(cartSubtotal)}</p>
                  </div>
                )}
              </div>
            </motion.div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
              </div>
            ) : (
              <ProductGrid products={desktopProducts} category={selectedCategory} />
            )}
          </Container>
        </section>
      </div>

      {/* Mobile: scrollable categories */}
      <div
        ref={containerRef}
        className="sm:hidden overflow-y-auto h-[calc(100vh-120px)] pb-24"
      >
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
        ) : (
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
                      <ProductGrid products={grouped[cat]} category={cat} />
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
