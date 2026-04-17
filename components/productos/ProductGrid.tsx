'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ProductCard } from './ProductCard'
import { MobileProductCard } from './MobileProductCard'
import type { Product } from '@/types'

interface ProductGridProps {
  products: Product[]
  category?: string
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

export function ProductGrid({ products, category = 'all' }: ProductGridProps) {
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
          {/* Mobile list view */}
          <motion.div
            key={`list-${category}`}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="sm:hidden flex flex-col gap-2"
          >
            <AnimatePresence>
              {products.map((product) => (
                <motion.div
                  key={product.id}
                  variants={itemVariants}
                  layout
                  exit="exit"
                >
                  <MobileProductCard product={product} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {/* Desktop grid view */}
          <motion.div
            key={`grid-${category}`}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6"
          >
            <AnimatePresence>
              {products.map((product) => (
                <motion.div
                  key={product.id}
                  variants={itemVariants}
                  layout
                  exit="exit"
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
