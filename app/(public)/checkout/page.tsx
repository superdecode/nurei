'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Phone,
  Mail,
  MessageSquare,
  ShoppingBag,
  CheckCircle2,
  Package,
  CreditCard,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Tag,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Container } from '@/components/layout/Container'
import { useCartStore } from '@/lib/stores/cart'
import { formatPrice } from '@/lib/utils/format'
import { calculateShippingFee } from '@/lib/utils/calculations'
import { MIN_ORDER_AMOUNT, FREE_SHIPPING_THRESHOLD } from '@/lib/utils/constants'
import { checkoutFormSchema, type CheckoutFormData } from '@/lib/validations/order'
import type { ValidateCouponResponse } from '@/types'

// ============================================
// Animation variants
// ============================================
const easeCurve: [number, number, number, number] = [0.22, 1, 0.36, 1]

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeCurve } },
  exit: { opacity: 0, y: -12 },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeCurve } },
}

// ============================================
// Step definitions
// ============================================
const STEPS = [
  { id: 1, label: 'Direccion', icon: MapPin, fields: ['delivery_address', 'delivery_instructions'] },
  { id: 2, label: 'Datos', icon: Phone, fields: ['customer_phone', 'customer_email'] },
  { id: 3, label: 'Confirmar', icon: CreditCard, fields: [] },
] as const

// ============================================
// Sub-components
// ============================================

