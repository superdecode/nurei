'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ProductCard } from './ProductCard'
import { MobileProductCard } from './MobileProductCard'
import type { Product } from '@/types'
import type { ViewMode } from './ViewToggle'

interface ProductGridProps {
  products: Product[]
  category?: string
  searchQuery?: string
  viewMode?: ViewMode
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: 10,
    transition: {
      duration: 0.2,
      ease: 'easeIn' as const,
    },
  },
}

export function ProductGrid({ products, category = 'all', searchQuery = '', viewMode = 'list' }: ProductGridProps) {
  return (
    <AnimatePresence mode="wait">
      {products.length === 0 ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="text-center py-20"
        >
          <motion.span
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
            className="text-6xl block mb-4"
          >
            😢
          </motion.span>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-nurei-muted font-medium text-base"
          >
            No encontramos snacks en esta categoría
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-nurei-muted/50 mt-1.5"
          >
            ¡Prueba con otra categoría!
          </motion.p>
        </motion.div>
      ) : (
        <>
          {/* Mobile views — list, normal cards, compact grid */}
          <AnimatePresence mode="wait" initial={false}>
            {viewMode === 'list' ? (
              <motion.div
                key={`list-${category}`}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
                className="sm:hidden flex flex-col gap-2"
              >
                {products.map((product) => (
                  <motion.div key={product.id} variants={itemVariants} layout>
                    <MobileProductCard product={product} searchQuery={searchQuery} />
                  </motion.div>
                ))}
              </motion.div>
            ) : viewMode === 'grid' ? (
              <motion.div
                key={`grid-${category}`}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
                className="sm:hidden grid grid-cols-2 gap-3"
              >
                {products.map((product) => (
                  <motion.div key={product.id} variants={itemVariants} layout>
                    <ProductCard product={product} searchQuery={searchQuery} />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={`compact-${category}`}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
                className="sm:hidden grid grid-cols-3 gap-2"
              >
                {products.map((product) => (
                  <motion.div key={product.id} variants={itemVariants} layout>
                    <ProductCard product={product} searchQuery={searchQuery} compact />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {viewMode === 'list' ? (
            <motion.div
              key={`desktop-list-${category}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="hidden sm:flex flex-col gap-3"
            >
              <AnimatePresence>
                {products.map((product) => (
                  <motion.div key={product.id} variants={itemVariants} layout exit="exit">
                    <MobileProductCard product={product} searchQuery={searchQuery} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : viewMode === 'grid' ? (
            <motion.div
              key={`desktop-grid-${category}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="hidden sm:grid gap-3 sm:gap-4 lg:gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            >
              <AnimatePresence>
                {products.map((product) => (
                  <motion.div key={product.id} variants={itemVariants} layout exit="exit">
                    <ProductCard product={product} searchQuery={searchQuery} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key={`desktop-compact-${category}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="hidden sm:grid gap-3 sm:gap-4 lg:gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            >
              <AnimatePresence>
                {products.map((product) => (
                  <motion.div key={product.id} variants={itemVariants} layout exit="exit">
                    <ProductCard product={product} searchQuery={searchQuery} compact />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  )
}
