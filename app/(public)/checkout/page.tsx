'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Container } from '@/components/layout/Container'
import { useCartStore } from '@/lib/stores/cart'
import { useAuthStore } from '@/lib/stores/auth'
import { formatPrice } from '@/lib/utils/format'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { useStoreCheckout } from '@/components/providers/StoreCheckoutProvider'
import {
  loadShippingDraft,
  migrateLegacyShippingDraft,
  saveShippingDraft,
} from '@/lib/checkout-shipping-cache'
import {
  DEFAULT_SHIPPING_FORM,
  trimShippingFormFields,
  type ShippingForm,
} from '@/lib/types/checkout-shipping'
import { SearchableSelect } from '@/components/forms/SearchableSelect'
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton'
import { SnackWaitAnimation } from '@/components/checkout/SnackWaitAnimation'
import { trackBeginCheckout, buildGa4Item } from '@/lib/tracking/ga4'
import { trackInitiateCheckout } from '@/lib/tracking/meta-pixel'

type CheckoutStep = 1 | 2 | 3 | 4
type Direction = 'forward' | 'backward'

type CardForm = {
  number: string
  name: string
  expiry: string
  cvv: string
}

type ShippingMethod = {
  id: string
  label: string
  description: string
  price: number
  etaLabel: string
  estimatedDate: string
}

type CouponState = {
  appliedCode: string | null
  discountAmount: number
  loading: boolean
  error: string | null
}