function StepIndicator({ activeStep }: { activeStep: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="flex items-center justify-center gap-1 sm:gap-2 mb-8"
    >
      {STEPS.map((step, index) => {
        const isActive = step.id === activeStep
        const isCompleted = step.id < activeStep
        const Icon = step.icon

        return (
            <div key={step.id} className="flex items-center">
            <motion.div
              animate={{
                scale: isActive ? 1 : 0.95,
                opacity: isActive || isCompleted ? 1 : 0.5,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors ${
                isActive
                  ? 'bg-nurei-cta text-gray-900 border border-nurei-cta'
                  : isCompleted
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-50 text-gray-400 border border-transparent'
              }`}
            >
              {isCompleted ? (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </motion.div>
              ) : (
                <Icon className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.id}</span>
            </motion.div>

            {index < STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-300 mx-0.5 sm:mx-1 flex-shrink-0" />
            )}
          </div>
        )
      })}
    </motion.div>
  )
}

function AnimatedErrorMessage({ message }: { message: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -4, height: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-1.5 text-xs text-error mt-1.5 overflow-hidden"
    >
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      {message}
    </motion.p>
  )
}

function SuccessOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ duration: 0.6, times: [0, 0.6, 1], ease: [0.22, 1, 0.36, 1] }}
        className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-6"
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 20 }}
        >
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </motion.div>
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-2xl font-bold text-primary-dark"
      >
        Pedido confirmado
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-gray-400 mt-2"
      >
        Redirigiendo al pago...
      </motion.p>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 120 }}
        transition={{ delay: 0.8, duration: 1, ease: 'linear' }}
        className="h-1 bg-primary-cyan rounded-full mt-4"
      />
    </motion.div>
  )
}

function EmptyCartState() {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      <Container className="py-20 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative inline-block mb-6"
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.25, 0.1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 -m-6 rounded-full bg-primary-cyan/10"
          />
          <motion.div
            animate={{ y: [-4, 4, -4] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center shadow-sm"
          >
            <ShoppingBag className="w-12 h-12 text-gray-300" strokeWidth={1.5} />
          </motion.div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-2xl font-bold text-primary-dark"
        >
          Tu carrito esta vacio
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-gray-400 mt-2"
        >
          Agrega productos antes de continuar
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-6"
        >
          <Link href="/menu">
            <Button className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover gap-2 h-12 px-6 rounded-xl font-semibold">
              Ver menu
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </Container>
    </motion.div>
  )
}

// ============================================
// Main Page Component
// ============================================
export default function CheckoutPage() {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const getTotal = useCartStore((s) => s.getTotal)
  const clearCart = useCartStore((s) => s.clearCart)
  const [processing, setProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeStep, setActiveStep] = useState(1)
  const formRef = useRef<HTMLFormElement>(null)

  // Coupon state
  const [couponCode, setCouponCode] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [showCouponInput, setShowCouponInput] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutFormSchema),
    mode: 'onTouched',
  })

  const subtotal = mounted ? getSubtotal() : 0
  const shippingFee = calculateShippingFee(subtotal)
  const total = mounted ? getTotal(shippingFee, couponDiscount) : 0

  // Watch fields to auto-advance the step indicator
  const watchedAddress = watch('delivery_address')
  const watchedPhone = watch('customer_phone')

  useEffect(() => {
    if (watchedPhone && watchedPhone.length >= 10) {
      setActiveStep(3)
    } else if (watchedAddress && watchedAddress.length >= 5) {
      setActiveStep(2)
    } else {
      setActiveStep(1)
    }
  }, [watchedAddress, watchedPhone])

  const handleApplyCoupon = useCallback(async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim().toUpperCase(), subtotal }),
      })
      const data: ValidateCouponResponse = await res.json()
      if (data.valid && data.discount_amount) {
        setCouponDiscount(data.discount_amount)
        setAppliedCoupon(couponCode.trim().toUpperCase())
        toast.success(`Cupón aplicado: -${formatPrice(data.discount_amount)}`, { icon: '🎉' })
      } else {
        toast.error(data.error || 'Cupón no válido', { icon: '❌' })
      }
    } catch {
      toast.error('Error validando cupón')
    } finally {
      setCouponLoading(false)
    }
  }, [couponCode, subtotal])

  const removeCoupon = useCallback(() => {
    setCouponDiscount(0)
    setAppliedCoupon(null)
    setCouponCode('')
    toast.success('Cupón removido')
  }, [])

  const onSubmit = useCallback(async (data: CheckoutFormData) => {
    if (subtotal < MIN_ORDER_AMOUNT) return
    setProcessing(true)

    try {
      // Create order
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          coupon_code: appliedCoupon || undefined,
          items: items.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
        }),
      })

      if (!orderRes.ok) throw new Error('Error creando pedido')
      const { data: order } = await orderRes.json()

      // Create Stripe checkout session
      const paymentRes = await fetch('/api/payment/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.order_id }),
      })

      if (!paymentRes.ok) throw new Error('Error creando sesion de pago')
      const { data: payment } = await paymentRes.json()

      // Show success animation then redirect
      setShowSuccess(true)
      clearCart()

      setTimeout(() => {
        if (payment.checkout_url) {
          window.location.href = payment.checkout_url
        } else {
          router.push(`/pedido/${order.order_id}?success=true`)
        }
      }, 1800)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error procesando pedido'
      toast.error(message)
      setProcessing(false)
    }
  }, [subtotal, items, clearCart, router, appliedCoupon])

  // Empty cart redirect
  if (mounted && items.length === 0 && !showSuccess) {
    return <EmptyCartState />
  }

  const freeShippingRemaining = FREE_SHIPPING_THRESHOLD - subtotal

  return (
    <>
      {/* Success overlay */}
      <AnimatePresence>
        {showSuccess && <SuccessOverlay />}
      </AnimatePresence>

      <motion.section
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className="py-6 sm:py-8 pb-32 lg:pb-24 bg-gray-50 min-h-screen"
      >
        <Container className="max-w-5xl">
          {/* Back link */}
          <motion.div variants={fadeUp}>
            <Link
              href="/menu"
              className="inline-flex items-center text-sm text-gray-400 hover:text-primary-dark transition-colors mb-5 sm:mb-6 gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al menu
            </Link>
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={fadeUp}
            className="text-2xl sm:text-3xl font-bold text-primary-dark mb-2"
          >
            Checkout
          </motion.h1>

          {/* Step indicator */}
          <StepIndicator activeStep={activeStep} />

          {/* Main grid */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8"
          >
            {/* Form column */}
            <motion.form
              ref={formRef}
              variants={fadeUp}
              onSubmit={handleSubmit(onSubmit)}
              className="lg:col-span-3 space-y-5 sm:space-y-6"
            >
              {/* Step 1: Address */}
              <motion.div
                variants={fadeUp}
                className={`bg-white rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-all border-2 ${
                  activeStep === 1 ? 'border-nurei-cta/20' : 'border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <div className="w-5 h-5 rounded-md bg-primary-cyan/10 flex items-center justify-center text-primary-cyan text-[10px] font-bold">
                    1
                  </div>
                  Direccion de entrega
                </div>

                {/* Address */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-primary-dark mb-2">
                    <MapPin className="w-4 h-4 text-primary-cyan" />
                    Donde te entregamos?
                  </label>
                  <motion.div whileFocus={{ scale: 1.005 }}>
                    <Input
                      {...register('delivery_address')}
                      placeholder="Ej: Michoacan 34, Condesa"
                      className="h-14 text-base text-primary-dark border-2 focus:border-primary-cyan focus:ring-2 focus:ring-primary-cyan/10 rounded-xl transition-all"
                    />
                  </motion.div>
                  <AnimatePresence>
                    {errors.delivery_address && (
                      <AnimatedErrorMessage message={errors.delivery_address.message!} />
                    )}
                  </AnimatePresence>
                </div>

                {/* Instructions */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-primary-dark mb-2">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    Instrucciones entrega (opcional)
                  </label>
                  <Textarea
                    {...register('delivery_instructions')}
                    placeholder="Ej: Tocar timbre 3, dejar con portero"
                    rows={2}
                    maxLength={200}
                    className="border-2 text-primary-dark focus:border-primary-cyan focus:ring-2 focus:ring-primary-cyan/10 rounded-xl transition-all"
                  />
                </div>
              </motion.div>

              {/* Step 2: Contact */}
              <motion.div
                variants={fadeUp}
                className={`bg-white rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-all border-2 ${
                  activeStep === 2 ? 'border-nurei-cta/20' : 'border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <div className="w-5 h-5 rounded-md bg-primary-cyan/10 flex items-center justify-center text-primary-cyan text-[10px] font-bold">
                    2
                  </div>
                  Datos de contacto
                </div>

                {/* Phone */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-primary-dark mb-2">
                    <Phone className="w-4 h-4 text-primary-cyan" />
                    Telefono WhatsApp
                  </label>
                  <Input
                    {...register('customer_phone')}
                    type="tel"
                    placeholder="55 1234 5678"
                    className="h-14 text-base text-primary-dark border-2 focus:border-primary-cyan focus:ring-2 focus:ring-primary-cyan/10 rounded-xl transition-all"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Para coordinar entrega</p>
                  <AnimatePresence>
                    {errors.customer_phone && (
                      <AnimatedErrorMessage message={errors.customer_phone.message!} />
                    )}
                  </AnimatePresence>
                </div>

                {/* Email */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-primary-dark mb-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    Email confirmacion (opcional)
                  </label>
                  <Input
                    {...register('customer_email')}
                    type="email"
                    placeholder="tu@email.com"
                    className="h-12 text-primary-dark border-2 focus:border-primary-cyan focus:ring-2 focus:ring-primary-cyan/10 rounded-xl transition-all"
                  />
                  <AnimatePresence>
                    {errors.customer_email && (
                      <AnimatedErrorMessage message={errors.customer_email.message!} />
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Desktop submit button */}
              <motion.div variants={fadeUp} className="hidden lg:block">
                <motion.div
                  whileHover={!processing && mounted && subtotal >= MIN_ORDER_AMOUNT ? { scale: 1.01 } : {}}
                  whileTap={!processing && mounted && subtotal >= MIN_ORDER_AMOUNT ? { scale: 0.98 } : {}}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Button
                    type="submit"
                    disabled={processing || (mounted && subtotal < MIN_ORDER_AMOUNT)}
                    className="w-full h-16 text-lg font-bold bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover disabled:opacity-40 rounded-xl gap-2 transition-all"
                  >
                    <AnimatePresence mode="wait">
                      {processing ? (
                        <motion.span
                          key="processing"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2"
                        >
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Procesando...
                        </motion.span>
                      ) : (
                        <motion.span
                          key="pay"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2"
                        >
                          <CreditCard className="w-5 h-5" />
                          Pagar {formatPrice(total)}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </motion.div>
              </motion.div>
            </motion.form>

            {/* Summary column */}
            <motion.div variants={fadeUp} className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm sticky top-[100px]">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-primary-cyan" />
                  <h2 className="text-lg font-bold text-primary-dark">Tu pedido</h2>
                </div>

                <div className="space-y-3">
                  {mounted &&
                    items.map((item, i) => (
                      <motion.div
                        key={item.product.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i }}
                        className="flex justify-between items-start text-sm gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                            {item.quantity}
                          </span>
                          <span className="text-gray-600 truncate">{item.product.name}</span>
                        </div>
                        <span className="font-medium flex-shrink-0">
                          {formatPrice(item.product.price * item.quantity)}
                        </span>
                      </motion.div>
                    ))}
                </div>

                <Separator className="my-4" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={subtotal}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className="font-medium"
                      >
                        {formatPrice(subtotal)}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Envío</span>
                    <span className={`font-medium ${shippingFee === 0 ? 'text-nurei-stock' : ''}`}>
                      {shippingFee === 0 ? 'Gratis' : formatPrice(shippingFee)}
                    </span>
                  </div>
                  {couponDiscount > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex justify-between text-nurei-stock"
                    >
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        Cupón {appliedCoupon}
                      </span>
                      <span className="font-medium">-{formatPrice(couponDiscount)}</span>
                    </motion.div>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Total</span>
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={total}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      className="text-lg font-bold"
                    >
                      {formatPrice(total)}
                    </motion.span>
                  </AnimatePresence>
                </div>

                {/* Free shipping progress */}
                {freeShippingRemaining > 0 && mounted && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 p-3 bg-nurei-cta/5 rounded-xl"
                  >
                    <p className="text-xs text-gray-500">
                      Agrega <span className="font-bold text-nurei-cta">{formatPrice(freeShippingRemaining)}</span> más para envío gratis
                    </p>
                    <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-nurei-cta rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Coupon input */}
                <div className="mt-4">
                  {appliedCoupon ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-between p-3 bg-nurei-stock/10 rounded-xl border border-nurei-stock/20"
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-nurei-stock" />
                        <span className="text-sm font-bold text-nurei-stock">{appliedCoupon}</span>
                      </div>
                      <button onClick={removeCoupon} className="p-1 hover:bg-white/50 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </motion.div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowCouponInput(!showCouponInput)}
                        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary-cyan transition-colors"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        Tengo un cupón
                      </button>
                      <AnimatePresence>
                        {showCouponInput && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex gap-2 mt-2 overflow-hidden"
                          >
                            <Input
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                              placeholder="CODIGO"
                              className="h-10 text-sm border-2 focus:border-primary-cyan rounded-lg uppercase font-mono"
                            />
                            <Button
                              type="button"
                              onClick={handleApplyCoupon}
                              disabled={couponLoading || !couponCode.trim()}
                              className="h-10 px-4 bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover rounded-lg text-sm font-bold shrink-0"
                            >
                              {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>

                <Link
                  href="/menu"
                  className="flex items-center justify-center gap-1 mt-4 text-sm text-gray-400 hover:text-primary-cyan transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Editar pedido
                </Link>
              </div>
            </motion.div>
          </motion.div>
        </Container>

        {/* Mobile floating pay button */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 lg:hidden z-40 bg-white/95 backdrop-blur-lg border-t border-gray-100 px-4 py-3 safe-area-pb"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total</span>
            <AnimatePresence mode="popLayout">
              <motion.span
                key={total}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="text-lg font-bold text-primary-dark"
              >
                {formatPrice(total)}
              </motion.span>
            </AnimatePresence>
          </div>

          <motion.div
            whileTap={!processing && mounted && subtotal >= MIN_ORDER_AMOUNT ? { scale: 0.98 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              disabled={processing || (mounted && subtotal < MIN_ORDER_AMOUNT)}
              className="w-full h-14 text-base font-bold bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover disabled:opacity-40 rounded-xl gap-2 transition-all"
            >
              <AnimatePresence mode="wait">
                {processing ? (
                  <motion.span
                    key="processing-mobile"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Procesando...
                  </motion.span>
                ) : (
                  <motion.span
                    key="pay-mobile"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <CreditCard className="w-5 h-5" />
                    Pagar {formatPrice(total)}
                    <Sparkles className="w-4 h-4 opacity-70" />
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </motion.div>
        </motion.div>
      </motion.section>
    </>
  )
}
