'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, PartyPopper } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CartItem } from './CartItem'
import { useCartStore } from '@/lib/stores/cart'
import { useUIStore } from '@/lib/stores/ui'
import { formatPrice } from '@/lib/utils/format'
import { useStoreCheckout } from '@/components/providers/StoreCheckoutProvider'
import { computeStandardShippingFeeCents } from '@/lib/store/normalize-checkout-settings'

function AnimatedPrice({ value, className }: { value: number; className?: string }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={value}
        initial={{ y: -8, opacity: 0, filter: 'blur(3px)' }}
        animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
        exit={{ y: 8, opacity: 0, filter: 'blur(3px)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className={className}
      >
        {formatPrice(value)}
      </motion.span>
    </AnimatePresence>
  )
}

function AnimatedBadge({ count }: { count: number }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={count}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.3, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-nurei-cta text-nurei-black text-xs font-bold"
      >
        {count}
      </motion.span>
    </AnimatePresence>
  )
}

function EmptyCartIllustration() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-12">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        className="relative"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 -m-6 rounded-full bg-nurei-cta/10"
        />
        <motion.div
          animate={{ y: [-6, 6, -6] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl"
        >
          🛒
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="text-center space-y-2"
      >
        <p className="text-gray-900 font-black text-lg">Tu carrito está vacío</p>
        <p className="text-gray-500 text-sm font-medium">¡Agrega tus snacks favoritos! 😋</p>
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Link href="/menu">
          <Button
            variant="outline"
            className="border-nurei-cta text-nurei-cta hover:bg-nurei-cta hover:text-nurei-black gap-2 h-12 px-8 rounded-full font-bold transition-all"
          >
            Ver menú
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </motion.div>
    </div>
  )
}

