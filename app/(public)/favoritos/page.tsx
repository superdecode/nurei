'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart } from 'lucide-react'
import Link from 'next/link'
import { useFavoritesStore } from '@/lib/stores/favorites'
import { PRODUCTS } from '@/lib/data/products'
import { ProductCard } from '@/components/productos/ProductCard'
import { Container } from '@/components/layout/Container'

export default function FavoritosPage() {
  const [mounted, setMounted] = useState(false)
  const favoriteIds = useFavoritesStore((s) => s.favoriteIds)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  const favoriteProducts = PRODUCTS.filter((p) => favoriteIds.includes(p.id))

  return (
    <Container className="py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-gray-900 mb-2">Mis favoritos</h1>
        <p className="text-gray-500 text-sm mb-8">
          {favoriteProducts.length} {favoriteProducts.length === 1 ? 'producto' : 'productos'}
        </p>

        {favoriteProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
              <Heart className="w-8 h-8 text-red-300" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Sin favoritos aún</h2>
            <p className="text-gray-400 text-sm mb-6">
              Explora nuestro menú y guarda tus snacks preferidos
            </p>
            <Link
              href="/menu"
              className="inline-flex px-6 py-3 bg-nurei-cta text-gray-900 font-bold rounded-full shadow-lg shadow-nurei-cta/25 hover:shadow-xl transition-all"
            >
              Ver menú
            </Link>
          </div>
        ) : (
          <AnimatePresence>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {favoriteProducts.map((product) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </motion.div>
    </Container>
  )
}
