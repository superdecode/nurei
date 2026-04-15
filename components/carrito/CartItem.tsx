'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { Minus, Plus, Trash2, ChevronLeft } from 'lucide-react'
import { useCartStore } from '@/lib/stores/cart'
import { formatPrice } from '@/lib/utils/format'
import type { CartItem as CartItemType } from '@/types'

interface CartItemProps {
  item: CartItemType
  onRemove?: () => void
}

const springConfig = { type: 'spring' as const, stiffness: 500, damping: 30 }

export function CartItem({ item, onRemove }: CartItemProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const [prevPrice, setPrevPrice] = useState(item.product.price * item.quantity)
  const [showSwipeHint, setShowSwipeHint] = useState(true)
  const dragX = useMotionValue(0)
  const deleteOpacity = useTransform(dragX, [-120, -60], [1, 0])
  const deleteScale = useTransform(dragX, [-120, -60, 0], [1, 0.8, 0.5])
  const currentPrice = item.product.price * item.quantity

  // Hide swipe hint after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowSwipeHint(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  // Track price changes for animation
  useEffect(() => {
    if (currentPrice !== prevPrice) {
      setPrevPrice(currentPrice)
    }
  }, [currentPrice, prevPrice])

  const handleRemove = () => {
    if (onRemove) {
      onRemove()
    } else {
      removeItem(item.product.id)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -200, transition: { duration: 0.3, ease: [0.32, 0, 0.67, 0] } }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-xl mb-2"
    >
      {/* Delete backdrop revealed on swipe */}
      <motion.div
        className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center rounded-r-xl"
        style={{ opacity: deleteOpacity, scale: deleteScale }}
      >
        <Trash2 className="w-5 h-5 text-white" />
      </motion.div>

      {/* Draggable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) {
            handleRemove()
          }
        }}
        style={{ x: dragX }}
        className="relative flex items-start gap-4 py-5 px-4 bg-white rounded-3xl border border-gray-100 cursor-grab active:cursor-grabbing shadow-sm"
      >
        {/* Product image */}
        <motion.div
          whileTap={{ scale: 0.95 }}
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gray-50 flex-shrink-0 flex items-center justify-center text-3xl border border-gray-100"
        >
          {item.product.image_thumbnail_url ? (
            <img
              src={item.product.image_thumbnail_url}
              alt={item.product.name}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <span>🍘</span>
          )}
        </motion.div>

        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-black text-gray-900 truncate tracking-tight">
            {item.product.name}
          </p>
          <p className="text-xs text-gray-400 font-bold uppercase mt-1">
            {formatPrice(item.product.price)} c/u
          </p>

          <div className="flex items-center justify-between mt-2.5">
            {/* Quantity controls */}
            <div className="flex items-center gap-1">
              <motion.button
                whileTap={{ scale: 0.8 }}
                transition={springConfig}
                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors touch-target text-gray-400"
              >
                <Minus className="w-3.5 h-3.5" />
              </motion.button>

              <div className="w-8 h-8 flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={item.quantity}
                    initial={{ y: -16, opacity: 0, scale: 0.8 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 16, opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="text-sm font-black text-gray-900"
                  >
                    {item.quantity}
                  </motion.span>
                </AnimatePresence>
              </div>

              <motion.button
                whileTap={{ scale: 0.8 }}
                transition={springConfig}
                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors touch-target text-gray-400"
              >
                <Plus className="w-3.5 h-3.5" />
              </motion.button>
            </div>

            {/* Animated price + delete */}
            <div className="flex items-center gap-2.5">
              <div className="overflow-hidden">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={currentPrice}
                    initial={{ y: -12, opacity: 0, filter: 'blur(4px)' }}
                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                    exit={{ y: 12, opacity: 0, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className="text-sm font-bold text-nurei-cta block"
                  >
                    {formatPrice(currentPrice)}
                  </motion.span>
                </AnimatePresence>
              </div>

              <motion.button
                whileTap={{ scale: 0.75, rotate: -10 }}
                transition={springConfig}
                onClick={handleRemove}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-nurei-muted/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Swipe hint indicator */}
        <AnimatePresence>
          {showSwipeHint && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: [0, -6, 0] }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 0.3 },
                x: { duration: 1.2, repeat: 2, ease: 'easeInOut' },
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-nurei-muted/30"
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
