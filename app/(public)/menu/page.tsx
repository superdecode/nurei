'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Container } from '@/components/layout/Container'
import { CategoryFilter } from '@/components/productos/CategoryFilter'
import { ProductGrid } from '@/components/productos/ProductGrid'
import { PageTransition } from '@/components/motion'
import { PRODUCTS } from '@/lib/data/products'

export default function MenuPage() {
  const [category, setCategory] = useState('all')

  const filteredProducts = useMemo(() => {
    if (category === 'all') return PRODUCTS
    return PRODUCTS.filter((p) => p.category === category)
  }, [category])

  return (
    <PageTransition>
      <CategoryFilter selected={category} onChange={setCategory} />
      <section className="py-6 sm:py-8 pb-24">
        <Container>
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-primary-dark">
                Nuestro menu
              </h1>
              <AnimatePresence mode="wait">
                <motion.span
                  key={filteredProducts.length}
                  initial={{ opacity: 0, scale: 0.8, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 4 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="inline-flex items-center justify-center h-7 min-w-[2rem] px-2.5 rounded-full bg-primary-cyan/15 text-primary-cyan text-xs font-bold tabular-nums"
                >
                  {filteredProducts.length}
                </motion.span>
              </AnimatePresence>
            </div>
            <motion.p
              className="text-xs sm:text-sm text-gray-400 mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.25 }}
            >
              {category === 'all'
                ? 'Todos los productos disponibles'
                : `Filtrando por ${category}`}
            </motion.p>
          </motion.div>
          <ProductGrid products={filteredProducts} category={category} />
        </Container>
      </section>
    </PageTransition>
  )
}
