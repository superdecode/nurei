'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/lib/stores/cart'
import { formatPrice } from '@/lib/utils/format'
import { useStoreCheckout } from '@/components/providers/StoreCheckoutProvider'
import { computeStandardShippingFeeCents } from '@/lib/store/normalize-checkout-settings'
import { CartSummaryModal } from './CartSummaryModal'

const ArrowRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)

const ChevronUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M18 15l-6-6-6 6" />
  </svg>
)

export function CartBottomBar() {
  const items = useCartStore((s) => s.items)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const getItemCount = useCartStore((s) => s.getItemCount)
  const [modalOpen, setModalOpen] = useState(false)
  const { bootstrap, loading: checkoutLoading } = useStoreCheckout()

  const subtotal = getSubtotal()
  const shippingCfg = bootstrap?.shipping
  const shippingFee = shippingCfg ? computeStandardShippingFeeCents(subtotal, shippingCfg) : 0
  const minOrder = bootstrap?.checkout.min_order_cents ?? 0
  const meetsMinimum =
    !checkoutLoading && bootstrap !== null && subtotal >= minOrder
  const itemCount = getItemCount()
  const hasItems = items.length > 0

  return (
    <>
      <CartSummaryModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <AnimatePresence>
        {hasItems && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 inset-x-0 z-40 sm:hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"
          >
            <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/80 border border-gray-100 flex items-center overflow-hidden">

              {/* Total area — click opens modal */}
              <button
                onClick={() => setModalOpen(true)}
                className="flex-1 flex items-start flex-col px-4 py-3.5 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-gray-400">
                  <span className="text-xs font-medium">
                    {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
                  </span>
                  <motion.span
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <ChevronUpIcon />
                  </motion.span>
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={subtotal}
                      initial={{ y: -10, opacity: 0, filter: 'blur(4px)' }}
                      animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                      exit={{ y: 10, opacity: 0, filter: 'blur(4px)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      className="text-xl font-black text-gray-900 tabular-nums tracking-tight"
                    >
                      {formatPrice(subtotal)}
                    </motion.span>
                  </AnimatePresence>
                  {shippingFee === 0 && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"
                    >
                      Envío gratis
                    </motion.span>
                  )}
                </div>
              </button>

              {/* Confirm button */}
              <div className="pr-3">
                {meetsMinimum ? (
                  <Link href="/checkout">
                    <motion.span
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-2 bg-nurei-cta text-gray-900 px-5 py-3.5 rounded-xl font-black text-sm shadow-lg shadow-nurei-cta/20 cursor-pointer"
                    >
                      Confirmar
                      <ArrowRightIcon />
                    </motion.span>
                  </Link>
                ) : (
                  <motion.span
                    aria-disabled
                    className="flex items-center gap-2 bg-nurei-cta/35 text-gray-900/45 px-5 py-3.5 rounded-xl font-black text-sm cursor-not-allowed select-none"
                  >
                    Confirmar
                    <ArrowRightIcon />
                  </motion.span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
