'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Plus, Heart } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useCartStore } from '@/lib/stores/cart'
import { useFavoritesStore } from '@/lib/stores/favorites'
import { formatPrice } from '@/lib/utils/format'
import { SPICE_LABELS } from '@/lib/utils/constants'
import type { Product } from '@/types'

interface ProductCardProps {
  product: Product
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    crunchy: '🍘', spicy: '🌶️', limited_edition: '🍵', drinks: '🥤',
    snacks: '🍿', ramen: '🍜', dulces: '🍬', salsas: '🫙',
  }
  return map[category] || '🍘'
}

function SpiceDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < level ? 'bg-nurei-promo' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  )
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem)
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const [added, setAdded] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const fav = mounted ? isFavorite(product.id) : false

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addItem(product)
    setAdded(true)
    toast.success(`${product.name} agregado`, { icon: '🍘', duration: 2000 })
    setTimeout(() => setAdded(false), 1400)
  }

  const handleToggleFav = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleFavorite(product.id)
    toast.success(fav ? 'Eliminado de favoritos' : 'Agregado a favoritos', {
      icon: fav ? '💔' : '❤️',
      duration: 1500,
    })
  }

  const lowAvailability = product.availability_score < 40
  const price = product.base_price ?? product.price
  const discountPercent = product.compare_at_price && product.compare_at_price > price
    ? Math.round((1 - price / product.compare_at_price) * 100) : 0

  return (
    <Link href={`/producto/${product.slug}`}>
      <motion.div
        layout
        className="card-product group overflow-hidden flex flex-col"
      >
        <div className="relative aspect-square bg-gray-50 flex items-center justify-center overflow-hidden rounded-t-[1.25rem]">
          {product.images?.[product.primary_image_index] ? (
            <motion.img
              src={product.images[product.primary_image_index]}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
          ) : (
            <motion.span
              className="text-5xl sm:text-6xl select-none opacity-40"
              whileHover={{ scale: 1.2, rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.5 }}
            >
              {getCategoryEmoji(product.category)}
            </motion.span>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.is_limited && (
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-nurei-promo text-white rounded-full shadow-lg">
                Limitado
              </span>
            )}
            {discountPercent > 0 && (
              <span className="px-2.5 py-1 text-[10px] font-black uppercase bg-red-500 text-white rounded-full shadow-lg">
                DESC {discountPercent}%
              </span>
            )}
            {product.is_featured && (
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-nurei-cta text-gray-900 rounded-full shadow-lg">
                Popular
              </span>
            )}
            {product.has_variants && (
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-blue-500 text-white rounded-full shadow-lg">
                Opciones
              </span>
            )}
          </div>

          {/* Favorite button */}
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={handleToggleFav}
            className={`absolute top-3 right-3 p-2 rounded-full shadow-sm transition-colors ${
              fav ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-400 hover:text-red-400'
            }`}
          >
            <Heart className="w-4 h-4" fill={fav ? 'currentColor' : 'none'} />
          </motion.button>

          {/* Low stock warning */}
          {lowAvailability && (
            <div className="absolute bottom-3 left-3 right-3">
              <div className="px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-center shadow-sm">
                <span className="text-[10px] font-bold text-nurei-promo animate-pulse">
                  ¡Últimas unidades!
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 flex flex-col flex-1">
          <h3 className="text-[15px] font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-nurei-cta transition-colors duration-300">
            {product.name}
          </h3>

          {product.description && (
            <p className="mt-1.5 text-xs text-gray-500 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Spice + Weight */}
          <div className="mt-3 flex items-center gap-3">
            {product.spice_level > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-nurei-promo/10 rounded-full">
                <SpiceDots level={product.spice_level} />
                <span className="text-[10px] text-nurei-promo font-bold italic">
                  {SPICE_LABELS[product.spice_level]}
                </span>
              </div>
            )}
            {product.unit_of_measure && (
              <span className="text-[10px] font-bold text-gray-400 uppercase">{product.unit_of_measure}</span>
            )}
          </div>

          {/* Price + CTA */}
          <div className="mt-auto pt-4 flex items-end justify-between gap-3">
            <div className="flex flex-col">
              {product.compare_at_price && product.compare_at_price > price && (
                <span className="text-[10px] font-bold text-gray-300 line-through">
                  {formatPrice(product.compare_at_price)}
                </span>
              )}
              <span className="text-xl font-black text-gray-900 tabular-nums tracking-tight">
                {formatPrice(price)}
              </span>
            </div>

            <motion.button
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.05 }}
              onClick={handleAdd}
              disabled={lowAvailability && !added}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-full transition-all duration-300 ${
                added
                  ? 'bg-nurei-stock text-white shadow-lg shadow-nurei-stock/25'
                  : lowAvailability
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-nurei-cta text-gray-900 shadow-lg shadow-nurei-cta/30 hover:scale-105'
              }`}
            >
              <AnimatePresence mode="wait">
                {added ? (
                  <motion.span
                    key="added"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="add"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}
