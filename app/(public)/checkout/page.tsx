'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Loader2,
  Minus,
  Package,
  Plus,
  Tag,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Container } from '@/components/layout/Container'
import { useCartStore } from '@/lib/stores/cart'
import { FREE_SHIPPING_THRESHOLD, MIN_ORDER_AMOUNT } from '@/lib/utils/constants'
import { formatPrice } from '@/lib/utils/format'

type CheckoutStep = 1 | 2 | 3 | 4
type Direction = 'forward' | 'backward'
type PaymentMethod = 'card' | 'oxxo' | 'transfer' | 'wallet'

type ShippingForm = {
  fullName: string
  email: string
  phone: string
  address: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
  country: string
}

type CardForm = {
  number: string
  name: string
  expiry: string
  cvv: string
}

type ShippingMethod = {
  id: 'standard' | 'express' | 'same_day'
  label: string
  description: string
  price: number
  etaLabel: string
  estimatedDate: string
}

type LocationOption = {
  value: string
  code?: string
}

type CouponState = {
  appliedCode: string | null
  discountAmount: number
  loading: boolean
  error: string | null
}

type OrderConfirmation = {
  id: string
  order_number: string
  created_at: string
  estimated_delivery: string | null
  shipping_fee: number
  subtotal: number
  coupon_discount: number
  total: number
  customer: {
    full_name: string
    email: string | null
    phone: string
    delivery_address: string
  }
}

const STEP_META: Array<{ id: CheckoutStep; title: string; short: string }> = [
  { id: 1, title: 'Productos', short: 'Carrito' },
  { id: 2, title: 'Envío', short: 'Datos de envío' },
  { id: 3, title: 'Pago', short: 'Método de pago' },
  { id: 4, title: 'Confirmación', short: 'Confirmado' },
]

const PROGRESS_BY_STEP: Record<CheckoutStep, number> = {
  1: 24,
  2: 52,
  3: 78,
  4: 100,
}

function getFieldError(field: keyof ShippingForm, value: string) {
  const cleaned = value.trim()

  if (
    ['fullName', 'address', 'neighborhood', 'city', 'state', 'zipCode', 'country', 'phone', 'email'].includes(
      field
    ) &&
    !cleaned
  ) {
    return 'Este campo es obligatorio.'
  }

  if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return 'Ingresa un email válido.'
  }
  if (field === 'phone' && !/^(?=.*\d)[0-9\s+()-]{8,}$/.test(cleaned)) {
    return 'Teléfono inválido.'
  }
  if (field === 'zipCode' && cleaned.length < 4) {
    return 'Código postal inválido.'
  }

  return ''
}

function cardTypeLabel(number: string) {
  const digits = number.replace(/\D/g, '')
  if (/^4/.test(digits)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'
  return 'Tarjeta'
}

function luhnCheck(number: string) {
  const digits = number.replace(/\D/g, '')
  if (digits.length < 13 || digits.length > 19) return false

  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = Number(digits[i])
    if (double) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
    double = !double
  }

  return sum % 10 === 0
}

function isExpired(expiry: string) {
  const parts = expiry.split('/')
  if (parts.length !== 2) return true
  const month = Number(parts[0])
  const year = Number(parts[1]) + 2000
  if (!month || month < 1 || month > 12 || Number.isNaN(year)) return true

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  if (year < currentYear) return true
  if (year === currentYear && month < currentMonth) return true
  return false
}

function simulatedViewers(productId: string, viewsCount: number) {
  const seed = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const chars = `${productId}${seed}`
  let hash = 0
  for (let i = 0; i < chars.length; i += 1) {
    hash = (hash * 31 + chars.charCodeAt(i)) % 1000
  }

  const base = viewsCount > 0 ? Math.min(32, Math.max(3, Math.round(viewsCount / 9))) : 5
  return base + (hash % 9)
}

