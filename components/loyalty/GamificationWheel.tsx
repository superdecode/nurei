'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/lib/stores/cart'
import { useAuthStore } from '@/lib/stores/auth'
import { useLoyaltyStore } from '@/lib/stores/loyaltyStore'

const WHEEL_THRESHOLD_CENTS = 39900

const PRIZE_LABELS: Record<string, string> = {
  no_prize: '¡Suerte para la próxima!',
  discount_pct_5: '5% de descuento',
  discount_pct_10: '10% de descuento',
  free_shipping: 'Envío gratis',
  points_multiplier_2x: 'Puntos x2 por 24 horas',
}

export function GamificationWheel() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const items = useCartStore((s) => s.items)
  const cartSessionId = useCartStore((s) => s.cartSessionId)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const spinWheel = useLoyaltyStore((s) => s.spinWheel)

  const [open, setOpen] = useState(false)
  const [dismissedSessionId, setDismissedSessionId] = useState<string | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ prizeType: string; couponCode: string | null } | null>(null)
  const hasAutoOpenedRef = useRef<string | null>(null)

  const subtotal = items.length > 0 ? getSubtotal() : 0

  useEffect(() => {
    if (!isAuthenticated) return
    if (subtotal < WHEEL_THRESHOLD_CENTS) return
    if (dismissedSessionId === cartSessionId) return
    if (hasAutoOpenedRef.current === cartSessionId) return

    hasAutoOpenedRef.current = cartSessionId
    setOpen(true)
    setResult(null)
  }, [isAuthenticated, subtotal, cartSessionId, dismissedSessionId])

  const handleClose = () => {
    setOpen(false)
    setDismissedSessionId(cartSessionId)
  }

  const handleSpin = async () => {
    setSpinning(true)
    const outcome = await spinWheel(cartSessionId, subtotal)
    // Keep the spin animation visible for a beat even if the network call is instant.
    await new Promise((resolve) => setTimeout(resolve, 1400))
    setSpinning(false)

    if (outcome.ok) {
      setResult({ prizeType: outcome.prizeType, couponCode: outcome.couponCode })
    } else {
      setResult({ prizeType: 'no_prize', couponCode: null })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle>¡Ruleta de Snacks!</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <motion.div
              animate={spinning ? { rotate: 360 * 4 } : { rotate: 0 }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className="flex h-32 w-32 items-center justify-center rounded-full border-8 border-primary/30 bg-gradient-to-br from-amber-200 to-rose-200 text-4xl"
            >
              🎡
            </motion.div>
            <p className="text-sm text-muted-foreground">
              Tu carrito califica para un giro gratis.
            </p>
            <Button onClick={handleSpin} disabled={spinning}>
              {spinning ? 'Girando...' : 'Girar la ruleta'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="text-5xl" aria-hidden>
              {result.prizeType === 'no_prize' ? '😅' : '🎉'}
            </span>
            <p className="text-lg font-semibold">{PRIZE_LABELS[result.prizeType]}</p>
            {result.couponCode && (
              <p className="text-sm text-muted-foreground">
                Código <span className="font-mono font-semibold">{result.couponCode}</span> guardado en tus cupones.
              </p>
            )}
            <Button variant="outline" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
