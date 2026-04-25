'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Plus, Heart, Ban } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useCartStore } from '@/lib/stores/cart'
import { useFavoritesStore } from '@/lib/stores/favorites'
import { formatPrice, stripHtml } from '@/lib/utils/format'
import { countryToFlag } from '@/lib/utils/country-flag'
import { formatProductPresentation } from '@/lib/utils/product-presentation'
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
          className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i < level ? 'bg-nurei-promo' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  )
}

const SPRING_SNAP = { type: 'spring', stiffness: 400, damping: 20 } as const
const SPRING_SMOOTH = { type: 'spring', stiffness: 300, damping: 28 } as const

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem)
  const currentCartQuantity = useCartStore((s) => s.items.find((item) => item.product.id === product.id)?.quantity ?? 0)
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const [added, setAdded] = useState(false)
  const [stockFeedback, setStockFeedback] = useState<string | null>(null)
  const fav = isFavorite(product.id)

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const response = await fetch(`/api/products/${product.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1, currentCartQuantity }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.can_add) {
        const message = payload?.message ?? 'No hay stock suficiente por ahora.'
        setStockFeedback(message)
        toast.error(message)
        return
      }
      setStockFeedback(null)
      addItem(product)
      setAdded(true)
      toast.success(`${product.name} agregado`, { icon: '🍘', duration: 2000 })
      setTimeout(() => setAdded(false), 1400)
    } catch {
      const message = 'No se pudo validar inventario en este momento.'
      setStockFeedback(message)
      toast.error(message)
    }
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

  const isOutOfStock = product.stock_status === 'out_of_stock'
  const isLowStock = product.stock_status === 'low_stock'
  const price = product.base_price ?? product.price
  const discountPercent = product.compare_at_price && product.compare_at_price > price
    ? Math.round((1 - price / product.compare_at_price) * 100) : 0

  return (
    <Link href={`/producto/${product.slug}`}>
      <motion.div
        layout
        transition={SPRING_SMOOTH}
        whileHover={isOutOfStock ? {} : { y: -3, transition: SPRING_SMOOTH }}
        className={`card-product group overflow-hidden flex flex-col ${
          isOutOfStock ? 'ring-1 ring-amber-200/80' : ''
        }`}
      >
        {/* ── Image area ── */}
        <div className="relative aspect-square bg-gray-50 flex items-center justify-center overflow-hidden rounded-t-[1.25rem]">
          {product.images?.[product.primary_image_index] ? (
            <motion.img
              src={product.images[product.primary_image_index]}
              alt={product.name}
              className={`w-full h-full object-cover transition-transform duration-700 ease-out ${
                isOutOfStock ? '' : 'group-hover:scale-110'
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            />
          ) : (
            <motion.span
              className="text-5xl sm:text-6xl select-none opacity-40"
              whileHover={isOutOfStock ? {} : { scale: 1.2, rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.5 }}
            >
              {getCategoryEmoji(product.category)}
            </motion.span>
          )}

          {/* Out of stock — warm amber wash + pill */}
          {isOutOfStock && (
            <>
              <div className="absolute inset-0 bg-[#FFF3CE]/65" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FFF3CE] border border-amber-300/80 text-amber-800 text-[11px] font-bold uppercase tracking-widest shadow-sm">
                  <Ban className="w-3 h-3 shrink-0" />
                  Agotado
                </span>
              </div>
            </>
          )}

          {/* Badges */}
          {!isOutOfStock && (
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {product.is_limited && (
                <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-nurei-promo text-white rounded-full shadow-lg">
                  Limitado
                </span>
              )}
              {discountPercent > 0 && (
                <span className="px-2.5 py-1 text-[10px] font-black uppercase bg-red-500 text-white rounded-full shadow-lg">
                  -{discountPercent}%
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
          )}

          {/* Favorite button */}
          <motion.button
            whileTap={{ scale: 0.82 }}
            transition={SPRING_SNAP}
            onClick={handleToggleFav}
            className={`absolute top-3 right-3 p-2 rounded-full shadow-sm transition-colors duration-200 ${
              fav ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-400 hover:text-red-400 hover:bg-white'
            }`}
          >
            <Heart className="w-4 h-4" fill={fav ? 'currentColor' : 'none'} />
          </motion.button>

          {/* Low stock warning */}
          {isLowStock && (
            <div className="absolute bottom-3 left-3 right-3">
              <div className="px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-center shadow-sm">
                <span className="text-[10px] font-bold text-nurei-promo animate-pulse">
                  ¡Últimas unidades!
                </span>
              </div>
            </div>
          )}

          {/* Desktop meta chips over image */}
          {(product.origin_country || product.origin) && (
            <div className="hidden sm:flex absolute right-3 bottom-3 z-10 flex-col items-end gap-1.5">
              <span className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-white/70 border border-white/40 text-gray-800 backdrop-blur-sm">
                {countryToFlag(product.origin_country ?? product.origin ?? '') || ''} {product.origin_country ?? product.origin}
              </span>
            </div>
          )}
        </div>

        {/* ── Card body ── */}
        <div className={`p-4 sm:px-4 sm:py-3.5 flex flex-col flex-1 transition-colors duration-300 ${isOutOfStock ? 'bg-amber-50/40' : ''}`}>
          <h3 className={`text-[15px] font-bold line-clamp-2 leading-snug transition-colors duration-300 ${
            isOutOfStock ? 'text-amber-900/60' : 'text-gray-900 group-hover:text-nurei-cta'
          }`}>
            {product.name}
          </h3>

          {product.description && (
            <p className="mt-1.5 text-xs text-gray-400 line-clamp-2 leading-relaxed">
              {stripHtml(product.description)}
            </p>
          )}

          {/* Origin country badge */}
          {(product.origin_country || product.origin) && (
            <span className="sm:hidden mt-1.5 inline-block px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-500">
              {countryToFlag(product.origin_country ?? product.origin ?? '') || ''} {product.origin_country ?? product.origin}
            </span>
          )}

          {/* Spice + Weight */}
          {!isOutOfStock && (
            <div className="mt-3 flex items-center gap-3">
              {product.spice_level > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-nurei-promo/10 rounded-full">
                  <SpiceDots level={product.spice_level} />
                  <span className="text-[10px] text-nurei-promo font-bold italic">
                    {SPICE_LABELS[product.spice_level]}
                  </span>
                </div>
              )}
              <span className="text-[10px] font-bold text-gray-400 uppercase tabular-nums">
                {formatProductPresentation(product)}
              </span>
            </div>
          )}

          {/* Price + CTA */}
          <div className="mt-auto pt-4 flex items-end justify-between gap-3">
            <div className="flex flex-col">
              {product.compare_at_price && product.compare_at_price > price && (
                <span className="text-[10px] font-bold text-gray-300 line-through tabular-nums">
                  {formatPrice(product.compare_at_price)}
                </span>
              )}
              <span className={`text-xl font-black tabular-nums tracking-tight transition-colors duration-300 ${
                isOutOfStock ? 'text-amber-400' : 'text-gray-900'
              }`}>
                {formatPrice(price)}
              </span>
            </div>

            {isOutOfStock ? (
              <span className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                <Ban className="w-3 h-3 shrink-0" />
                Sin stock
              </span>
            ) : (
              <motion.button
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.06 }}
                transition={SPRING_SNAP}
                onClick={handleAdd}
                className={`flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-full transition-colors duration-300 shadow-lg ${
                  added
                    ? 'bg-nurei-stock text-white shadow-nurei-stock/25'
                    : 'bg-nurei-cta text-gray-900 shadow-nurei-cta/30'
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {added ? (
                    <motion.span
                      key="added"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={SPRING_SNAP}
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
                      transition={SPRING_SNAP}
                      className="flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )}
          </div>

          <AnimatePresence>
            {stockFeedback && (
              <motion.p
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 text-[11px] text-red-600 font-medium"
              >
                {stockFeedback}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </Link>
  )
}
