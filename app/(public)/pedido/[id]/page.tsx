'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, MessageCircle, MapPin, Package, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Container } from '@/components/layout/Container'
import { OrderTimeline } from '@/components/pedido/OrderTimeline'
import { formatPrice } from '@/lib/utils/format'
import { ORDER_STATUS_MAP, SUPPORT_PHONE } from '@/lib/utils/constants'
import { calculateShippingDays } from '@/lib/utils/calculations'
import type { Order, OrderStatus } from '@/types'

// ──────────────────────────────────────────────
// Confetti particles
// ──────────────────────────────────────────────
function ConfettiParticles() {
  const particles = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 1.2 + Math.random() * 1,
    size: 4 + Math.random() * 6,
    color: ['#00E5FF', '#10B981', '#F59E0B', '#4DEFFB', '#25D366'][i % 5],
  }))

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            left: `${p.x}%`,
            top: '-8px',
          }}
          initial={{ y: 0, opacity: 1, scale: 1 }}
          animate={{
            y: [0, 60 + Math.random() * 40],
            opacity: [1, 1, 0],
            scale: [1, 0.6],
            x: [0, (Math.random() - 0.5) * 40],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────
// Celebration animation for delivered status
// ──────────────────────────────────────────────
function CelebrationParticles() {
  const particles = Array.from({ length: 32 }, (_, i) => ({
    id: i,
    angle: (i / 32) * 360,
    distance: 60 + Math.random() * 80,
    delay: Math.random() * 0.4,
    size: 3 + Math.random() * 5,
    color: ['#10B981', '#00E5FF', '#F59E0B', '#4DEFFB', '#25D366'][i % 5],
  }))

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => {
        const radians = (p.angle * Math.PI) / 180
        const endX = Math.cos(radians) * p.distance
        const endY = Math.sin(radians) * p.distance

        return (
          <motion.div
            key={p.id}
            className="absolute rounded-full left-1/2 top-1/2"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: endX,
              y: endY,
              opacity: [1, 1, 0],
              scale: [0, 1.2, 0],
            }}
            transition={{
              duration: 1.2,
              delay: p.delay,
              ease: 'easeOut',
            }}
          />
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────
// Status icon with animation
// ──────────────────────────────────────────────
function StatusIcon({ status, icon }: { status: OrderStatus; icon: string }) {
  const isDelivered = status === 'delivered'
  const isShipped = status === 'shipped'
  const isCancelled = status === 'cancelled' || status === 'failed'

  return (
    <motion.span
      className="text-6xl sm:text-7xl block"
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
    >
      <motion.span
        className="inline-block"
        animate={
          isShipped
            ? { x: [0, 4, -2, 4, 0], rotate: [0, 2, -1, 2, 0] }
            : isDelivered
              ? { scale: [1, 1.15, 1] }
              : isCancelled
                ? { opacity: [1, 0.5, 1] }
                : { scale: [1, 1.08, 1] }
        }
        transition={{
          duration: isShipped ? 1.5 : 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {icon}
      </motion.span>
    </motion.span>
  )
}

// ──────────────────────────────────────────────
// Main tracking page
// ──────────────────────────────────────────────
export default function TrackingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const isSuccess = searchParams.get('success') === 'true'
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [showConfetti, setShowConfetti] = useState(isSuccess)

  // Fetch order
  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${params.id}`)
        if (res.ok) {
          const { data } = await res.json()
          setOrder(data)
        }
      } catch {
        // Order not found
      } finally {
        setLoading(false)
      }
    }
    fetchOrder()
  }, [params.id])

  // Hide confetti after animation
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showConfetti])

  if (loading) {
    return (
      <Container className="py-20 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-primary-cyan border-t-transparent rounded-full mx-auto"
        />
        <p className="text-gray-400 mt-4">Cargando pedido...</p>
      </Container>
    )
  }

  if (!order) {
    return (
      <Container className="py-20 text-center">
        <p className="text-6xl mb-4">📦</p>
        <h1 className="text-2xl font-bold text-primary-dark mb-2">Pedido no encontrado</h1>
        <p className="text-gray-400 mb-6">Verifica tu número de pedido</p>
        <Link href="/">
          <Button className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover">
            Volver al inicio
          </Button>
        </Link>
      </Container>
    )
  }

  const statusInfo = ORDER_STATUS_MAP[order.status]
  const isDelivered = order.status === 'delivered'
  const isCancelled = order.status === 'cancelled' || order.status === 'failed'
  const shippingEstimate = calculateShippingDays(order.status)

  return (
    <motion.section
      className="py-6 sm:py-8 pb-24"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Container className="max-w-2xl px-4 sm:px-6">
        {/* Success banner */}
        <AnimatePresence>
          {isSuccess && (
            <motion.div
              className="relative mb-6 bg-success/10 border border-success/20 rounded-xl p-4 text-center overflow-hidden"
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.5, type: 'spring', stiffness: 200, damping: 20 }}
            >
              {showConfetti && <ConfettiParticles />}
              <motion.p
                className="text-success font-semibold text-base relative z-10"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
              >
                <PartyPopper className="inline-block w-5 h-5 mr-1.5 -mt-0.5" />
                Pago confirmado!
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status header */}
        <motion.div
          className="text-center mb-6 sm:mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <StatusIcon status={order.status} icon={statusInfo.icon ?? '📦'} />

          <motion.h1
            className={`text-2xl sm:text-3xl font-bold mt-3 ${statusInfo.color}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            {statusInfo.label}
          </motion.h1>

          <motion.div
            className="mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <Badge variant="secondary" className="text-xs tracking-wide font-mono">
              {order.short_id}
            </Badge>
          </motion.div>
        </motion.div>

        {/* Shipping estimate */}
        <AnimatePresence mode="wait">
          {!isDelivered && !isCancelled && (
            <motion.div
              key="shipping-card"
              className="relative bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 border-2 border-primary-cyan/30 rounded-2xl p-6 sm:p-8 text-center mb-6 sm:mb-8 overflow-hidden"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ delay: 0.2, duration: 0.5, type: 'spring', stiffness: 200, damping: 22 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
              />
              <div className="relative z-10">
                <p className="text-gray-500 font-medium text-sm mb-2">Tiempo estimado de entrega</p>
                <p className="text-3xl sm:text-4xl font-black text-primary-dark">{shippingEstimate}</p>
                <p className="text-xs text-gray-400 mt-2">Gestionado por empresa de paquetería externa</p>
              </div>
            </motion.div>
          )}

          {isDelivered && (
            <motion.div
              key="delivered-card"
              className="relative bg-success/10 border-2 border-success/30 rounded-2xl p-8 text-center mb-6 sm:mb-8 overflow-hidden"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 180, damping: 14, duration: 0.6 }}
            >
              <CelebrationParticles />
              <motion.div
                className="relative z-10"
                initial={{ scale: 0.8 }}
                animate={{ scale: [0.8, 1.1, 1] }}
                transition={{ delay: 0.2, duration: 0.6, ease: 'easeOut' }}
              >
                <p className="text-3xl sm:text-4xl font-black text-success">Entregado</p>
                <p className="text-gray-500 mt-2 text-sm sm:text-base">Gracias por tu pedido en nurei</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timeline */}
        <motion.div
          className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm mb-4 sm:mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <OrderTimeline currentStatus={order.status} createdAt={order.created_at} />
        </motion.div>

        {/* Order details accordion */}
        <motion.div
          className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4 sm:mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-primary-cyan font-medium hover:bg-gray-50/80 transition-colors touch-target"
          >
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Ver detalles pedido
            </span>
            <motion.div
              animate={{ rotate: detailsOpen ? 180 : 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <ChevronDown className="w-5 h-5" />
            </motion.div>
          </button>

          <AnimatePresence initial={false}>
            {detailsOpen && (
              <motion.div
                key="details-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="px-4 sm:px-5 pb-5 space-y-4">
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <motion.div
                        key={item.product_id}
                        className="flex justify-between text-sm"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.08, duration: 0.3 }}
                      >
                        <span className="text-gray-600">
                          {item.name} &times; {item.quantity}
                        </span>
                        <span className="font-medium">{formatPrice(item.subtotal)}</span>
                      </motion.div>
                    ))}
                    <motion.div
                      className="border-t pt-2 space-y-1 text-sm"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal</span>
                        <span>{formatPrice(order.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Envío</span>
                        <span>{order.shipping_fee === 0 ? 'Gratis' : formatPrice(order.shipping_fee)}</span>
                      </div>
                      {order.coupon_discount > 0 && (
                        <div className="flex justify-between text-nurei-stock">
                          <span>Cupón {order.coupon_code}</span>
                          <span>-{formatPrice(order.coupon_discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-base pt-1">
                        <span>Total</span>
                        <span>{formatPrice(order.total)}</span>
                      </div>
                    </motion.div>
                  </div>

                  {/* Address */}
                  <motion.div
                    className="text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Direccion</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary-cyan flex-shrink-0" />
                      {order.delivery_address}
                    </p>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* WhatsApp support */}
        <motion.div
          className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <p className="text-sm text-gray-500 mb-3">Necesitas ayuda?</p>
          <a
            href={`https://wa.me/52${SUPPORT_PHONE}?text=${encodeURIComponent(`Hola, necesito ayuda con mi pedido ${order.short_id}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="relative">
              <motion.div
                className="absolute inset-0 rounded-lg bg-whatsapp/20"
                animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <Button className="w-full bg-whatsapp text-white hover:bg-whatsapp/90 relative z-10 h-10 text-sm font-semibold">
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp soporte
              </Button>
            </motion.div>
          </a>
        </motion.div>

        {/* Back to home */}
        <motion.div
          className="text-center mt-6 sm:mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Link href="/" className="text-sm text-gray-400 hover:text-primary-cyan transition-colors">
            &larr; Volver al inicio
          </Link>
        </motion.div>
      </Container>
    </motion.section>
  )
}
