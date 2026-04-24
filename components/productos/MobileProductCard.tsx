'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Ban } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useCartStore } from '@/lib/stores/cart'
import { formatPrice, stripHtml } from '@/lib/utils/format'
import type { Product } from '@/types'

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    crunchy: '🍘', spicy: '🌶️', limited_edition: '🍵', drinks: '🥤',
    snacks: '🍿', ramen: '🍜', dulces: '🍬', salsas: '🫙',
  }
  return map[category] || '🍘'
}

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const MinusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <path d="M5 12h14" />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

const SPRING_SNAP = { type: 'spring', stiffness: 400, damping: 20 } as const
const SPRING_SMOOTH = { type: 'spring', stiffness: 350, damping: 28 } as const

interface MobileProductCardProps {
  product: Product
}

export function MobileProductCard({ product }: MobileProductCardProps) {
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const qty = useCartStore((s) => s.items.find((i) => i.product.id === product.id)?.quantity ?? 0)
  const [added, setAdded] = useState(false)

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const res = await fetch(`/api/products/${product.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1, currentCartQuantity: qty }),
      })
      const payload = await res.json()
      if (!res.ok || !payload?.can_add) {
        toast.error(payload?.message ?? 'No hay stock suficiente.')
        return
      }
      addItem(product)
      setAdded(true)
      toast.success(`${product.name} agregado`, { icon: '🍘', duration: 1500 })
      setTimeout(() => setAdded(false), 1200)
    } catch {
      toast.error('No se pudo validar inventario.')
    }
  }

  const handleMinus = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(product.id, qty - 1)
  }

  const isOutOfStock = product.stock_status === 'out_of_stock'
  const isLowStock = product.stock_status === 'low_stock'
  const price = product.base_price ?? product.price
  const hasDiscount = !!product.compare_at_price && product.compare_at_price > price
  const discountPercent = hasDiscount
    ? Math.round((1 - price / product.compare_at_price!) * 100)
    : 0

  return (
    <Link href={`/producto/${product.slug}`}>
      <motion.div
        layout
        transition={SPRING_SMOOTH}
        whileTap={isOutOfStock ? {} : { scale: 0.98 }}
        className={`flex items-center gap-3 p-3 bg-white rounded-2xl border shadow-sm transition-colors duration-300 ${
          isOutOfStock ? 'border-amber-200/70' : 'border-gray-100'
        }`}
      >
        {/* Image */}
        <div className="relative w-[76px] h-[76px] flex-shrink-0 rounded-xl overflow-hidden bg-gray-50">
          {(product.images?.[product.primary_image_index] ?? product.image_thumbnail_url) ? (
            <img
              src={product.images?.[product.primary_image_index] ?? product.image_thumbnail_url!}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <span className="text-2xl opacity-30">{getCategoryEmoji(product.category)}</span>
            </div>
          )}

          {/* Out of stock — amber wash + pill */}
          {isOutOfStock && (
            <>
              <div className="absolute inset-0 bg-[#FFF3CE]/70" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-[#FFF3CE] border border-amber-300/80 text-amber-800 text-[8px] font-bold uppercase tracking-wider">
                  <Ban className="w-2 h-2 shrink-0" />
                  Agotado
                </span>
              </div>
            </>
          )}

          {/* Discount badge */}
          {discountPercent > 0 && !isOutOfStock && (
            <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded-full leading-none">
              -{discountPercent}%
            </span>
          )}

          {/* Limited badge */}
          {product.is_limited && !discountPercent && !isOutOfStock && (
            <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-bold bg-nurei-promo text-white rounded-full leading-none">
              Ltd
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold line-clamp-1 leading-tight transition-colors duration-300 ${
            isOutOfStock ? 'text-amber-900/60' : 'text-gray-900'
          }`}>
            {product.name}
          </p>
          {product.description && (
            <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5 leading-tight">
              {stripHtml(product.description)}
            </p>
          )}
          {product.origin_country && (
            <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-gray-100 text-gray-500 leading-none">
              🌍 {product.origin_country}
            </span>
          )}
          {isLowStock && (
            <p className="text-[10px] font-bold text-nurei-promo animate-pulse mt-0.5">
              ¡Últimas unidades!
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {hasDiscount && (
              <span className="text-[11px] text-gray-300 line-through font-medium tabular-nums">
                {formatPrice(product.compare_at_price!)}
              </span>
            )}
            <span className={`text-base font-black tabular-nums tracking-tight transition-colors duration-300 ${
              isOutOfStock ? 'text-amber-400' : hasDiscount ? 'text-nurei-promo' : 'text-gray-900'
            }`}>
              {formatPrice(price)}
            </span>
          </div>
        </div>

        {/* Qty controls */}
        <div className="flex-shrink-0">
          {isOutOfStock ? (
            <span className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold rounded-full bg-amber-50 text-amber-600 border border-amber-200">
              <Ban className="w-2.5 h-2.5 shrink-0" />
              Sin stock
            </span>
          ) : qty > 0 ? (
            <div className="flex items-center gap-1.5">
              <motion.button
                whileTap={{ scale: 0.8 }}
                transition={SPRING_SNAP}
                onClick={handleMinus}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:bg-gray-200 transition-colors duration-150"
              >
                <MinusIcon />
              </motion.button>

              <AnimatePresence mode="popLayout">
                <motion.span
                  key={qty}
                  initial={{ y: -10, opacity: 0, scale: 0.8 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 10, opacity: 0, scale: 0.8 }}
                  transition={SPRING_SNAP}
                  className="w-6 text-center text-sm font-black text-gray-900 tabular-nums"
                >
                  {qty}
                </motion.span>
              </AnimatePresence>

              <motion.button
                whileTap={{ scale: 0.8 }}
                transition={SPRING_SNAP}
                onClick={handleAdd}
                className="w-8 h-8 rounded-full bg-nurei-cta flex items-center justify-center text-gray-900 shadow-sm shadow-nurei-cta/30 active:brightness-95 transition-all duration-150"
              >
                <PlusIcon />
              </motion.button>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.85 }}
              transition={SPRING_SNAP}
              onClick={handleAdd}
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-md bg-nurei-cta text-gray-900 shadow-nurei-cta/30 active:brightness-95 transition-all duration-150"
            >
              <AnimatePresence mode="wait" initial={false}>
                {added ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }}
                    transition={SPRING_SNAP}
                  >
                    <CheckIcon />
                  </motion.span>
                ) : (
                  <motion.span
                    key="plus"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={SPRING_SNAP}
                  >
                    <PlusIcon />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </div>
      </motion.div>
    </Link>
  )
}