type OrderConfirmation = {
  id: string
  public_access_token: string | null
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

type DuplicateOrder = {
  id: string
  shortId: string
  createdAt: string
  ageSeconds: number
  severity: 'immediate' | 'recent' | 'warning'
  can_open: boolean
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

const SHIPPING_FIELD_ORDER: (keyof ShippingForm)[] = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'country',
  'state',
  'city',
  'neighborhood',
  'zipCode',
  'address',
]

function scrollToFirstShippingError(errors: Partial<Record<keyof ShippingForm, string>>) {
  const firstKey = SHIPPING_FIELD_ORDER.find((k) => errors[k])
  if (!firstKey) return
  requestAnimationFrame(() => {
    document
      .querySelector(`[data-checkout-field="${firstKey}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

function getFieldError(field: keyof ShippingForm, value: string) {
  const cleaned = value.trim()

  if (
    [
      'firstName',
      'lastName',
      'address',
      'neighborhood',
      'city',
      'state',
      'zipCode',
      'country',
      'phone',
      'email',
    ].includes(field) &&
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

function isManualCardPayment(slug: string) {
  return slug === 'card' || (slug.endsWith('_card') && slug !== 'stripe_card')
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


export default function CheckoutPage() {
  const items = useCartStore((state) => state.items)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const getSubtotal = useCartStore((state) => state.getSubtotal)
  const clearCart = useCartStore((state) => state.clearCart)
  const getItemCount = useCartStore((state) => state.getItemCount)

  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({})
  const [hiddenViewerKeys, setHiddenViewerKeys] = useState<Set<string>>(new Set())
  const viewerInitRef = useRef(false)

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

  const [shippingForm, setShippingForm] = useState<ShippingForm>(DEFAULT_SHIPPING_FORM)
  const [locationStateOptions, setLocationStateOptions] = useState<string[]>([])
  const [locationCityOptions, setLocationCityOptions] = useState<string[]>([])
  const [shippingErrors, setShippingErrors] = useState<Partial<Record<keyof ShippingForm, string>>>({})
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false)
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([])
  const [shippingLoading, setShippingLoading] = useState(false)
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<string>('standard')

  const { bootstrap: storeBootstrap, loading: storeCheckoutLoading } = useStoreCheckout()

  const [paymentMethod, setPaymentMethod] = useState<string>('stripe_card')
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
  const [duplicateOrder, setDuplicateOrder] = useState<DuplicateOrder | null>(null)
  const [duplicateAccessToken, setDuplicateAccessToken] = useState<string | null>(null)

  const [loginOpen, setLoginOpen] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const shippingLoadedRef = useRef(false)

  const authUser = useAuthStore((s) => s.user)
  const authEmail = useAuthStore((s) => s.email)
  const authOk = useAuthStore((s) => s.isAuthenticated)
  const authLogin = useAuthStore((s) => s.login)
  const authLoginWithGoogle = useAuthStore((s) => s.loginWithGoogle)
  const refreshUser = useAuthStore((s) => s.refreshUser)
  const loadAddresses = useAuthStore((s) => s.loadAddresses)
  const savedAddresses = useAuthStore((s) => s.addresses)

  useEffect(() => {
    setMounted(true)
    return () => {
      document.body.style.overflow = ''
      document.body.style.pointerEvents = ''
    }
  }, [])

  useEffect(() => {
    if (viewerInitRef.current || items.length === 0) return
    viewerInitRef.current = true

    const initial: Record<string, number> = {}
    for (const item of items) {
      const key = `${item.product.id}:${item.variant_id ?? ''}`
      initial[key] = Math.floor(Math.random() * 12) + 2
    }
    setViewerCounts(initial)

    if (items.length > 3) {
      const skipCount = Math.random() < 0.5 ? 1 : 2
      const shuffled = [...items].sort(() => Math.random() - 0.5)
      setHiddenViewerKeys(
        new Set(shuffled.slice(0, skipCount).map((i) => `${i.product.id}:${i.variant_id ?? ''}`))
      )
    }
  }, [items])

  useEffect(() => {
    const id = setInterval(() => {
      setViewerCounts((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(next)) {
          const delta = (Math.random() < 0.5 ? 1 : 2) * (Math.random() < 0.5 ? 1 : -1)
          next[key] = Math.min(15, Math.max(1, (next[key] ?? 5) + delta))
        }
        return next
      })
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const rawStep = new URLSearchParams(window.location.search).get('step')
    if (!rawStep) return
    const parsed = Number(rawStep)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) return
    setActiveStep(parsed as CheckoutStep)
    setPanelKey((key) => key + 1)
    const nextUrl = `${window.location.pathname}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    const raw = loadShippingDraft()
    const merged = migrateLegacyShippingDraft(DEFAULT_SHIPPING_FORM, raw as Record<string, unknown> | null)
    setShippingForm((prev) => ({ ...prev, ...merged }))
    shippingLoadedRef.current = true
  }, [mounted])

  useEffect(() => {
    if (!mounted || !shippingLoadedRef.current) return
    saveShippingDraft(shippingForm)
  }, [mounted, shippingForm])

  useEffect(() => {
    void refreshUser().then(() => { void loadAddresses() })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session sync once on checkout mount
  }, [])

  useEffect(() => {
    if (!authOk || !authUser) return
    const parts = (authUser.full_name ?? '').trim().split(/\s+/)
    const fn = parts[0] ?? ''
    const ln = parts.slice(1).join(' ')
    setShippingForm((prev) => ({
      ...prev,
      firstName: prev.firstName.trim() ? prev.firstName : fn,
      lastName: prev.lastName.trim() ? prev.lastName : ln,
      email: prev.email.trim() ? prev.email : authEmail ?? '',
      phone: prev.phone.trim() ? prev.phone : authUser.phone ?? '',
    }))
  }, [authOk, authUser, authEmail])

  useEffect(() => {
    if (!authOk || savedAddresses.length === 0) return
    const def = savedAddresses.find((a) => a.is_default) ?? savedAddresses[0]
    if (!def) return
    setShippingForm((prev) => {
      if (prev.address.trim()) return prev
      const nameParts = def.recipient_name.trim().split(/\s+/)
      const addrLine = [def.street, def.exterior_number, def.interior_number ? `Int. ${def.interior_number}` : '']
        .filter(Boolean).join(' ')
      return {
        ...prev,
        firstName: prev.firstName.trim() ? prev.firstName : (nameParts[0] ?? ''),
        lastName: prev.lastName.trim() ? prev.lastName : (nameParts.slice(1).join(' ')),
        phone: prev.phone.trim() ? prev.phone : def.phone,
        address: addrLine,
        neighborhood: def.colonia,
        city: def.city,
        state: def.state,
        zipCode: def.zip_code,
      }
    })
  }, [authOk, savedAddresses])

  useEffect(() => {
    const methods = storeBootstrap?.payment_methods ?? []
    if (methods.length === 0) return
    setPaymentMethod((current) =>
      methods.some((m) => m.slug === current) ? current : methods[0].slug,
    )
  }, [storeBootstrap])

  useEffect(() => {
    if (!mounted) return
    setCartLastUpdatedAt(new Date().toISOString())
  }, [items, mounted])

  const subtotal = mounted ? getSubtotal() : 0

  const minOrderCents = storeBootstrap?.checkout.min_order_cents ?? 0
  const checkoutConfigReady = !storeCheckoutLoading && storeBootstrap !== null
  const freeShipMin = storeBootstrap?.shipping.free_shipping_min_cents

  const qualifiesFreeShipping =
    typeof freeShipMin === 'number' && freeShipMin > 0 ? subtotal >= freeShipMin : false

  const selectedMethod = shippingMethods.find((method) => method.id === selectedShippingMethod)
  const shippingFee = selectedMethod?.price ?? 0
  const effectiveCouponDiscount = couponState.discountAmount
  const total = Math.max(0, subtotal + shippingFee - effectiveCouponDiscount)

  const scrollCheckoutTop = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    const main = document.querySelector('main')
    if (main instanceof HTMLElement) main.scrollTop = 0
  }, [])

  const goToStep = useCallback(
    (nextStep: CheckoutStep) => {
      setDirection(nextStep > activeStep ? 'forward' : 'backward')
      scrollCheckoutTop()
      setActiveStep(nextStep)
      setPanelKey((key) => key + 1)
    },
    [activeStep, scrollCheckoutTop],
  )

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
          country: shippingForm.country || 'México',
          state: shippingForm.state || 'ciudad de méxico',
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
    subtotal,
    items.length,
  ])

  useEffect(() => {
    let cancelled = false
    const country = shippingForm.country.trim()
    ;(async () => {
      try {
        const res = await fetch(`/api/location/options?type=states&country=${encodeURIComponent(country)}`)
        const json = await res.json()
        const names = ((json.data ?? []) as Array<{ value: string }>).map((x) => x.value)
        if (!cancelled) setLocationStateOptions(names)
      } catch {
        if (!cancelled) setLocationStateOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [shippingForm.country])

  useEffect(() => {
    let cancelled = false
    const country = shippingForm.country.trim()
    const state = shippingForm.state.trim()
    if (!state) {
      setLocationCityOptions([])
      return
    }
    ;(async () => {
      try {
        const res = await fetch(
          `/api/location/options?type=cities&country=${encodeURIComponent(country)}&state=${encodeURIComponent(state)}`,
        )
        const json = await res.json()
        const names = ((json.data ?? []) as Array<{ value: string }>).map((x) => x.value)
        if (!cancelled) setLocationCityOptions(names)
      } catch {
        if (!cancelled) setLocationCityOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [shippingForm.country, shippingForm.state])

  const updateShippingField = (field: keyof ShippingForm, value: string) => {
    if (field === 'country') {
      setShippingForm((prev) => ({
        ...prev,
        country: value,
        state: '',
        city: '',
      }))
      setShippingErrors((prev) => {
        const next = { ...prev }
        delete next.state
        delete next.city
        return next
      })
      return
    }
    if (field === 'state') {
      setShippingForm((prev) => ({
        ...prev,
        state: value,
        city: '',
      }))
      setShippingErrors((prev) => {
        const next = { ...prev }
        delete next.city
        next.state = getFieldError('state', value.trim())
        return next
      })
      return
    }
    setShippingForm((prev) => ({ ...prev, [field]: value }))
    const cleaned = value.trim()
    setShippingErrors((prev) => ({ ...prev, [field]: getFieldError(field, cleaned) }))
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
          customerEmail: shippingForm.email.trim() || undefined,
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
    const trimmed = trimShippingFormFields(shippingForm)
    const nextErrors: Partial<Record<keyof ShippingForm, string>> = {}

    SHIPPING_FIELD_ORDER.forEach((key) => {
      const err = getFieldError(key, trimmed[key])
      if (err) nextErrors[key] = err
    })

    if (trimmed.state && locationCityOptions.length > 0) {
      const okCity = locationCityOptions.some((c) => c.toLowerCase() === trimmed.city.toLowerCase())
      if (!trimmed.city) {
        nextErrors.city = 'Este campo es obligatorio.'
      } else if (!okCity) {
        nextErrors.city = 'Selecciona una ciudad de la lista.'
      }
    }

    setShippingErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      scrollToFirstShippingError(nextErrors)
      return false
    }

    setShippingForm(trimmed)

    if (!selectedMethod) {
      toast.error('Selecciona un método de envío para continuar.')
      return false
    }
    if (createAccount && newPassword.trim().length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.')
      requestAnimationFrame(() => {
        document.querySelector('[data-checkout-field="account-password"]')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      })
      return false
    }
    return true
  }

  const validatePaymentStep = () => {
    if (!isManualCardPayment(paymentMethod)) return true

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

  const handleContinue = async (confirmDuplicate = false) => {
    if (activeStep === 1) {
      if (!checkoutConfigReady) {
        toast.error('Espera un momento mientras cargamos la configuración de la tienda.')
        triggerPanelShake()
        return
      }
      if (items.length === 0) {
        toast.error('Tu carrito está vacío.')
        triggerPanelShake()
        return
      }
      if (subtotal < minOrderCents) {
        toast.error(`El pedido mínimo es ${formatPrice(minOrderCents)}.`)
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
      const ga4Items = items.map((item) =>
        buildGa4Item(
          { id: item.product.id, name: item.product.name, category: item.product.category },
          item.variant_price ?? item.product.base_price ?? item.product.price,
          item.quantity
        )
      )
      trackBeginCheckout(ga4Items, subtotal)
      trackInitiateCheckout(items.map((item) => item.product.id), subtotal)
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

      const ship = trimShippingFormFields(shippingForm)

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
            full_name: `${ship.firstName} ${ship.lastName}`.trim(),
            email: ship.email,
            phone: ship.phone,
          },
          shipping: {
            address: `${ship.address}, Col. ${ship.neighborhood}`,
            city: ship.city,
            state: ship.state,
            zip_code: ship.zipCode,
            country: ship.country,
            method_id: selectedMethod.id,
            method_label: selectedMethod.label,
            fee: shippingFee,
            eta_label: selectedMethod.etaLabel,
            estimated_date: selectedMethod.estimatedDate,
          },
          payment_method: paymentMethod,
          confirm_duplicate: confirmDuplicate || undefined,
        }),
      })

      const createPayload = await createOrderResponse.json()
      if (!createOrderResponse.ok) {
        if (createPayload?.error === 'stock_unavailable') {
          setStockConflict(createPayload?.products ?? [])
          goToStep(1)
          toast.error('Algunos productos se agotaron. Puedes removerlos y continuar.')
        } else if (createPayload?.error === 'duplicate_order' && createPayload?.duplicate) {
          const duplicate = createPayload.duplicate as DuplicateOrder
          setDuplicateOrder(duplicate)
          setDuplicateAccessToken(sessionStorage.getItem(`nurei-order-access:${duplicate.id}`))
        } else {
          toast.error(createPayload?.error ?? 'No se pudo crear la orden.')
        }
        setProcessingStage(null)
        return
      }

      const nextOrderId = createPayload.data.order_id as string
      const publicAccessToken = (createPayload.data.public_access_token as string | undefined) ?? null
      if (publicAccessToken) {
        sessionStorage.setItem(`nurei-order-access:${nextOrderId}`, publicAccessToken)
      }
      setOrderId(nextOrderId)

      setProcessingStage('paying')
      if (paymentMethod === 'stripe_card') {
        const paymentResponse = await fetch('/api/payment/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: nextOrderId, public_access_token: publicAccessToken }),
        })
        const paymentPayload = await paymentResponse.json()

        if (!paymentResponse.ok) {
          toast.error(paymentPayload?.error ?? 'No se pudo iniciar el pago con Stripe.')
          setProcessingStage(null)
          return
        }

        const checkoutUrl = paymentPayload?.data?.checkout_url as string | undefined
        if (!checkoutUrl) {
          toast.error('Stripe no devolvió una URL de pago válida.')
          setProcessingStage(null)
          return
        }

        window.location.href = checkoutUrl
        return
      }

      const normalizedCardNumber = cardForm.number.replace(/\D/g, '')
      const paymentResponse = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: nextOrderId,
          public_access_token: publicAccessToken,
          amount: total,
          method: paymentMethod,
          saveMethod: savePaymentMethod,
          cartLastUpdatedAt,
          card: isManualCardPayment(paymentMethod)
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
      let confirmationPayload: Record<string, unknown> = {}
      let confirmOk = false
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt))
        try {
          const qs = publicAccessToken ? `?token=${encodeURIComponent(publicAccessToken)}` : ''
          const res = await fetch(`/api/orders/${nextOrderId}/confirm${qs}`)
          confirmationPayload = await res.json()
          if (res.ok) { confirmOk = true; break }
        } catch { /* retry */ }
      }

      if (!confirmOk) {
        toast.error((confirmationPayload as { error?: string })?.error ?? 'No se pudo cargar la confirmación.')
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
              email: ship.email,
              password: newPassword,
              name: `${ship.firstName} ${ship.lastName}`.trim(),
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
      <section className="py-16 bg-gray-50 min-h-screen flex items-center justify-center px-4">
        <SnackWaitAnimation stage="checkout" />
      </section>
    )
  }

  if (items.length === 0 && activeStep !== 4) {
    return (
      <section className="py-20 bg-gray-50 min-h-screen">
        <Container className="max-w-4xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-primary-cyan shadow-sm">
            <ShoppingBag className="h-8 w-8" />
          </div>
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
          <SnackWaitAnimation stage={processingStage} />
        </div>
      )}

      <Container className="max-w-6xl relative">
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-dark transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Seguir comprando
        </Link>

        <h1 className="text-3xl font-bold text-primary-dark mb-2">Crear pedido</h1>
        <p className="text-gray-500 mb-5">Completa estos pasos y tu snack estará en camino.</p>

        <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 mb-6 overflow-hidden">
          <div className="flex flex-nowrap items-center gap-1 sm:gap-1.5 mb-3 overflow-x-auto pb-1 -mx-0.5 px-0.5 scrollbar-none">
            {STEP_META.map((step) => {
              const onConfirmScreen = activeStep === 4
              const isDone = step.id < activeStep || (onConfirmScreen && step.id === 4)
              const isActive = step.id === activeStep && !onConfirmScreen
              return (
                <div
                  key={step.id}
                  className={`inline-flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-full border px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[11px] md:text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'border-primary-cyan bg-primary-cyan/20 text-primary-dark'
                      : isDone
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500'
                  }`}
                >
                  <span
                    className={`inline-flex w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 items-center justify-center rounded-full text-[9px] sm:text-[10px] ${
                      isDone ? 'bg-emerald-500 text-white checkout-check-pop' : 'bg-white text-gray-600'
                    }`}
                  >
                    {isDone ? <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : step.id}
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
          <p className="text-[10px] sm:text-xs text-gray-500 mt-2">
            {activeStep === 4
              ? 'Pedido completado · ¡gracias por tu compra!'
              : `${PROGRESS_BY_STEP[activeStep]}% · Paso ${activeStep} de 4`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className={activeStep === 4 ? 'lg:col-span-5' : 'lg:col-span-3'}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeStep}-${panelKey}`}
                initial={{ opacity: 0, x: direction === 'forward' ? 14 : -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction === 'forward' ? -12 : 12 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className={`rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 ${shakePanel ? 'checkout-shake' : ''}`}
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
                            if (remainingSubtotal >= minOrderCents) {
                              goToStep(2)
                            } else {
                              toast.error(`El pedido mínimo es ${formatPrice(minOrderCents)}.`)
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
                      const unitPrice = item.variant_price ?? item.product.base_price ?? item.product.price
                      const productSubtotal = unitPrice * item.quantity
                      const itemKey = `${item.product.id}:${item.variant_id ?? ''}`
                      const viewerCount = viewerCounts[itemKey]
                      const showViewers = viewerCount !== undefined && !hiddenViewerKeys.has(itemKey)
                      const imageUrl = item.variant_image ?? item.product.images?.[item.product.primary_image_index] ?? item.product.image_thumbnail_url

                      return (
                        <div
                          key={itemKey}
                          className="relative rounded-2xl border border-gray-200 p-3 sm:p-4 lg:p-3 checkout-stagger-in"
                          style={{ animationDelay: `${idx * 80}ms` }}
                        >
                          {deleteCandidate === itemKey ? (
                            <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-2 rounded-full bg-white/95 px-2 py-1 text-xs shadow-sm border border-red-100">
                              <span className="text-gray-500">¿Eliminar?</span>
                              <button
                                type="button"
                                className="font-bold text-red-600"
                                onClick={() => {
                                  removeItem(item.product.id, item.variant_id)
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
                              className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                              onClick={() => setDeleteCandidate(itemKey)}
                              aria-label="Eliminar producto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}

                          <div className="flex items-center gap-3 lg:gap-2.5 pr-9">
                            <div className="w-16 h-16 lg:w-[52px] lg:h-[52px] shrink-0 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center text-2xl lg:text-xl">
                              {imageUrl ? (
                                <Image
                                  src={imageUrl}
                                  alt={item.product.name}
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>🍜</span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="min-w-0">
                                <p className="font-bold text-primary-dark truncate text-[15px] lg:text-sm leading-tight pr-1">{item.product.name}</p>
                                {item.variant_label && (
                                  <p className="mt-0.5 text-[11px] font-semibold text-primary-cyan truncate">{item.variant_label}</p>
                                )}
                                <p className="mt-1 text-base sm:text-sm font-black text-primary-dark tabular-nums">
                                  {formatPrice(productSubtotal)}
                                  {item.quantity > 1 && (
                                    <span className="ml-1 text-[11px] font-semibold text-gray-400">
                                      {formatPrice(unitPrice)} c/u
                                    </span>
                                  )}
                                </p>
                              </div>

                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {lowStock && (
                                  <span className="whitespace-nowrap text-[10px] uppercase tracking-wide font-bold rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-red-600">
                                    Últimas unidades
                                  </span>
                                )}
                                {showViewers && (
                                  <span className="whitespace-nowrap text-[10px] uppercase tracking-wide font-semibold rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-700">
                                    {viewerCount} viendo ahora
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 self-center">
                              <div className="inline-flex items-center gap-1 rounded-full bg-gray-50 p-1">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variant_id)}
                                  className="w-9 h-9 lg:w-8 lg:h-8 inline-flex items-center justify-center rounded-full bg-white text-gray-500 hover:bg-gray-100 transition-colors"
                                  aria-label="Restar"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-6 text-center font-black text-sm lg:text-xs tabular-nums">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variant_id)}
                                  className="w-9 h-9 lg:w-8 lg:h-8 inline-flex items-center justify-center rounded-full bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover transition-colors"
                                  aria-label="Sumar"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
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
                <div className="relative">
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-primary-dark">Paso 2 · Datos de envío</h2>
                    <p className="text-sm text-gray-500">Completa tu dirección de entrega.</p>
                  </div>

                  {typeof freeShipMin === 'number' && freeShipMin > 0 && !qualifiesFreeShipping && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                      Agrega{' '}
                      <span className="font-bold">{formatPrice(freeShipMin - subtotal)}</span> más en productos para
                      desbloquear <span className="font-semibold">envío gratis</span> en envío estándar.
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div data-checkout-field="firstName">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre</label>
                      <Input
                        value={shippingForm.firstName}
                        onChange={(event) => updateShippingField('firstName', event.target.value)}
                        className="mt-1"
                        autoComplete="given-name"
                      />
                      {shippingErrors.firstName && <p className="text-xs text-red-600 mt-1">{shippingErrors.firstName}</p>}
                    </div>

                    <div data-checkout-field="lastName">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Apellido</label>
                      <Input
                        value={shippingForm.lastName}
                        onChange={(event) => updateShippingField('lastName', event.target.value)}
                        className="mt-1"
                        autoComplete="family-name"
                      />
                      {shippingErrors.lastName && <p className="text-xs text-red-600 mt-1">{shippingErrors.lastName}</p>}
                    </div>

                    <div data-checkout-field="email">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</label>
                      <Input
                        value={shippingForm.email}
                        onChange={(event) => updateShippingField('email', event.target.value)}
                        className="mt-1"
                        autoComplete="email"
                      />
                      {shippingErrors.email && <p className="text-xs text-red-600 mt-1">{shippingErrors.email}</p>}
                    </div>

                    <div data-checkout-field="phone">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Teléfono</label>
                      <Input
                        value={shippingForm.phone}
                        onChange={(event) => updateShippingField('phone', event.target.value)}
                        className="mt-1"
                        autoComplete="tel"
                      />
                      {shippingErrors.phone && <p className="text-xs text-red-600 mt-1">{shippingErrors.phone}</p>}
                    </div>

                    <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-4 space-y-4">
                      {authOk ? (
                        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                          <div>
                            <p className="font-semibold">Pedido en tu cuenta</p>
                            <p className="text-xs text-emerald-800 mt-0.5">
                              Este pedido se guardará y asociará a <span className="font-medium">{authEmail ?? 'tu sesión'}</span>.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setCreateAccount((v) => !v)
                              setPasswordError('')
                              setNewPassword('')
                            }}
                            className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-all ${
                              createAccount
                                ? 'border-primary-cyan bg-white'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className="text-left min-w-0">
                              <p className="text-sm font-semibold text-primary-dark">¿Guardar pedido en cuenta?</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Activa para crear cuenta al finalizar y ver tus pedidos después.
                              </p>
                            </div>
                            <div
                              className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors relative ${
                                createAccount ? 'bg-primary-cyan' : 'bg-gray-300'
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                                  createAccount ? 'left-5' : 'left-0.5'
                                }`}
                              />
                            </div>
                          </button>

                          {createAccount && (
                            <div data-checkout-field="account-password">
                              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Contraseña para tu cuenta nueva
                              </label>
                              <Input
                                type="password"
                                value={newPassword}
                                onChange={(event) => {
                                  setNewPassword(event.target.value)
                                  setPasswordError('')
                                }}
                                placeholder="Mínimo 6 caracteres"
                                className="mt-1 bg-white"
                              />
                              {passwordError && <p className="text-xs text-red-600 mt-1">{passwordError}</p>}
                            </div>
                          )}

                          <div className="border-t border-gray-200 pt-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-gray-600 leading-snug">
                                ¿Ya tienes cuenta? Inicia sesión para autocompletar datos y asociar este pedido.
                              </p>
                              <button
                                type="button"
                                className="shrink-0 text-sm font-semibold text-amber-500 hover:text-amber-400 underline underline-offset-4"
                                onClick={() => {
                                  setLoginOpen(true)
                                  setLoginError('')
                                }}
                              >
                                Iniciar sesión
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Dirección de entrega</p>
                    </div>

                    <div data-checkout-field="country">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">País</label>
                      <select
                        value={shippingForm.country}
                        onChange={(event) => updateShippingField('country', event.target.value)}
                        className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="México">México</option>
                        <option value="Estados Unidos">Estados Unidos</option>
                      </select>
                      {shippingErrors.country && <p className="text-xs text-red-600 mt-1">{shippingErrors.country}</p>}
                    </div>

                    <div data-checkout-field="state">
                      <SearchableSelect
                        label="Estado / entidad"
                        value={shippingForm.state}
                        options={locationStateOptions}
                        onChange={(v) => updateShippingField('state', v)}
                        placeholder="Busca y selecciona tu estado…"
                        disabled={!shippingForm.country}
                        error={shippingErrors.state}
                      />
                    </div>

                    <div data-checkout-field="city" className="md:col-span-2">
                      <SearchableSelect
                        label="Ciudad / municipio"
                        value={shippingForm.city}
                        options={locationCityOptions}
                        onChange={(v) => updateShippingField('city', v)}
                        placeholder={
                          !shippingForm.state ? 'Primero elige un estado' : 'Busca y selecciona tu ciudad…'
                        }
                        disabled={!shippingForm.state}
                        error={shippingErrors.city}
                      />
                    </div>

                    <div data-checkout-field="neighborhood">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Colonia</label>
                      <Input
                        value={shippingForm.neighborhood}
                        onChange={(event) => updateShippingField('neighborhood', event.target.value)}
                        className="mt-1"
                        autoComplete="address-level2"
                      />
                      {shippingErrors.neighborhood && (
                        <p className="text-xs text-red-600 mt-1">{shippingErrors.neighborhood}</p>
                      )}
                    </div>

                    <div data-checkout-field="zipCode">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Código postal</label>
                      <Input
                        value={shippingForm.zipCode}
                        onChange={(event) => updateShippingField('zipCode', event.target.value)}
                        className="mt-1"
                        autoComplete="postal-code"
                      />
                      {shippingErrors.zipCode && <p className="text-xs text-red-600 mt-1">{shippingErrors.zipCode}</p>}
                    </div>

                    <div data-checkout-field="address" className="md:col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Calle y número</label>
                      <Input
                        value={shippingForm.address}
                        onChange={(event) => updateShippingField('address', event.target.value)}
                        placeholder="Calle, número exterior e interior"
                        className="mt-1"
                        autoComplete="street-address"
                      />
                      {shippingErrors.address && <p className="text-xs text-red-600 mt-1">{shippingErrors.address}</p>}
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
                        {shippingMethods.map((method) => {
                          const baseStandard = storeBootstrap?.shipping.standard_fee_cents ?? 0
                          const showFreeDeal =
                            method.id === 'standard' &&
                            qualifiesFreeShipping &&
                            method.price === 0 &&
                            baseStandard > 0

                          return (
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
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <p className="text-sm font-semibold text-primary-dark">{method.label}</p>
                                    <div className="text-right">
                                      {showFreeDeal ? (
                                        <div className="flex flex-col items-end leading-tight">
                                          <span className="text-xs text-gray-400 line-through">{formatPrice(baseStandard)}</span>
                                          <span className="text-sm font-black text-emerald-600 tracking-tight">GRATIS</span>
                                        </div>
                                      ) : (
                                        <p className="text-sm font-bold text-primary-dark">
                                          {method.price === 0 ? (
                                            <span className="text-emerald-600">Gratis</span>
                                          ) : (
                                            formatPrice(method.price)
                                          )}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-500">{method.description}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {method.etaLabel} · Entrega estimada{' '}
                                    {new Date(method.estimatedDate).toLocaleDateString('es-MX')}
                                  </p>
                                </div>
                              </div>
                            </label>
                          )
                        })}
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

                  {(storeBootstrap?.payment_methods ?? []).length === 0 ? (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-5">
                      No hay métodos de pago disponibles por el momento. Configura métodos activos en el panel de administración.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                      {(storeBootstrap?.payment_methods ?? []).map((method) => (
                        <button
                          key={method.slug}
                          type="button"
                          onClick={() => setPaymentMethod(method.slug)}
                          className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all ${
                            paymentMethod === method.slug
                              ? 'border-primary-cyan bg-primary-cyan/10 text-primary-dark'
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {method.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {isManualCardPayment(paymentMethod) && (
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-stretch">
                  <div className="rounded-2xl border border-gray-200 p-4 sm:p-5 text-center">
                    <div className="flex justify-center mb-3">
                      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 inline-flex items-center justify-center checkout-confirm-check">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-primary-dark">¡Pedido confirmado!</h2>
                    <p className="text-sm text-emerald-700 font-medium mt-1">Tu pedido está en camino</p>
                    <p className="text-gray-500 mt-2 text-sm">
                      Número de orden <span className="font-semibold">{orderConfirmation.order_number}</span>
                    </p>
                    <div className="mt-4 text-sm text-gray-600 space-y-1 text-left max-w-md mx-auto">
                      <p>Cliente: {orderConfirmation.customer.full_name}</p>
                      <p>Email: {orderConfirmation.customer.email ?? 'No especificado'}</p>
                      <p>Dirección: {orderConfirmation.customer.delivery_address}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4 sm:p-5 text-left flex flex-col justify-between">
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

                    <p className="mt-3 text-xs text-gray-400 leading-relaxed">
                      El número de guía estará disponible en los detalles de tu pedido una vez que sea enviado. Puedes consultarlo en tu cuenta → Mis pedidos.
                    </p>

                    <div className="mt-4 space-y-2">
                      <Link
                        href={`/pedido/${orderConfirmation.id}${orderConfirmation.public_access_token ? `?token=${encodeURIComponent(orderConfirmation.public_access_token)}` : ''}`}
                        className="block"
                      >
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
                  <div className="flex flex-col items-stretch gap-2 w-full sm:w-auto sm:items-end">
                    {activeStep === 1 && checkoutConfigReady && minOrderCents > 0 && subtotal < minOrderCents && (
                      <p className="text-[11px] text-center sm:text-right text-gray-500 order-2 sm:order-1">
                        Pedido mínimo {formatPrice(minOrderCents)} · Faltan{' '}
                        <span className="font-semibold text-primary-dark">{formatPrice(minOrderCents - subtotal)}</span>
                      </p>
                    )}
                    {activeStep === 1 &&
                      typeof freeShipMin === 'number' &&
                      freeShipMin > 0 &&
                      subtotal < freeShipMin && (
                        <p className="text-[11px] text-center sm:text-right text-gray-500 order-3 sm:order-2">
                          Te faltan <span className="font-semibold">{formatPrice(freeShipMin - subtotal)}</span> para envío
                          gratis.
                        </p>
                      )}
                  <Button
                    type="button"
                    onClick={() => void handleContinue()}
                    disabled={
                      storeCheckoutLoading ||
                      (activeStep === 3 && (storeBootstrap?.payment_methods ?? []).length === 0) ||
                      (activeStep === 1 && (!checkoutConfigReady || subtotal < minOrderCents))
                    }
                    className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover w-full sm:w-auto order-1 sm:order-3"
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
                </div>
              )}
              </motion.div>
            </AnimatePresence>
          </div>

          {activeStep < 4 && (
            <aside className="lg:col-span-2 hidden lg:block">
              <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-5 lg:p-4">
                <p className="text-sm font-semibold text-primary-dark mb-2 lg:mb-2 inline-flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-primary-cyan" />
                  Resumen del pedido
                </p>

                <div className="space-y-1 max-h-52 lg:max-h-64 overflow-auto pr-1">
                  {items.map((item) => {
                    const unit = item.variant_price ?? item.product.base_price ?? item.product.price
                    const lineTotal = unit * item.quantity
                    return (
                      <div
                        key={`${item.product.id}:${item.variant_id ?? ''}`}
                        className="flex items-baseline gap-2 text-[11px] lg:text-[12px] leading-snug"
                      >
                        <span className="tabular-nums text-gray-500 shrink-0">{item.quantity}×</span>
                        <span className="flex-1 min-w-0 text-gray-700 truncate">
                          {item.product.name}{item.variant_label ? ` · ${item.variant_label}` : ''}
                        </span>
                        <span className="font-semibold text-primary-dark tabular-nums shrink-0">
                          {formatPrice(lineTotal)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="my-3 border-t border-dashed border-gray-200" />

                <div className="mt-0 lg:mt-0 text-[11px] lg:text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium tabular-nums">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500">Envío</span>
                    <span className="font-medium text-right">
                      {selectedMethod?.id === 'standard' &&
                      qualifiesFreeShipping &&
                      (storeBootstrap?.shipping.standard_fee_cents ?? 0) > 0 ? (
                        <span className="inline-flex flex-col items-end leading-tight">
                          <span className="text-[10px] text-gray-400 line-through">
                            {formatPrice(storeBootstrap?.shipping.standard_fee_cents ?? 0)}
                          </span>
                          <span className="text-emerald-600 font-semibold">Gratis</span>
                        </span>
                      ) : shippingFee === 0 ? (
                        <span className="text-emerald-600 font-semibold">Gratis</span>
                      ) : (
                        formatPrice(shippingFee)
                      )}
                    </span>
                  </div>
                  {effectiveCouponDiscount > 0 && couponState.appliedCode && (
                    <div className="flex items-start justify-between gap-2 text-emerald-700">
                      <span className="min-w-0 truncate">
                        Cupón <span className="font-semibold">{couponState.appliedCode}</span>
                      </span>
                      <span className="font-medium shrink-0 tabular-nums">
                        −{formatPrice(effectiveCouponDiscount)}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200 flex items-center justify-between gap-2">
                    <span className="font-semibold text-primary-dark">Total</span>
                    <span className="text-base lg:text-lg font-bold text-primary-dark tabular-nums">
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>

                {typeof freeShipMin === 'number' && freeShipMin > 0 && subtotal < freeShipMin && (
                  <p className="text-[11px] lg:text-xs text-gray-500 mt-2 leading-tight">
                    Te faltan{' '}
                    <span className="font-semibold text-primary-dark">{formatPrice(freeShipMin - subtotal)}</span> para
                    envío gratis.
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
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-center justify-between gap-2 text-sm font-semibold text-primary-dark"
            >
              <span>{mobileSummaryOpen ? 'Ocultar resumen' : 'Ver resumen del pedido'}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-amber-600 font-bold">{formatPrice(total)}</span>
                <motion.svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  animate={{ rotate: mobileSummaryOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-gray-400 shrink-0"
                >
                  <path d="m6 9 6 6 6-6" />
                </motion.svg>
              </div>
            </button>
            <AnimatePresence initial={false}>
              {mobileSummaryOpen && (
                <motion.div
                  key="mobile-summary"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
                    <div className="space-y-1 max-h-44 overflow-auto pr-0.5">
                      {items.map((item) => {
                        const unit = item.variant_price ?? item.product.base_price ?? item.product.price
                        const lineTotal = unit * item.quantity
                        return (
                          <div key={`${item.product.id}:${item.variant_id ?? ''}`} className="flex gap-2 text-[11px] leading-snug">
                            <span className="tabular-nums text-gray-500 shrink-0">{item.quantity}×</span>
                            <span className="flex-1 min-w-0 text-gray-700 truncate">
                              {item.product.name}{item.variant_label ? ` · ${item.variant_label}` : ''}
                            </span>
                            <span className="font-semibold text-primary-dark tabular-nums shrink-0">
                              {formatPrice(lineTotal)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="my-2 border-t border-dashed border-gray-200" />
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between gap-2 text-gray-600">
                        <span>Subtotal</span>
                        <span className="tabular-nums font-medium">{formatPrice(subtotal)}</span>
                      </div>
                      <div className="flex justify-between gap-2 text-gray-600">
                        <span>Envío</span>
                        <span className="tabular-nums font-semibold text-right">
                          {shippingFee === 0 ? (
                            <span className="text-emerald-600">Gratis</span>
                          ) : (
                            formatPrice(shippingFee)
                          )}
                        </span>
                      </div>
                      {effectiveCouponDiscount > 0 && couponState.appliedCode && (
                        <div className="flex justify-between gap-2 text-emerald-700">
                          <span className="min-w-0 truncate">
                            Cupón <span className="font-semibold">{couponState.appliedCode}</span>
                          </span>
                          <span className="tabular-nums shrink-0">−{formatPrice(effectiveCouponDiscount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-2 pt-2 border-t border-gray-200 font-bold text-primary-dark text-xs">
                        <span>Total</span>
                        <span className="tabular-nums">{formatPrice(total)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <Dialog
          open={Boolean(duplicateOrder)}
          onOpenChange={(open) => {
            if (!open) {
              setDuplicateOrder(null)
              setDuplicateAccessToken(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-[440px] max-w-[calc(100vw-2rem)] border-0 bg-transparent p-0 shadow-none overflow-hidden">
            {duplicateOrder && (
              <div className="relative rounded-3xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-1 shadow-[0_24px_80px_-12px_rgba(120,53,15,0.24)]">
                <div className="rounded-[1.35rem] bg-white/95 px-6 pt-7 pb-6 backdrop-blur-sm">
                  <DialogHeader className="space-y-2 text-center sm:text-center">
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-primary-dark">
                      {duplicateOrder.severity === 'warning' ? '¿Quieres repetir este pedido?' : 'Encontramos un pedido igual'}
                    </DialogTitle>
                    <p className="text-sm text-gray-600 leading-relaxed px-1">
                      El pedido <span className="font-bold text-primary-dark">{duplicateOrder.shortId}</span> tiene los mismos productos y total, y se creó hace{' '}
                      <span className="font-semibold text-primary-dark">
                        {duplicateOrder.ageSeconds < 60
                          ? 'menos de un minuto'
                          : `${Math.max(1, Math.floor(duplicateOrder.ageSeconds / 60))} min`}
                      </span>.
                    </p>
                  </DialogHeader>
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-900">
                    {duplicateOrder.severity === 'warning'
                      ? 'Es una alerta para evitar una compra repetida por accidente. Revisa el pedido anterior antes de continuar.'
                      : 'Para evitar cobros o envíos duplicados, revisa el pedido anterior o confirma de forma explícita que deseas crear otro.'}
                  </div>
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        setDuplicateOrder(null)
                        setDuplicateAccessToken(null)
                      }}
                    >
                      Volver a revisar
                    </Button>
                    {(duplicateOrder.can_open || duplicateAccessToken) && (
                      <Link
                        href={`/pedido/${duplicateOrder.id}${duplicateAccessToken ? `?token=${encodeURIComponent(duplicateAccessToken)}` : ''}`}
                        className="inline-flex"
                      >
                        <Button type="button" variant="outline" className="w-full rounded-xl border-primary-cyan/40 text-primary-dark hover:bg-primary-cyan/10">
                          Ver pedido anterior
                        </Button>
                      </Link>
                    )}
                    <Button
                      type="button"
                      className="rounded-xl bg-amber-500 text-white hover:bg-amber-600"
                      onClick={() => {
                        setDuplicateOrder(null)
                        setDuplicateAccessToken(null)
                        void handleContinue(true)
                      }}
                    >
                      Sí, crear otro
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
          <DialogContent className="sm:max-w-[420px] max-w-[calc(100vw-2rem)] border-0 bg-transparent p-0 shadow-none overflow-hidden">
            <div className="relative rounded-3xl border border-gray-200/80 bg-gradient-to-b from-white to-gray-50/95 p-1 shadow-[0_24px_80px_-12px_rgba(15,23,42,0.28)]">
              <div className="rounded-[1.35rem] bg-white/95 px-6 pt-8 pb-6 backdrop-blur-sm">
                <DialogHeader className="space-y-2 text-center sm:text-center pb-2">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-cyan/25 to-primary-cyan/5 ring-1 ring-primary-cyan/20">
                    <UserRound className="h-6 w-6 text-primary-dark opacity-90" />
                  </div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-primary-dark">
                    Iniciar sesión
                  </DialogTitle>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed px-2">
                    Accede con tu cuenta para sincronizar tus datos de envío sin perder tu avance.
                  </p>
                </DialogHeader>
                <div className="space-y-4 pt-3">
                  <GoogleAuthButton
                    onClick={() => authLoginWithGoogle(`/checkout?step=${activeStep}`)}
                    className="w-full flex items-center justify-center gap-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                  />
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-gray-100" />
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">o con email</span>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      Correo electrónico
                    </label>
                    <Input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="mt-1.5 h-11 rounded-xl border-gray-200 bg-gray-50/80 focus-visible:ring-primary-cyan/40"
                      autoComplete="email"
                      placeholder="tucorreo@ejemplo.com"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      Contraseña
                    </label>
                    <Input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="mt-1.5 h-11 rounded-xl border-gray-200 bg-gray-50/80 focus-visible:ring-primary-cyan/40"
                      autoComplete="current-password"
                      placeholder="••••••••"
                    />
                  </div>
                  {loginError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                      {loginError}
                    </div>
                  )}
                  <Button
                    type="button"
                    className="w-full h-12 rounded-xl bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold text-base shadow-sm"
                    disabled={loginBusy}
                    onClick={async () => {
                      setLoginBusy(true)
                      setLoginError('')
                      const result = await authLogin(loginEmail.trim(), loginPassword)
                      setLoginBusy(false)
                      if (!result.success) {
                        setLoginError(result.error ?? 'No pudimos iniciar sesión.')
                        return
                      }
                      setLoginPassword('')
                      setLoginOpen(false)
                      setCreateAccount(false)
                      await refreshUser()
                      toast.success('Sesión iniciada')
                    }}
                  >
                    {loginBusy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Entrar'}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </Container>
    </section>
  )
}