function ProgressBar({
  subtotal,
  freeShippingMin,
}: {
  subtotal: number
  freeShippingMin: number | null
}) {
  const threshold = typeof freeShippingMin === 'number' && freeShippingMin > 0 ? freeShippingMin : null
  const progress = threshold ? Math.min((subtotal / threshold) * 100, 100) : 0
  const remaining = threshold ? threshold - subtotal : 0
  const freeShipping = threshold ? subtotal >= threshold : false

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mx-4 sm:mx-5 mb-2 sm:mb-2 p-3 sm:p-2.5 rounded-2xl sm:rounded-xl bg-gray-50 border border-gray-100"
    >
      <div className="relative">
        <div className="h-1.5 sm:h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.3 }}
            className={`h-full rounded-full transition-colors ${
              freeShipping
                ? 'bg-gradient-to-r from-nurei-stock to-emerald-400'
                : 'bg-gradient-to-r from-nurei-cta to-nurei-cta-hover'
            }`}
          />
        </div>

        <AnimatePresence mode="wait">
          {!threshold ? null : freeShipping ? (
            <motion.p
              key="met"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-1.5 text-[11px] sm:text-xs text-nurei-stock font-semibold mt-1.5 sm:mt-1 leading-tight"
            >
              <PartyPopper className="w-3.5 h-3.5" />
              ¡Envío gratis desbloqueado! 🎉
            </motion.p>
          ) : (
            <motion.p
              key="not-met"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-[11px] sm:text-xs text-gray-500 mt-1.5 sm:mt-1 font-medium leading-tight"
            >
              Agrega <span className="font-bold text-nurei-cta">{formatPrice(Math.max(remaining, 0))}</span> más para envío gratis 🚚
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export function CartDrawer() {
  const items = useCartStore((s) => s.items)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const getTotal = useCartStore((s) => s.getTotal)
  const getItemCount = useCartStore((s) => s.getItemCount)
  const isCartOpen = useUIStore((s) => s.isCartOpen)
  const closeCart = useUIStore((s) => s.closeCart)

  const { bootstrap, loading: checkoutLoading } = useStoreCheckout()

  const minOrder = bootstrap?.checkout.min_order_cents ?? 0
  const freeShipMin = bootstrap?.shipping.free_shipping_min_cents ?? null
  const defaultShipFee = bootstrap?.shipping.standard_fee_cents ?? 0

  const subtotal = getSubtotal()
  const shippingCfg = bootstrap?.shipping
  const shippingFee = shippingCfg ? computeStandardShippingFeeCents(subtotal, shippingCfg) : 0
  const qualifiesFree =
    typeof freeShipMin === 'number' && freeShipMin > 0 ? subtotal >= freeShipMin : false
  const total = getTotal(shippingFee)
  const itemCount = getItemCount()
  const meetsMinimum =
    !checkoutLoading && bootstrap !== null && subtotal >= minOrder

  return (
    <Sheet open={isCartOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent
        showCloseButton={false}
        className="w-full sm:max-w-[450px] flex flex-col p-0 h-full max-h-[100dvh] sm:max-h-full bg-white border-l border-gray-100"
      >
        {/* Header */}
        <SheetHeader className="px-5 sm:px-6 py-4 sm:py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SheetTitle className="text-lg sm:text-xl font-black text-gray-900 flex items-center gap-2">
                🛒 Mi carrito
              </SheetTitle>
              {itemCount > 0 && <AnimatedBadge count={itemCount} />}
            </div>
            <motion.button
              whileTap={{ scale: 0.85, rotate: -90 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              onClick={closeCart}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-50 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </motion.button>
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <EmptyCartIllustration />
        ) : (
          <>
            <div className="pt-1 sm:pt-2">
              <ProgressBar subtotal={subtotal} freeShippingMin={freeShipMin} />
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-2 scrollbar-none">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <CartItem key={item.product.id} item={item} />
                ))}
              </AnimatePresence>
            </div>

            {/* Footer summary */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="border-t border-gray-100 bg-white px-5 sm:px-6 py-4 sm:py-4 space-y-2.5 flex-shrink-0"
            >
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Subtotal</span>
                <AnimatedPrice value={subtotal} className="font-black text-gray-900" />
              </div>

              <div className="flex justify-between items-center text-sm gap-2">
                <span className="text-gray-500 font-medium shrink-0">Envío</span>
                <span className={`font-black text-right leading-tight ${shippingFee === 0 ? 'text-emerald-500' : 'text-gray-900'}`}>
                  {shippingFee === 0 && qualifiesFree && defaultShipFee > 0 ? (
                    <span className="inline-flex flex-col items-end">
                      <span className="text-[10px] text-gray-400 line-through font-semibold">{formatPrice(defaultShipFee)}</span>
                      <span>¡GRATIS! 🎉</span>
                    </span>
                  ) : shippingFee === 0 ? (
                    '¡Gratis! 🎉'
                  ) : (
                    formatPrice(shippingFee)
                  )}
                </span>
              </div>

              <Separator className="!my-2 bg-gray-100" />

              <div className="flex justify-between items-center">
                <span className="font-bold text-base sm:text-lg text-gray-900">Total</span>
                <AnimatedPrice value={total} className="font-black text-xl sm:text-2xl text-gray-900" />
              </div>

              <AnimatePresence>
                {!meetsMinimum && bootstrap !== null && minOrder > 0 && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs text-nurei-promo text-center overflow-hidden"
                  >
                    Pedido mínimo: {formatPrice(minOrder)}. Faltan {formatPrice(minOrder - subtotal)} 😊
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.div
                whileTap={{ scale: meetsMinimum ? 0.98 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                {meetsMinimum ? (
                  <Link href="/checkout" onClick={closeCart} className="block">
                    <Button
                      className="w-full h-12 sm:h-12 text-base font-bold bg-nurei-cta text-nurei-black hover:bg-nurei-cta-hover rounded-2xl gap-2 transition-all shadow-lg shadow-nurei-cta/20"
                    >
                      Continuar al pago
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                ) : (
                  <Button
                    className="w-full h-12 sm:h-12 text-base font-bold bg-nurei-cta text-nurei-black hover:bg-nurei-cta-hover disabled:opacity-40 rounded-2xl gap-2 transition-all"
                    disabled
                  >
                    Continuar al pago
                  </Button>
                )}
              </motion.div>
            </motion.div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
