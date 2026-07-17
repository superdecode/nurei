'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useCartFlightStore, type CartFlightRect } from '@/lib/stores/cartFlight'

function getCenter(rect: CartFlightRect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
}

const DOT_SIZE = 16

export function CartFlightLayer() {
  const flight = useCartFlightStore((state) => state.flight)

  return (
    <AnimatePresence>
      {flight && (() => {
        const source = getCenter(flight.sourceRect)
        const target = getCenter(flight.targetRect)
        const midX = (source.x + target.x) / 2
        const midY = Math.min(source.y, target.y) - 70

        return (
          <motion.div
            key={flight.id}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-[170]"
          >
            <motion.div
              initial={{
                x: source.x - DOT_SIZE / 2,
                y: source.y - DOT_SIZE / 2,
                scale: 0.6,
                opacity: 0,
              }}
              animate={{
                x: [source.x - DOT_SIZE / 2, midX - DOT_SIZE / 2, target.x - DOT_SIZE / 2],
                y: [source.y - DOT_SIZE / 2, midY - DOT_SIZE / 2, target.y - DOT_SIZE / 2],
                scale: [0.6, 1.2, 0.3],
                opacity: [0, 1, 1, 0],
              }}
              exit={{ opacity: 0, scale: 0.2 }}
              transition={{
                duration: 0.6,
                times: [0, 0.4, 1],
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute left-0 top-0"
            >
              <div
                className="rounded-full bg-nurei-cta shadow-[0_6px_16px_rgba(255,193,7,0.5)]"
                style={{ width: DOT_SIZE, height: DOT_SIZE }}
              />
              {flight.quantity > 1 && (
                <span className="absolute -right-2 -top-2 min-w-4 h-4 px-1 rounded-full bg-gray-900 text-[9px] font-black text-white flex items-center justify-center leading-none">
                  x{flight.quantity}
                </span>
              )}
            </motion.div>
          </motion.div>
        )
      })()}
    </AnimatePresence>
  )
}