export default function CheckoutPage() {
  const items = useCartStore((state) => state.items)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const getSubtotal = useCartStore((state) => state.getSubtotal)
  const clearCart = useCartStore((state) => state.clearCart)

  const [mounted, setMounted] = useState(false)
  const [activeStep, setActiveStep] = useState<CheckoutStep>(1)
  const [direction, setDirection] = useState<Direction>('forward')
  const [panelKey, setPanelKey] = useState(0)
  const [shakePanel, setShakePanel] = useState(false)

  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null)
  const [couponInput, setCouponInput] = useState('')
  const [couponState, setCouponState] = useState<CouponState>({
    appliedCode: null,
    discountAmount: 0,
    loading: false,
    error: null,
  })

  const [shippingForm, setShippingForm] = useState<ShippingForm>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'México',
  })
  const [shippingErrors, setShippingErrors] = useState<Partial<Record<keyof ShippingForm, string>>>({})
  const [addressValidating, setAddressValidating] = useState(false)
  const [locationLoading, setLocationLoading] = useState<'state' | 'city' | null>(null)
  const [stateSearch, setStateSearch] = useState('')
  const [citySearch, setCitySearch] = useState('')
  const [stateOptions, setStateOptions] = useState<LocationOption[]>([])
  const [cityOptions, setCityOptions] = useState<LocationOption[]>([])
  const [isStateSelected, setIsStateSelected] = useState(false)
  const [isCitySelected, setIsCitySelected] = useState(false)
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false)
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([])
  const [shippingLoading, setShippingLoading] = useState(false)
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<string>('standard')

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [cardForm, setCardForm] = useState<CardForm>({
    number: '',
    name: '',
    expiry: '',
    cvv: '',
  })
  const [cardErrors, setCardErrors] = useState<Partial<Record<keyof CardForm, string>>>({})
  const [savePaymentMethod, setSavePaymentMethod] = useState(false)

  const [createAccount, setCreateAccount] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [accountCreated, setAccountCreated] = useState(false)

  const [processingStage, setProcessingStage] = useState<'creating' | 'paying' | 'confirming' | null>(null)
  const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmation | null>(null)
  const [orderId, setOrderId] = useState('')
  const [cartLastUpdatedAt, setCartLastUpdatedAt] = useState(new Date().toISOString())
  const [stockConflict, setStockConflict] = useState<Array<{ product_id: string; product_name: string }>>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    setCartLastUpdatedAt(new Date().toISOString())
  }, [items, mounted])

  const subtotal = mounted ? getSubtotal() : 0
  const totalWeight = useMemo(
    () => items.reduce((sum, item) => sum + item.product.weight_g * item.quantity, 0),
    [items]
  )

  const selectedMethod = shippingMethods.find((method) => method.id === selectedShippingMethod)
  const shippingFee = selectedMethod?.price ?? 0
  const effectiveCouponDiscount = couponState.discountAmount
  const total = Math.max(0, subtotal + shippingFee - effectiveCouponDiscount)

  const processingCopy =
    processingStage === 'creating'
      ? 'Preparando tu pedido…'
      : processingStage === 'paying'
        ? 'Casi listo…'
        : '¡Confirmando!'

  const goToStep = useCallback((nextStep: CheckoutStep) => {
    setDirection(nextStep > activeStep ? 'forward' : 'backward')
    setActiveStep(nextStep)
    setPanelKey((key) => key + 1)
  }, [activeStep])

  const triggerPanelShake = useCallback(() => {
    setShakePanel(true)
    window.setTimeout(() => setShakePanel(false), 450)
  }, [])

  useEffect(() => {
    if (!mounted || items.length === 0) return

    const timeout = window.setTimeout(async () => {
      setShippingLoading(true)
      try {
        const query = new URLSearchParams({
          country: shippingForm.country || 'MX',
          state: shippingForm.state || 'CDMX',
          postalCode: shippingForm.zipCode || '01000',
          totalWeight: `${totalWeight}`,
          subtotal: `${subtotal}`,
        })

        const response = await fetch(`/api/shipping/methods?${query.toString()}`)
        const payload = await response.json()
        const methods = (payload?.data ?? []) as ShippingMethod[]
        setShippingMethods(methods)

        if (methods.length > 0) {
          setSelectedShippingMethod((current) =>
            methods.some((entry) => entry.id === current) ? current : methods[0].id
          )
        }
      } catch {
        setShippingMethods([])
      } finally {
        setShippingLoading(false)
      }
    }, 280)

    return () => window.clearTimeout(timeout)
  }, [
    mounted,
    shippingForm.country,
    shippingForm.state,
    shippingForm.zipCode,
    totalWeight,
    subtotal,
    items.length,
  ])

  const fetchLocationOptions = useCallback(
    async (type: 'states' | 'cities', query: string) => {
      setLocationLoading(type === 'states' ? 'state' : 'city')
      try {
        const params = new URLSearchParams({
          type,
          country: shippingForm.country,
          query,
        })
        if (type === 'cities') {
          params.set('state', shippingForm.state)
        }
        const response = await fetch(`/api/location/options?${params.toString()}`)
        const payload = await response.json()
        const options = (payload?.data ?? []) as LocationOption[]
        if (type === 'states') {
          setStateOptions(options)
        } else {
          setCityOptions(options)
        }
      } catch {
        if (type === 'states') {
          setStateOptions([])
        } else {
          setCityOptions([])
        }
      } finally {
        setLocationLoading(null)
      }
    },
    [shippingForm.country, shippingForm.state]
  )

  useEffect(() => {
    if (!mounted) return
    const timeout = window.setTimeout(() => {
      fetchLocationOptions('states', stateSearch)
    }, 180)
    return () => window.clearTimeout(timeout)
  }, [mounted, fetchLocationOptions, stateSearch, shippingForm.country])

  useEffect(() => {
    if (!mounted || !shippingForm.state) {
      setCityOptions([])
      return
    }
    const timeout = window.setTimeout(() => {
      fetchLocationOptions('cities', citySearch)
    }, 180)
    return () => window.clearTimeout(timeout)
  }, [mounted, fetchLocationOptions, citySearch, shippingForm.state])

  const updateShippingField = (field: keyof ShippingForm, value: string) => {
    setShippingForm((prev) => ({ ...prev, [field]: value }))
    setShippingErrors((prev) => ({ ...prev, [field]: getFieldError(field, value) }))
    if (['address', 'neighborhood', 'zipCode', 'city', 'state'].includes(field)) {
      setAddressValidating(true)
      window.setTimeout(() => setAddressValidating(false), 240)
    }
  }

  const applyCoupon = async () => {
    if (!couponInput.trim()) return
    setCouponState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/orders/apply-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponInput.trim().toUpperCase(),
          subtotal,
          shippingFee: selectedMethod?.price ?? shippingMethods[0]?.price ?? 0,
          customerEmail: shippingForm.email || undefined,
          customerPhone: shippingForm.phone || undefined,
          items: items.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
            subtotal: item.product.price * item.quantity,
            category: item.product.category,
          })),
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload?.valid) {
        setCouponState((prev) => ({
          ...prev,
          loading: false,
          error: payload?.error ?? 'Cupón inválido o expirado.',
        }))
        return
      }

      setCouponState({
        appliedCode: payload.code,
        discountAmount: payload.discount_amount ?? 0,
        loading: false,
        error: null,
      })
      toast.success('Cupón aplicado correctamente.')
    } catch {
      setCouponState((prev) => ({
        ...prev,
        loading: false,
        error: 'No se pudo validar el cupón.',
      }))
    }
  }

  const clearCoupon = () => {
    setCouponInput('')
    setCouponState({
      appliedCode: null,
      discountAmount: 0,
      loading: false,
      error: null,
    })
  }

  const validateShippingStep = () => {
    const nextErrors: Partial<Record<keyof ShippingForm, string>> = {}
    ;(Object.keys(shippingForm) as Array<keyof ShippingForm>).forEach((key) => {
      const error = getFieldError(key, shippingForm[key])
      if (error) nextErrors[key] = error
    })

    setShippingErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return false
    if (!isStateSelected || !isCitySelected) {
      toast.error('Selecciona estado y ciudad desde el listado sugerido.')
      return false
    }
    if (!selectedMethod) {
      toast.error('Selecciona un método de envío para continuar.')
      return false
    }
    if (createAccount && newPassword.trim().length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.')
      return false
    }
    return true
  }

  const validatePaymentStep = () => {
    if (paymentMethod !== 'card') return true

    const nextErrors: Partial<Record<keyof CardForm, string>> = {}
    if (!luhnCheck(cardForm.number)) nextErrors.number = 'Número de tarjeta inválido.'
    if (!cardForm.name.trim()) nextErrors.name = 'Nombre del titular requerido.'
    if (!/^\d{2}\/\d{2}$/.test(cardForm.expiry) || isExpired(cardForm.expiry)) {
      nextErrors.expiry = 'Fecha de vencimiento inválida.'
    }
    if (!/^\d{3,4}$/.test(cardForm.cvv)) nextErrors.cvv = 'CVV inválido.'
    setCardErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleContinue = async () => {
    if (activeStep === 1) {
      if (items.length === 0) {
        toast.error('Tu carrito está vacío.')
        triggerPanelShake()
        return
      }
      if (subtotal < MIN_ORDER_AMOUNT) {
        toast.error(`El pedido mínimo es ${formatPrice(MIN_ORDER_AMOUNT)}.`)
        triggerPanelShake()
        return
      }
      goToStep(2)
      return
    }

    if (activeStep === 2) {
      if (!validateShippingStep()) {
        triggerPanelShake()
        return
      }
      goToStep(3)
      return
    }

    if (activeStep !== 3) return

    if (!validatePaymentStep()) {
      triggerPanelShake()
      return
    }

    try {
      if (!selectedMethod) {
        toast.error('Selecciona un método de envío.')
        return
      }

      setProcessingStage('creating')
      const createOrderResponse = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
          coupon_code: couponState.appliedCode ?? undefined,
          customer: {
            full_name: shippingForm.fullName,
            email: shippingForm.email,
            phone: shippingForm.phone,
          },
          shipping: {
            address: `${shippingForm.address}, Col. ${shippingForm.neighborhood}`,
            city: shippingForm.city,
            state: shippingForm.state,
            zip_code: shippingForm.zipCode,
            country: shippingForm.country,
            method_id: selectedMethod.id,
            method_label: selectedMethod.label,
            fee: shippingFee,
            eta_label: selectedMethod.etaLabel,
            estimated_date: selectedMethod.estimatedDate,
          },
          payment_method: paymentMethod,
        }),
      })

      const createPayload = await createOrderResponse.json()
      if (!createOrderResponse.ok) {
        if (createPayload?.error === 'stock_unavailable') {
          setStockConflict(createPayload?.products ?? [])
          goToStep(1)
          toast.error('Algunos productos se agotaron. Puedes removerlos y continuar.')
        } else {
          toast.error(createPayload?.error ?? 'No se pudo crear la orden.')
        }
        setProcessingStage(null)
        return
      }

      const nextOrderId = createPayload.data.order_id as string
      setOrderId(nextOrderId)

      setProcessingStage('paying')
      const normalizedCardNumber = cardForm.number.replace(/\D/g, '')
      const paymentResponse = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: nextOrderId,
          amount: total,
          method: paymentMethod,
          saveMethod: savePaymentMethod,
          cartLastUpdatedAt,
          card:
            paymentMethod === 'card'
              ? {
                  token: `tok_${Date.now()}_${normalizedCardNumber.slice(-4)}`,
                  holderName: cardForm.name,
                  expiry: cardForm.expiry,
                  last4: normalizedCardNumber.slice(-4),
                  brand: cardTypeLabel(cardForm.number).toLowerCase(),
                }
              : undefined,
        }),
      })
      const paymentPayload = await paymentResponse.json()

      if (!paymentResponse.ok) {
        toast.error(paymentPayload?.error ?? 'Error en la pasarela de pago.')
        setProcessingStage(null)
        return
      }

      setProcessingStage('confirming')
      const confirmationResponse = await fetch(`/api/orders/${nextOrderId}/confirm`)
      const confirmationPayload = await confirmationResponse.json()

      if (!confirmationResponse.ok) {
        toast.error(confirmationPayload?.error ?? 'No se pudo cargar la confirmación.')
        setProcessingStage(null)
        return
      }

      setOrderConfirmation(confirmationPayload.data as OrderConfirmation)
      clearCart()
      setProcessingStage(null)

      if (createAccount && newPassword.trim().length >= 6) {
        try {
          const accountResponse = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: shippingForm.email,
              password: newPassword,
              name: shippingForm.fullName,
            }),
          })
          if (accountResponse.ok) {
            setAccountCreated(true)
          }
        } catch {
          // account creation failure is non-blocking
        }
      }

      goToStep(4)
      toast.success('¡Pedido confirmado!')
    } catch {
      toast.error('No pudimos completar el checkout. Intenta nuevamente.')
      setProcessingStage(null)
    }
  }

  const updateCardField = (field: keyof CardForm, value: string) => {
    if (field === 'number') {
      const digits = value.replace(/\D/g, '').slice(0, 19)
      const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
      setCardForm((prev) => ({ ...prev, number: formatted }))
      setCardErrors((prev) => ({ ...prev, number: '' }))
      return
    }

    if (field === 'expiry') {
      const digits = value.replace(/\D/g, '').slice(0, 4)
      const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
      setCardForm((prev) => ({ ...prev, expiry: formatted }))
      setCardErrors((prev) => ({ ...prev, expiry: '' }))
      return
    }

    if (field === 'cvv') {
      setCardForm((prev) => ({ ...prev, cvv: value.replace(/\D/g, '').slice(0, 4) }))
      setCardErrors((prev) => ({ ...prev, cvv: '' }))
      return
    }

    setCardForm((prev) => ({ ...prev, [field]: value }))
    setCardErrors((prev) => ({ ...prev, [field]: '' }))
  }

  if (!mounted) {
    return (
      <section className="py-8 bg-gray-50 min-h-screen">
        <Container className="max-w-6xl">
          <div className="h-6 w-40 rounded bg-gray-200 animate-pulse mb-4" />
          <div className="h-3 w-full rounded bg-gray-200 animate-pulse mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 bg-white rounded-2xl p-6 space-y-4">
              <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
            </div>
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 space-y-3">
              <div className="h-5 w-32 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-full rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-gray-100 animate-pulse" />
              <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          </div>
        </Container>
      </section>
    )
  }

  if (items.length === 0 && activeStep !== 4) {
    return (
      <section className="py-20 bg-gray-50 min-h-screen">
        <Container className="max-w-4xl text-center">
          <p className="text-6xl mb-4">🛒</p>
          <h1 className="text-3xl font-bold text-primary-dark">Tu carrito está vacío</h1>
          <p className="text-gray-500 mt-2">Agrega productos para iniciar el checkout.</p>
          <Link href="/menu" className="inline-flex mt-6">
            <Button className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover">
              Ir al menú
            </Button>
          </Link>
        </Container>
      </section>
    )
  }

  return (
    <section className="py-8 pb-28 lg:pb-10 bg-gray-50 min-h-screen">
      {processingStage && (
        <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-xl text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full border-2 border-primary-cyan/30 border-t-primary-cyan animate-spin" />
            <p className="text-lg font-semibold text-primary-dark">{processingCopy}</p>
            <p className="text-sm text-gray-500 mt-2">Estamos asegurando que todo quede perfecto.</p>
            <div className="mt-5 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full checkout-loading-bar" />
            </div>
          </div>
        </div>
      )}

      <Container className="max-w-6xl">
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-dark transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Seguir comprando
        </Link>

        <h1 className="text-3xl font-bold text-primary-dark mb-2">Crear pedido</h1>
        <p className="text-gray-500 mb-5">Completa estos pasos y tu snack estará en camino.</p>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {STEP_META.map((step) => {
              const isActive = step.id === activeStep
              const isDone = step.id < activeStep
              return (
                <div
                  key={step.id}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    isActive
                      ? 'border-primary-cyan bg-primary-cyan/20 text-primary-dark'
                      : isDone
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500'
                  }`}
                >
                  <span
                    className={`inline-flex w-4 h-4 items-center justify-center rounded-full ${
                      isDone ? 'bg-emerald-500 text-white checkout-check-pop' : 'bg-white text-gray-600'
                    }`}
                  >
                    {isDone ? <Check className="w-3 h-3" /> : step.id}
                  </span>
                  {step.title}
                </div>
              )
            })}
          </div>

          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-primary-cyan transition-all duration-500 ease-out checkout-progress-fill"
              style={{ width: `${PROGRESS_BY_STEP[activeStep]}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {PROGRESS_BY_STEP[activeStep]}% completado · Ya casi terminas ✨
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className={activeStep === 4 ? 'lg:col-span-5' : 'lg:col-span-3'}>
            <div
              key={`${activeStep}-${panelKey}`}
              className={`rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 ${
                direction === 'forward' ? 'checkout-slide-in-right' : 'checkout-slide-in-left'
              } ${shakePanel ? 'checkout-shake' : ''}`}
            >
              {activeStep === 1 && (
                <div>
                  <h2 className="text-xl font-semibold text-primary-dark mb-1">Paso 1 · Productos</h2>
                  <p className="text-sm text-gray-500 mb-5">
                    Revisa cantidades, disponibilidad y aplica tu cupón.
                  </p>

                  {stockConflict.length > 0 && (
                    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-900">
                        Lo sentimos, algunos productos se agotaron justo antes de confirmar.
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-amber-800">
                        {stockConflict.map((entry) => (
                          <p key={entry.product_id}>• {entry.product_name}</p>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          className="bg-amber-500 text-white hover:bg-amber-600"
                          onClick={() => {
                            stockConflict.forEach((entry) => removeItem(entry.product_id))
                            setStockConflict([])
                            const remainingSubtotal = items
                              .filter((item) => !stockConflict.some((conflict) => conflict.product_id === item.product.id))
                              .reduce((sum, item) => sum + item.product.price * item.quantity, 0)
                            if (remainingSubtotal >= MIN_ORDER_AMOUNT) {
                              goToStep(2)
                            } else {
                              toast.error(`El pedido mínimo es ${formatPrice(MIN_ORDER_AMOUNT)}.`)
                            }
                          }}
                        >
                          Eliminar agotados y continuar
                        </Button>
                        <Link href="/menu">
                          <Button type="button" variant="outline">
                            Volver al catálogo
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 lg:space-y-2">
                    {items.map((item, idx) => {
                      const lowStock = item.product.stock_quantity <= item.product.low_stock_threshold + 2
                      const productSubtotal = item.product.price * item.quantity
                      const viewers = simulatedViewers(item.product.id, item.product.views_count)

                      return (
                        <div
                          key={item.product.id}
                          className="rounded-2xl border border-gray-200 p-4 lg:p-3 checkout-stagger-in"
                          style={{ animationDelay: `${idx * 80}ms` }}
                        >
                          <div className="flex gap-3 lg:gap-2.5">
                            <div className="w-16 h-16 lg:w-[52px] lg:h-[52px] shrink-0 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center text-2xl lg:text-xl">
                              {(item.product.images?.[item.product.primary_image_index] ?? item.product.image_thumbnail_url) ? (
                                <Image
                                  src={item.product.images?.[item.product.primary_image_index] ?? item.product.image_thumbnail_url!}
                                  alt={item.product.name}
                                  width={64}
                                  height={64}
                                  unoptimized
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>🍘</span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 lg:gap-1.5">
                                <p className="font-semibold text-primary-dark truncate text-[15px] lg:text-sm leading-tight">{item.product.name}</p>
                                {lowStock && (
                                  <span className="text-[10px] uppercase tracking-wide font-bold rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-red-600">
                                    Últimas unidades
                                  </span>
                                )}
                                <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-700">
                                  {viewers} viendo ahora
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1 lg:mt-0.5 leading-snug">
                                {formatPrice(item.product.price)} c/u · Subtotal {formatPrice(productSubtotal)}
                              </p>

                              <div className="flex items-center justify-between mt-3 lg:mt-2">
                                <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 p-0.5 lg:p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                    className="w-8 h-8 lg:w-7 lg:h-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                                    aria-label="Restar"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="w-8 lg:w-7 text-center font-semibold text-sm lg:text-xs">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                    className="w-8 h-8 lg:w-7 lg:h-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                                    aria-label="Sumar"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>

                                {deleteCandidate === item.product.id ? (
                                  <div className="inline-flex items-center gap-2 text-xs">
                                    <span className="text-gray-500">¿Eliminar?</span>
                                    <button
                                      type="button"
                                      className="text-red-600 font-semibold"
                                      onClick={() => {
                                        removeItem(item.product.id)
                                        setDeleteCandidate(null)
                                      }}
                                    >
                                      Sí
                                    </button>
                                    <button
                                      type="button"
                                      className="text-gray-500"
                                      onClick={() => setDeleteCandidate(null)}
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors"
                                    onClick={() => setDeleteCandidate(item.product.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Eliminar
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-5 rounded-2xl border border-gray-200 p-4 bg-gray-50/70">
                    <p className="text-sm font-semibold text-primary-dark mb-3">Cupón de descuento</p>
                    <div className="flex items-center gap-2">
                      <Input
                        value={couponInput}
                        onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                        placeholder="Ej: BIENVENIDO10"
                        className="uppercase"
                      />
                      <Button
                        type="button"
                        onClick={applyCoupon}
                        disabled={couponState.loading || !couponInput.trim()}
                        className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover"
                      >
                        {couponState.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                      </Button>
                    </div>

                    {couponState.error && <p className="text-xs text-red-600 mt-2">{couponState.error}</p>}
                    {couponState.appliedCode && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                        <Tag className="w-3 h-3" />
                        {couponState.appliedCode} aplicado
                        <button type="button" onClick={clearCoupon} className="underline">
                          Quitar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div>
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-primary-dark">Paso 2 · Datos de envío</h2>
                      <p className="text-sm text-gray-500">Validamos cada campo en tiempo real.</p>
                    </div>
                    {addressValidating && (
                      <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Validando dirección…
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre completo</label>
                      <Input
                        value={shippingForm.fullName}
                        onChange={(event) => updateShippingField('fullName', event.target.value)}
                        className="mt-1"
                      />
                      {shippingErrors.fullName && <p className="text-xs text-red-600 mt-1">{shippingErrors.fullName}</p>}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</label>
                      <Input
                        value={shippingForm.email}
                        onChange={(event) => updateShippingField('email', event.target.value)}
                        className="mt-1"
                      />
                      {shippingErrors.email && <p className="text-xs text-red-600 mt-1">{shippingErrors.email}</p>}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Teléfono</label>
                      <Input
                        value={shippingForm.phone}
                        onChange={(event) => updateShippingField('phone', event.target.value)}
                        className="mt-1"
                      />
                      {shippingErrors.phone && <p className="text-xs text-red-600 mt-1">{shippingErrors.phone}</p>}
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => { setCreateAccount((v) => !v); setPasswordError(''); setNewPassword('') }}
                        className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-all ${
                          createAccount
                            ? 'border-primary-cyan bg-primary-cyan/8'
                            : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="text-left">
                          <p className="text-sm font-semibold text-primary-dark">¿Quieres guardar tu pedido en tu cuenta?</p>
                          <p className="text-xs text-gray-500 mt-0.5">Crea una cuenta para rastrear tus pedidos fácilmente.</p>
                        </div>
                        <div className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors relative ${
                          createAccount ? 'bg-primary-cyan' : 'bg-gray-300'
                        }`}>
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                            createAccount ? 'left-5' : 'left-0.5'
                          }`} />
                        </div>
                      </button>

                      {createAccount && (
                        <div className="mt-3">
                          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contraseña para tu cuenta nueva</label>
                          <Input
                            type="password"
                            value={newPassword}
                            onChange={(event) => { setNewPassword(event.target.value); setPasswordError('') }}
                            placeholder="Mínimo 6 caracteres"
                            className="mt-1"
                          />
                          {passwordError && <p className="text-xs text-red-600 mt-1">{passwordError}</p>}
                        </div>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dirección</label>
                      <Input
                        value={shippingForm.address}
                        onChange={(event) => updateShippingField('address', event.target.value)}
                        className="mt-1"
                      />
                      {shippingErrors.address && <p className="text-xs text-red-600 mt-1">{shippingErrors.address}</p>}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Colonia</label>
                      <Input
                        value={shippingForm.neighborhood}
                        onChange={(event) => updateShippingField('neighborhood', event.target.value)}
                        className="mt-1"
                      />
                      {shippingErrors.neighborhood && <p className="text-xs text-red-600 mt-1">{shippingErrors.neighborhood}</p>}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">País</label>
                      <Input
                        value={shippingForm.country}
                        onChange={(event) => {
                          updateShippingField('country', event.target.value)
                          setStateSearch('')
                          setCitySearch('')
                          setIsStateSelected(false)
                          setIsCitySelected(false)
                          setShippingForm((prev) => ({ ...prev, state: '', city: '' }))
                        }}
                        className="mt-1"
                      />
                      {shippingErrors.country && <p className="text-xs text-red-600 mt-1">{shippingErrors.country}</p>}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estado (buscar y seleccionar)</label>
                      <Input
                        value={stateSearch}
                        onChange={(event) => {
                          setStateSearch(event.target.value)
                          setIsStateSelected(false)
                          setIsCitySelected(false)
                          setShippingForm((prev) => ({ ...prev, state: '', city: '' }))
                        }}
                        placeholder="Escribe para buscar estado"
                        className="mt-1"
                      />
                      {locationLoading === 'state' && <p className="text-xs text-gray-500 mt-1">Buscando estados…</p>}
                      {!isStateSelected && stateSearch && stateOptions.length > 0 && (
                        <div className="mt-1 rounded-xl border border-gray-200 bg-white max-h-40 overflow-auto">
                          {stateOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={() => {
                                updateShippingField('state', option.value)
                                setStateSearch(option.value)
                                setIsStateSelected(true)
                                setCitySearch('')
                                setCityOptions([])
                                setIsCitySelected(false)
                                setShippingForm((prev) => ({ ...prev, city: '' }))
                              }}
                            >
                              {option.value}
                            </button>
                          ))}
                        </div>
                      )}
                      {shippingErrors.state && <p className="text-xs text-red-600 mt-1">{shippingErrors.state}</p>}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ciudad (buscar y seleccionar)</label>
                      <Input
                        value={citySearch}
                        onChange={(event) => {
                          setCitySearch(event.target.value)
                          setIsCitySelected(false)
                          setShippingForm((prev) => ({ ...prev, city: '' }))
                        }}
                        placeholder={shippingForm.state ? 'Escribe para buscar ciudad' : 'Selecciona estado primero'}
                        className="mt-1"
                        disabled={!shippingForm.state}
                      />
                      {locationLoading === 'city' && <p className="text-xs text-gray-500 mt-1">Buscando ciudades…</p>}
                      {!isCitySelected && citySearch && cityOptions.length > 0 && (
                        <div className="mt-1 rounded-xl border border-gray-200 bg-white max-h-40 overflow-auto">
                          {cityOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={() => {
                                updateShippingField('city', option.value)
                                setCitySearch(option.value)
                                setIsCitySelected(true)
                              }}
                            >
                              {option.value}
                            </button>
                          ))}
                        </div>
                      )}
                      {shippingErrors.city && <p className="text-xs text-red-600 mt-1">{shippingErrors.city}</p>}
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Código postal</label>
                      <Input
                        value={shippingForm.zipCode}
                        onChange={(event) => updateShippingField('zipCode', event.target.value)}
                        className="mt-1"
                      />
                      {shippingErrors.zipCode && <p className="text-xs text-red-600 mt-1">{shippingErrors.zipCode}</p>}
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-sm font-semibold text-primary-dark mb-2">Método de envío</p>
                    {shippingLoading ? (
                      <div className="space-y-2">
                        <div className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                        <div className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {shippingMethods.map((method) => (
                          <label
                            key={method.id}
                            className={`block cursor-pointer rounded-xl border p-3 transition-all ${
                              selectedShippingMethod === method.id
                                ? 'border-primary-cyan bg-primary-cyan/10'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                name="shipping-method"
                                checked={selectedShippingMethod === method.id}
                                onChange={() => setSelectedShippingMethod(method.id)}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-primary-dark">{method.label}</p>
                                  <p className="text-sm font-bold text-primary-dark">
                                    {method.price === 0 ? 'Gratis' : formatPrice(method.price)}
                                  </p>
                                </div>
                                <p className="text-xs text-gray-500">{method.description}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {method.etaLabel} · Entrega estimada {new Date(method.estimatedDate).toLocaleDateString('es-MX')}
                                </p>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeStep === 3 && (
                <div>
                  <h2 className="text-xl font-semibold text-primary-dark mb-1">Paso 3 · Pago</h2>
                  <p className="text-sm text-gray-500 mb-5">
                    Selecciona método y confirma tus datos de cobro.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                    {[
                      { id: 'card', label: 'Tarjeta crédito/débito' },
                      { id: 'oxxo', label: 'OXXO' },
                      { id: 'transfer', label: 'Transferencia' },
                      { id: 'wallet', label: 'Wallet' },
                    ].map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                        className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all ${
                          paymentMethod === method.id
                            ? 'border-primary-cyan bg-primary-cyan/10 text-primary-dark'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>

                  {paymentMethod === 'card' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Número de tarjeta · {cardTypeLabel(cardForm.number)}
                        </label>
                        <Input
                          value={cardForm.number}
                          onChange={(event) => updateCardField('number', event.target.value)}
                          placeholder="4242 4242 4242 4242"
                          className="mt-1"
                        />
                        {cardErrors.number && <p className="text-xs text-red-600 mt-1">{cardErrors.number}</p>}
                      </div>

                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre del titular</label>
                        <Input
                          value={cardForm.name}
                          onChange={(event) => updateCardField('name', event.target.value)}
                          placeholder="Como aparece en la tarjeta"
                          className="mt-1"
                        />
                        {cardErrors.name && <p className="text-xs text-red-600 mt-1">{cardErrors.name}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vencimiento</label>
                          <Input
                            value={cardForm.expiry}
                            onChange={(event) => updateCardField('expiry', event.target.value)}
                            placeholder="MM/AA"
                            className="mt-1"
                          />
                          {cardErrors.expiry && <p className="text-xs text-red-600 mt-1">{cardErrors.expiry}</p>}
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">CVV</label>
                          <Input
                            value={cardForm.cvv}
                            onChange={(event) => updateCardField('cvv', event.target.value)}
                            placeholder="123"
                            className="mt-1"
                          />
                          {cardErrors.cvv && <p className="text-xs text-red-600 mt-1">{cardErrors.cvv}</p>}
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={savePaymentMethod}
                          onChange={(event) => setSavePaymentMethod(event.target.checked)}
                        />
                        Guardar método para próximas compras
                      </label>
                    </div>
                  )}
                </div>
              )}

              {activeStep === 4 && orderConfirmation && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                  <div className="rounded-2xl border border-gray-200 p-5 text-left">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 inline-flex items-center justify-center checkout-confirm-check mb-4">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-primary-dark">¡Pedido confirmado!</h2>
                    <p className="text-gray-500 mt-2">
                      Número de orden <span className="font-semibold">{orderConfirmation.order_number}</span>
                    </p>
                    <div className="mt-5 text-sm text-gray-600 space-y-1">
                      <p>Cliente: {orderConfirmation.customer.full_name}</p>
                      <p>Email: {orderConfirmation.customer.email ?? 'No especificado'}</p>
                      <p>Dirección: {orderConfirmation.customer.delivery_address}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-5 text-left flex flex-col justify-between">
                    <div>
                      <p className="text-sm font-semibold text-primary-dark mb-2">Resumen del pedido</p>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Subtotal: {formatPrice(orderConfirmation.subtotal)}</p>
                        <p>Envío: {orderConfirmation.shipping_fee === 0 ? 'Gratis' : formatPrice(orderConfirmation.shipping_fee)}</p>
                        <p>Descuento: -{formatPrice(orderConfirmation.coupon_discount)}</p>
                        <p className="text-base font-bold text-primary-dark">Total: {formatPrice(orderConfirmation.total)}</p>
                        <p>
                          Entrega estimada:{' '}
                          {orderConfirmation.estimated_delivery
                            ? new Date(orderConfirmation.estimated_delivery).toLocaleDateString('es-MX')
                            : 'Pendiente de confirmación'}
                        </p>
                      </div>
                    </div>
                    {accountCreated && (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-800">¡Cuenta creada!</p>
                          <p className="text-xs text-emerald-700 mt-0.5">
                            Inicia sesión con <span className="font-semibold">{shippingForm.email}</span> para ver tus pedidos.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 space-y-2">
                      <Link href={`/pedido/${orderConfirmation.id}`} className="block">
                        <Button type="button" className="w-full bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover">
                          Ver mi pedido
                        </Button>
                      </Link>
                      <Link href="/menu" className="block">
                        <Button type="button" variant="outline" className="w-full">
                          Seguir comprando
                        </Button>
                      </Link>
                      <Link href="/perfil" className="text-xs text-gray-500 underline">
                        Mis pedidos
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {activeStep < 4 && (
                <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => goToStep(Math.max(1, activeStep - 1) as CheckoutStep)}
                    disabled={activeStep === 1}
                    className="w-full sm:w-auto"
                  >
                    Volver
                  </Button>
                  <Button
                    type="button"
                    onClick={handleContinue}
                    className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover w-full sm:w-auto"
                  >
                    {activeStep === 3 ? (
                      <>
                        Confirmar y pagar
                        <CreditCard className="w-4 h-4 ml-2" />
                      </>
                    ) : (
                      <>
                        Continuar
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {activeStep < 4 && (
            <aside className="lg:col-span-2 hidden lg:block">
              <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-5 lg:p-4">
                <p className="text-sm font-semibold text-primary-dark mb-2 lg:mb-2 inline-flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary-cyan" />
                  Resumen del pedido
                </p>

                <div className="space-y-1.5 max-h-52 lg:max-h-64 overflow-auto pr-1">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex items-start justify-between gap-2 text-xs lg:text-[13px] leading-snug">
                      <p className="text-gray-600">
                        {item.quantity} × {item.product.name}
                      </p>
                      <p className="font-medium text-primary-dark">{formatPrice(item.product.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 lg:mt-3 border-t border-gray-200 pt-3 text-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Envío</span>
                    <span className="font-medium">{shippingFee === 0 ? 'Gratis' : formatPrice(shippingFee)}</span>
                  </div>
                  {effectiveCouponDiscount > 0 && (
                    <div className="flex items-center justify-between text-emerald-700">
                      <span>Descuento</span>
                      <span className="font-medium">-{formatPrice(effectiveCouponDiscount)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                    <span className="font-semibold text-primary-dark">Total</span>
                    <span className="text-lg font-bold text-primary-dark">{formatPrice(total)}</span>
                  </div>
                </div>

                {subtotal < FREE_SHIPPING_THRESHOLD && (
                  <p className="text-[11px] lg:text-xs text-gray-500 mt-2 leading-tight">
                    Faltan{' '}
                    <span className="font-semibold text-primary-dark">
                      {formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)}
                    </span>{' '}
                    para envío gratis.
                  </p>
                )}

                {orderId && (
                  <p className="mt-3 text-[11px] text-gray-400">
                    Orden en proceso: <span className="font-mono">{orderId}</span>
                  </p>
                )}
              </div>
            </aside>
          )}
        </div>
        {activeStep < 4 && (
          <div className="lg:hidden mt-4">
            <button
              type="button"
              onClick={() => setMobileSummaryOpen((prev) => !prev)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-primary-dark"
            >
              {mobileSummaryOpen ? 'Ocultar resumen del pedido' : 'Ver resumen del pedido'}
            </button>
            {mobileSummaryOpen && (
              <div className="mt-2 rounded-xl border border-gray-200 bg-white p-4">
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">Subtotal: {formatPrice(subtotal)}</p>
                  <p className="text-gray-600">Envío: {shippingFee === 0 ? 'Gratis' : formatPrice(shippingFee)}</p>
                  {effectiveCouponDiscount > 0 && (
                    <p className="text-emerald-700">Descuento: -{formatPrice(effectiveCouponDiscount)}</p>
                  )}
                  <p className="font-semibold text-primary-dark">Total: {formatPrice(total)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </Container>
    </section>
  )
}
