'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { Container } from '@/components/layout/Container'
import { CategoryFilter } from '@/components/productos/CategoryFilter'
import { ProductGrid } from '@/components/productos/ProductGrid'
import { CartBottomBar } from '@/components/carrito/CartBottomBar'
import { PageTransition } from '@/components/motion'
import type { Product } from '@/types'

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [activeMobileCategory, setActiveMobileCategory] = useState<string>('all')
  const [categoryOrder, setCategoryOrder] = useState<string[]>([])
  const [categoryMeta, setCategoryMeta] = useState<Record<string, { label: string; emoji: string }>>({})
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
          (catJson.data ?? []).map((c: { slug: string; name: string; emoji?: string | null }) => [
            c.slug,
            { label: c.name, emoji: c.emoji || '📦' },
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
      { value: 'all', label: 'Todo', emoji: '✨' },
      ...categories.map((slug) => ({
        value: slug,
        label: categoryMeta[slug]?.label ?? slug,
        emoji: categoryMeta[slug]?.emoji ?? '📦',
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
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) {
          const cat = visible[0].target.getAttribute('data-category')
          if (cat) setActiveMobileCategory(cat)
        }
      },
      { root, threshold: [0.25, 0.5, 0.75] },
    )
    categories.forEach((cat) => {
      const section = sectionRefsMap.current[cat]
      if (section) observer.observe(section)
    })
    return () => observer.disconnect()
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
              <h1 className="text-2xl font-bold text-primary-dark">Nuestro menú</h1>
              <p className="text-sm text-gray-400 mt-1">
                {desktopProducts.length} productos disponibles
              </p>
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
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
          </div>
        ) : (
          <div>
            {categories.map((cat, idx) => (
              <div key={cat}>
                <div
                  ref={(el) => { sectionRefsMap.current[cat] = el }}
                  data-category={cat}
                  className="pt-2"
                >
                  <Container>
                    <ProductGrid products={grouped[cat]} category={cat} />
                  </Container>
                </div>

                {/* Divider between categories */}
                {idx < categories.length - 1 && (
                  <div className="h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent my-4 mx-4" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <CartBottomBar />
    </PageTransition>
  )
}
