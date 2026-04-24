'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/lib/stores/cart'
import { formatPrice } from '@/lib/utils/format'
import { useStoreCheckout } from '@/components/providers/StoreCheckoutProvider'
import { computeStandardShippingFeeCents } from '@/lib/store/normalize-checkout-settings'
import type { CartItem } from '@/types'

// SVG Icons
const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const MinusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <path d="M5 12h14" />
  </svg>
)
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
)
const CheckAllIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M2 12l5 5L22 4M9 12l5 5" />
  </svg>
)
const ArrowRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)

interface CartSummaryModalProps {
  open: boolean
  onClose: () => void
}

function CartItemRow({ item, selected, onToggleSelect }: { item: CartItem; selected: boolean; onToggleSelect: () => void }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const price = item.product.base_price ?? item.product.price
  const hasDiscount = !!item.product.compare_at_price && item.product.compare_at_price > price
  const lineTotal = price * item.quantity

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
      className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
        selected ? 'border-nurei-cta bg-nurei-warm' : 'border-gray-100 bg-white'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
          selected ? 'bg-nurei-cta border-nurei-cta' : 'border-gray-300 bg-white'
        }`}
      >
        {selected && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-gray-900">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </button>

      {/* Image */}
      <div className="w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
        {(item.product.images?.[item.product.primary_image_index] ?? item.product.image_thumbnail_url) ? (
          <img
            src={item.product.images?.[item.product.primary_image_index] ?? item.product.image_thumbnail_url!}
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xl opacity-30">🍘</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 line-clamp-1">{item.product.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {hasDiscount && (
            <span className="text-[10px] text-gray-300 line-through tabular-nums">{formatPrice(item.product.compare_at_price!)}</span>
          )}
          <span className="text-xs font-bold text-nurei-muted tabular-nums">{formatPrice(price)} c/u</span>
        </div>

        {/* Qty controls */}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
              className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-gray-600 shadow-sm"
            >
              <MinusIcon />
            </motion.button>
            <AnimatePresence mode="popLayout">
              <motion.span
                key={item.quantity}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="w-6 text-center text-sm font-black text-gray-900 tabular-nums"
              >
                {item.quantity}
              </motion.span>
            </AnimatePresence>
            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
              className="w-7 h-7 rounded-full bg-nurei-cta flex items-center justify-center text-gray-900 shadow-sm"
            >
              <PlusIcon />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Line total + delete */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={lineTotal}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="text-sm font-black text-gray-900 tabular-nums"
          >
            {formatPrice(lineTotal)}
          </motion.span>
        </AnimatePresence>
        <motion.button
          whileTap={{ scale: 0.75, rotate: -10 }}
          onClick={() => removeItem(item.product.id)}
          className="text-gray-300 hover:text-red-400 transition-colors"
        >
          <TrashIcon />
        </motion.button>
      </div>
    </motion.div>
  )
}

export function CartSummaryModal({ open, onClose }: CartSummaryModalProps) {
  const items = useCartStore((s) => s.items)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const getTotal = useCartStore((s) => s.getTotal)
  const clearCart = useCartStore((s) => s.clearCart)
  const removeItem = useCartStore((s) => s.removeItem)
  const { bootstrap, loading: checkoutLoading } = useStoreCheckout()

  const [selected, setSelected] = useState<Set<string>>(new Set())

  const subtotal = getSubtotal()
  const shippingCfg = bootstrap?.shipping
  const shippingFee = shippingCfg ? computeStandardShippingFeeCents(subtotal, shippingCfg) : 0
  const total = getTotal(shippingFee)
  const minOrder = bootstrap?.checkout.min_order_cents ?? 0
  const freeShipMin = bootstrap?.shipping.free_shipping_min_cents
  const qualifiesFree =
    typeof freeShipMin === 'number' && freeShipMin > 0 ? subtotal >= freeShipMin : false
  const missingForFree =
    typeof freeShipMin === 'number' && freeShipMin > 0 && !qualifiesFree
      ? Math.max(0, freeShipMin - subtotal)
      : null
  const meetsMinimum =
    !checkoutLoading && bootstrap !== null && subtotal >= minOrder

  const isAllSelected = items.length > 0 && selected.size === items.length

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectAll = () => setSelected(new Set(items.map((i) => i.product.id)))
  const clearSelection = () => setSelected(new Set())

  const removeSelected = () => {
    selected.forEach((id) => removeItem(id))
    clearSelection()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm sm:hidden"
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose()
            }}
            className="fixed inset-x-0 bottom-0 z-50 sm:hidden flex flex-col bg-white rounded-t-3xl shadow-2xl max-h-[85dvh]"
          >
            {/* Drag handle — tap or drag down to dismiss */}
            <div
              className="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing"
              style={{ touchAction: 'none' }}
            >
              <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🛒</span>
                <h2 className="text-base font-black text-gray-900">Mi pedido</h2>
                {items.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-nurei-cta text-gray-900 text-xs font-black">
                    {items.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <XIcon />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 px-6">
                <span className="text-5xl">🛒</span>
                <p className="text-gray-900 font-black text-base">Tu carrito está vacío</p>
                <p className="text-gray-400 text-sm">¡Agrega tus snacks favoritos!</p>
              </div>
            ) : (
              <>
                {/* Action bar */}
                <div className="flex items-center gap-2 px-5 py-2.5 border-b border-gray-50 flex-shrink-0">
                  <button
                    onClick={isAllSelected ? clearSelection : selectAll}
                    className="flex items-center gap-1.5 text-xs font-bold text-nurei-muted hover:text-nurei-cta transition-colors"
                  >
                    <CheckAllIcon />
                    {isAllSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>

                  <AnimatePresence>
                    {selected.size > 0 && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={removeSelected}
                        className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-500 transition-colors ml-auto"
                      >
                        <TrashIcon />
                        Eliminar ({selected.size})
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {selected.size === 0 && (
                    <button
                      onClick={() => { clearCart(); onClose() }}
                      className="flex items-center gap-1.5 text-xs font-bold text-red-300 hover:text-red-400 transition-colors ml-auto"
                    >
                      <TrashIcon />
                      Vaciar carrito
                    </button>
                  )}
                </div>

                {/* Items list */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-none">
                  <AnimatePresence mode="popLayout">
                    {items.map((item) => (
                      <CartItemRow
                        key={item.product.id}
                        item={item}
                        selected={selected.has(item.product.id)}
                        onToggleSelect={() => toggleSelect(item.product.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 bg-white px-5 py-4 space-y-2 flex-shrink-0 pb-[env(safe-area-inset-bottom)]">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400 font-medium">Subtotal</span>
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={subtotal}
                        initial={{ y: -6, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 6, opacity: 0 }}
                        className="font-black text-gray-900 tabular-nums"
                      >
                        {formatPrice(subtotal)}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  <div className="flex justify-between items-start gap-2 text-sm">
                    <span className="text-gray-400 font-medium shrink-0 pt-0.5">Envío</span>
                    <div className="flex flex-col items-end gap-0.5 min-w-0 text-right">
                      <span className={`font-black ${shippingFee === 0 ? 'text-emerald-500' : 'text-gray-900'}`}>
                        {shippingFee === 0 ? '¡Gratis! 🎉' : formatPrice(shippingFee)}
                      </span>
                      {missingForFree !== null && missingForFree > 0 && (
                        <span className="text-[11px] font-semibold text-red-500 leading-tight">
                          Te faltan {formatPrice(missingForFree)} para envío gratis
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                    <span className="font-black text-gray-900 text-base">Total</span>
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={total}
                        initial={{ y: -8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 8, opacity: 0 }}
                        className="font-black text-xl text-gray-900 tabular-nums"
                      >
                        {formatPrice(total)}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  <AnimatePresence>
                    {!meetsMinimum && bootstrap !== null && minOrder > 0 && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="text-xs text-nurei-promo text-center overflow-hidden font-medium"
                      >
                        Pedido mínimo: {formatPrice(minOrder)} — Faltan {formatPrice(Math.max(0, minOrder - subtotal))}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {meetsMinimum ? (
                    <Link href="/checkout" onClick={onClose} className="block">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        className="w-full h-13 flex items-center justify-center gap-2 bg-nurei-cta text-gray-900 rounded-2xl font-black text-base shadow-lg shadow-nurei-cta/25 transition-all hover:bg-nurei-cta-hover"
                      >
                        Continuar al pago
                        <ArrowRightIcon />
                      </motion.button>
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="w-full h-13 flex items-center justify-center gap-2 bg-nurei-cta/40 text-gray-900/50 rounded-2xl font-black text-base cursor-not-allowed"
                    >
                      Continuar al pago
                      <ArrowRightIcon />
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
