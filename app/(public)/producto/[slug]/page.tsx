'use client'

import { use, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence, useMotionValue, useReducedMotion } from 'framer-motion'
import {
  Heart, ShoppingBag, ArrowLeft, Share2, Check,
  ChevronLeft, ChevronRight, Flame, X,
  ZoomIn, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useCartStore } from '@/lib/stores/cart'
import { useFavoritesStore } from '@/lib/stores/favorites'
import { formatPrice } from '@/lib/utils/format'
import { SPICE_LABELS } from '@/lib/utils/constants'
import { Container } from '@/components/layout/Container'
import { ProductCard } from '@/components/productos/ProductCard'
import type { Product, ProductVariant } from '@/types'
import { cn } from '@/lib/utils'
import { formatProductPresentation } from '@/lib/utils/product-presentation'
import { countryToFlag } from '@/lib/utils/country-flag'
import { SnackWaitAnimation } from '@/components/checkout/SnackWaitAnimation'

// ── Helpers ────────────────────────────────────────────────────────────────

const DESKTOP_DESCRIPTION_COLLAPSED_HEIGHT = 72

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    crunchy: '🍘', spicy: '🌶️', limited_edition: '🍵', drinks: '🥤',
    snacks: '🍿', ramen: '🍜', dulces: '🍬', salsas: '🫙',
  }
  return map[category] || '🍘'
}

function getCategoryFlightStyles(category: string): { ring: string; glow: string } {
  const map: Record<string, { ring: string; glow: string }> = {
    crunchy: { ring: 'ring-amber-200 bg-amber-50 text-amber-700', glow: 'shadow-amber-500/20' },
    spicy: { ring: 'ring-red-200 bg-red-50 text-red-600', glow: 'shadow-red-500/20' },
    limited_edition: { ring: 'ring-emerald-200 bg-emerald-50 text-emerald-700', glow: 'shadow-emerald-500/20' },
    drinks: { ring: 'ring-sky-200 bg-sky-50 text-sky-600', glow: 'shadow-sky-500/20' },
    snacks: { ring: 'ring-yellow-200 bg-yellow-50 text-yellow-700', glow: 'shadow-yellow-500/20' },
    ramen: { ring: 'ring-orange-200 bg-orange-50 text-orange-700', glow: 'shadow-orange-500/20' },
    dulces: { ring: 'ring-pink-200 bg-pink-50 text-pink-600', glow: 'shadow-pink-500/20' },
    salsas: { ring: 'ring-stone-200 bg-stone-50 text-stone-700', glow: 'shadow-stone-500/20' },
  }

  return map[category] || { ring: 'ring-gray-200 bg-white text-gray-700', glow: 'shadow-black/10' }
}

function cleanTagLabel(tag: string): string {
  return tag.replace(/^[\u{1F30D}\u{1F30E}\u{1F30F}\u{1F310}\u{1F5FA}\s\-•·]+/u, '').trim()
}

function ShareButtons({ name, slug }: { name: string; slug: string }) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/producto/${slug}` : ''
  const text = `Mira ${name} en nurei — snacks asiáticos premium`

  const share = (platform: string) => {
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    }
    if (platform === 'copy') {
      navigator.clipboard.writeText(url)
      toast.success('Link copiado')
      return
    }
    window.open(urls[platform], '_blank', 'width=600,height=400')
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => share('whatsapp')} className="p-2.5 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="WhatsApp">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </button>
      <button onClick={() => share('copy')} className="p-2.5 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors" title="Copiar link">
        <Share2 className="w-4 h-4" />
      </button>
    </div>
  )
}

type FlyingSnack = {
  id: number
  icon: string
  qty: number
  start: { x: number; y: number }
  end: { x: number; y: number }
  styles: { ring: string; glow: string }
}

function FlyingSnackTrail({
  items,
  onDone,
}: {
  items: FlyingSnack[]
  onDone: (id: number) => void
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      <AnimatePresence>
        {items.map((item) => {
          const dx = item.start.x - item.end.x
          const dy = item.start.y - item.end.y

          return (
            <motion.div
              key={item.id}
              className={cn(
                'absolute flex items-center justify-center rounded-full border shadow-2xl backdrop-blur-md',
                item.styles.ring,
                item.styles.glow,
              )}
              style={{
                left: item.end.x,
                top: item.end.y,
                width: 54,
                height: 54,
              }}
              initial={{
                opacity: 0,
                x: dx,
                y: dy,
                scale: 0.55,
                rotate: -18,
              }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: [dx, dx * 0.35, 0],
                y: [dy, dy - 90, 0],
                scale: [0.55, 1.15, 0.92, 0.18],
                rotate: [-18, 8, 24],
              }}
              transition={{
                duration: 0.95,
                ease: 'easeInOut',
              }}
              onAnimationComplete={() => onDone(item.id)}
            >
              <span className="text-2xl leading-none select-none drop-shadow-sm">
                {item.icon}
              </span>
              {item.qty > 1 && (
                <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-gray-900 text-[10px] font-black text-white flex items-center justify-center shadow-lg">
                  x{item.qty}
                </span>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

// ── Image Lightbox ─────────────────────────────────────────────────────────

function ImageLightbox({
  images,
  startIndex,
  onClose,
}: {
  images: string[]
  startIndex: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(startIndex)
  const dragX = useMotionValue(0)

  const prev = useCallback(() => setIdx((i) => (i - 1 + images.length) % images.length), [images.length])
  const next = useCallback(() => setIdx((i) => (i + 1) % images.length), [images.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, onClose, prev])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.95)' }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image with drag-to-swipe */}
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          className="relative w-full h-full flex items-center justify-center"
          drag={images.length > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.3}
          style={{ x: dragX }}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60) next()
            else if (info.offset.x > 60) prev()
            dragX.set(0)
          }}
        >
          <motion.img
            key={images[idx]}
            src={images[idx]}
            alt=""
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2 }}
            className="max-w-full max-h-[90dvh] object-contain select-none"
            draggable={false}
          />
        </motion.div>
      </AnimatePresence>

      {/* Prev / Next arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/25 flex items-center justify-center transition"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/25 flex items-center justify-center transition"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={cn(
                'rounded-full transition-all',
                i === idx ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/60'
              )}
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const prefersReducedMotion = useReducedMotion()

  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [variantsError, setVariantsError] = useState(false)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const cartItems = useCartStore((s) => s.items)

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [primaryIndex, setPrimaryIndex] = useState(0)
  const [added, setAdded] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [stockFeedback, setStockFeedback] = useState<string | null>(null)
  const [descExpanded, setDescExpanded] = useState(false)
  const [descHasOverflow, setDescHasOverflow] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [flyingSnacks, setFlyingSnacks] = useState<FlyingSnack[]>([])
  const desktopDescRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/products?slug=${encodeURIComponent(slug)}`)
        const json = await res.json()
        const products: Product[] = json.data?.products ?? []
        const found = products[0]
        if (!found) { setLoading(false); return }

        setProduct(found)
        setPrimaryIndex(found.primary_image_index ?? 0)

        if (found.has_variants) {
          try {
            const vRes = await fetch(`/api/products/${found.id}/variants`)
            const vJson = await vRes.json()
            if (!vRes.ok || !Array.isArray(vJson.data)) {
              setVariantsError(true)
            } else {
              setVariants(vJson.data)
            }
          } catch {
            setVariantsError(true)
          }
        }

        const relRes = await fetch(`/api/products?category=${found.category}&status=active`)
        const relJson = await relRes.json()
        setRelated((relJson.data?.products ?? []).filter((p: Product) => p.id !== found.id).slice(0, 4))
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  useEffect(() => {
    if (loading || !product) {
      setDescHasOverflow(false)
      return
    }
    const el = desktopDescRef.current
    if (!el) {
      setDescHasOverflow(false)
      return
    }
    const checkOverflow = () => {
      setDescHasOverflow(el.scrollHeight > DESKTOP_DESCRIPTION_COLLAPSED_HEIGHT + 1)
    }
    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [loading, product, descExpanded])

  const allImages = useMemo(() => {
    const base = product?.images ?? []
    const variantImages = variants.map((v) => v.image).filter(Boolean) as string[]
    // Preserve order: base images first, then unique variant images
    const unique = [...base]
    for (const img of variantImages) {
      if (!unique.includes(img)) unique.push(img)
    }
    return unique
  }, [product?.images, variants])

  useEffect(() => {
    if (selectedVariant?.image) {
      const idx = allImages.indexOf(selectedVariant.image)
      if (idx !== -1) {
        setPrimaryIndex(idx)
      }
    }
  }, [selectedVariant, allImages])

  if (loading) {
    return (
      <Container className="py-16 flex justify-center">
        <SnackWaitAnimation stage="loading" />
      </Container>
    )
  }

  if (!product) {
    return (
      <Container className="py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Producto no encontrado</h1>
        <Link href="/menu" className="text-nurei-cta font-bold hover:underline">Volver al menu</Link>
      </Container>
    )
  }

  const fav = isFavorite(product.id)
  const activePrice = selectedVariant?.price ?? product.base_price ?? product.price
  const activeComparePrice = selectedVariant?.compare_at_price ?? product.compare_at_price
  const activeImage = selectedVariant?.image || allImages[primaryIndex] || null

  const discountPercent = activeComparePrice && activeComparePrice > activePrice
    ? Math.round((1 - activePrice / activeComparePrice) * 100) : 0

  const activeVariants = variants.filter((v) => v.status === 'active')
  const needsVariantSelection = product.has_variants && activeVariants.length > 0 && !selectedVariant
  const canAddToCart = !needsVariantSelection && product.stock_status !== 'out_of_stock'

  const openLightbox = (i: number) => {
    if (allImages.length === 0) return
    setLightboxIndex(i)
    setLightboxOpen(true)
  }

  const launchSnackTrail = (sourceEl: HTMLButtonElement) => {
    if (prefersReducedMotion) return
    if (typeof window === 'undefined') return

    const cartTarget = document.querySelector<HTMLElement>('[data-cart-target="true"]')
    if (!cartTarget) return

    const sourceRect = sourceEl.getBoundingClientRect()
    const targetRect = cartTarget.getBoundingClientRect()

    const nextId = Date.now() + Math.floor(Math.random() * 1000)
    setFlyingSnacks((current) => [
      ...current,
      {
        id: nextId,
        icon: getCategoryEmoji(product.category),
        qty: quantity,
        start: {
          x: sourceRect.left + sourceRect.width / 2,
          y: sourceRect.top + sourceRect.height / 2,
        },
        end: {
          x: targetRect.left + targetRect.width / 2,
          y: targetRect.top + targetRect.height / 2,
        },
        styles: getCategoryFlightStyles(product.category),
      },
    ])
  }

  const handleAdd = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!canAddToCart) {
      toast.error('Selecciona una variante primero')
      return
    }
    // Compute per-variant cart quantity at call time (not stale closure)
    const currentCartQuantity = cartItems
      .filter((item) => item.product.id === product.id && (item.variant_id ?? null) === (selectedVariant?.id ?? null))
      .reduce((sum, item) => sum + item.quantity, 0)

    try {
      const stockBody: Record<string, unknown> = { quantity, currentCartQuantity }
      if (selectedVariant) stockBody.variant_id = selectedVariant.id
      const response = await fetch(`/api/products/${product.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stockBody),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.can_add) {
        const message = payload?.message ?? 'Sin stock suficiente en este momento.'
        setStockFeedback(message)
        toast.error(message)
        return
      }
      setStockFeedback(null)
      const variantPayload = selectedVariant ? {
        id: selectedVariant.id,
        name: selectedVariant.name,
        image: selectedVariant.image,
        price: selectedVariant.price,
      } : null
      for (let i = 0; i < quantity; i++) addItem(product, variantPayload)
      setAdded(true)
      launchSnackTrail(event.currentTarget)
      toast.success(`${quantity}x ${product.name}${selectedVariant ? ` - ${selectedVariant.name}` : ''} agregado`)
      setTimeout(() => setAdded(false), 1400)
    } catch {
      const message = 'No se pudo validar inventario en este momento.'
      setStockFeedback(message)
      toast.error(message)
    }
  }

  const handleToggleFavorite = () => {
    toggleFavorite(product.id)
    toast.success(fav ? 'Eliminado de favoritos' : 'Agregado a favoritos', { icon: fav ? '💔' : '❤️' })
  }

  const variantGroups = new Map<string, Set<string>>()
  for (const v of variants) {
    for (const [key, value] of Object.entries(v.attributes)) {
      if (!variantGroups.has(key)) variantGroups.set(key, new Set())
      variantGroups.get(key)!.add(value)
    }
  }

  // ── Shared Add-to-Cart controls ──
  const AddToCartControls = ({ className }: { className?: string }) => (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white">
        <button
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 font-bold text-base"
        >-</button>
        <span className="w-9 h-9 flex items-center justify-center text-sm font-bold text-gray-900 border-x border-gray-200">
          {quantity}
        </span>
        <button
          onClick={() => setQuantity(quantity + 1)}
          className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 font-bold text-base"
        >+</button>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleAdd}
        disabled={!canAddToCart || (selectedVariant?.stock === 0)}
        animate={added ? { scale: [1, 1.03, 1], y: [0, -1, 0] } : { scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all duration-300 text-sm',
          added ? 'bg-green-500 text-white shadow-lg shadow-green-500/25' :
          !canAddToCart ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
          'bg-nurei-cta text-gray-900 shadow-lg shadow-nurei-cta/25 hover:shadow-xl'
        )}
      >
        {added ? (
          <><Check className="w-4 h-4" /> Agregado</>
        ) : product.stock_status === 'out_of_stock' ? (
          'Sin stock'
        ) : needsVariantSelection ? (
          'Elige una variante'
        ) : (
          <><ShoppingBag className="w-4 h-4" /> Agregar al carrito</>
        )}
      </motion.button>
    </div>
  )

  return (
    <>
      {/* ── Main content ── */}
      <div className="pb-20 sm:pb-0">

        {/* ── Image section — full bleed on mobile ── */}
        <div className="sm:hidden">
          <motion.div
            className="relative w-full aspect-square bg-gray-100 overflow-hidden"
            drag={allImages.length > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) setPrimaryIndex((p) => (p + 1) % allImages.length)
              else if (info.offset.x > 60) setPrimaryIndex((p) => (p - 1 + allImages.length) % allImages.length)
            }}
          >
            {/* Image */}
            <AnimatePresence mode="wait">
              {activeImage ? (
                <motion.img
                  key={activeImage}
                  src={activeImage}
                  alt={product.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => openLightbox(primaryIndex)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <span className="text-[80px] select-none opacity-30">{getCategoryEmoji(product.category)}</span>
                </div>
              )}
            </AnimatePresence>

            {/* Back button — overlaid top-left */}
            <button
              onClick={() => router.back()}
              className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-black/30 backdrop-blur-sm text-white rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver
            </button>

            {/* Fav + zoom — top-right */}
            <div className="absolute top-3 right-3 z-10 flex gap-2">
              {allImages.length > 0 && (
                <button
                  onClick={() => openLightbox(primaryIndex)}
                  className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              )}
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={handleToggleFavorite}
                className={cn(
                  'p-2 rounded-full backdrop-blur-sm',
                  fav ? 'bg-red-500 text-white' : 'bg-black/30 text-white'
                )}
              >
                <Heart className="w-4 h-4" fill={fav ? 'currentColor' : 'none'} />
              </motion.button>
            </div>

            {/* Badges */}
            <div className="absolute top-14 left-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5 sm:top-3 sm:left-16">
              {product.is_limited && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-nurei-promo text-white rounded-full">Ltd</span>
              )}
              {discountPercent > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-red-500 text-white rounded-full shadow-lg">-{discountPercent}%</span>
              )}
              {product.is_featured && !discountPercent && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-nurei-cta text-gray-900 rounded-full">Popular</span>
              )}
            </div>

            {/* Arrows for multiple images */}
            {allImages.length > 1 && (
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 pointer-events-none">
                <button
                  onClick={() => {
                    const nextIdx = (primaryIndex - 1 + allImages.length) % allImages.length
                    setPrimaryIndex(nextIdx)
                    const v = variants.find(v => v.image === allImages[nextIdx])
                    if (v) setSelectedVariant(v)
                    else setSelectedVariant(null)
                  }}
                  className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center pointer-events-auto"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const nextIdx = (primaryIndex + 1) % allImages.length
                    setPrimaryIndex(nextIdx)
                    const v = variants.find(v => v.image === allImages[nextIdx])
                    if (v) setSelectedVariant(v)
                    else setSelectedVariant(null)
                  }}
                  className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center pointer-events-auto"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Dot indicators — bottom-center */}
            {allImages.length > 1 && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-1.5">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setPrimaryIndex(i)
                      const v = variants.find(v => v.image === allImages[i])
                      if (v) setSelectedVariant(v)
                      else setSelectedVariant(null)
                    }}
                    className={cn(
                      'rounded-full transition-all',
                      i === primaryIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'
                    )}
                  />
                ))}
              </div>
            )}

            {/* Share buttons — image bottom-right */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copiado') }}
                className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Mira ${product.name} en nurei ${typeof window !== 'undefined' ? window.location.href : ''}`)}`}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl bg-black/30 backdrop-blur-sm text-white"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            </div>

            {/* Out of stock overlay */}
            {product.stock_status === 'out_of_stock' && (
              <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
                <span className="text-sm font-bold text-white bg-gray-900/60 px-4 py-2 rounded-full uppercase tracking-wide">Agotado</span>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Info section (mobile) ── */}
        <div className="sm:hidden px-4 pt-2.5 pb-3 space-y-2">
          {/* Meta row */}
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 flex-wrap">
            {product.brand && <><span className="uppercase font-bold tracking-wide">{product.brand}</span><span>·</span></>}
            <span className="uppercase font-bold tracking-wide">
              {countryToFlag(product.origin_country ?? product.origin ?? '')}{' '}
              {product.origin_country ?? product.origin}
            </span>
          </div>

          {/* Title — compact, try to fit one line */}
          <h1 className="text-sm font-black text-gray-900 leading-tight tracking-tight line-clamp-2">{product.name}</h1>

              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Descripción</p>
              {/* Description — gradient fade collapse, no explicit button */}
          {product.description && (
            <div
              className="relative cursor-pointer"
              onClick={() => descHasOverflow && setDescExpanded(!descExpanded)}
            >
              <div
                className="text-[11px] text-gray-500 leading-relaxed overflow-hidden transition-all duration-300 prose prose-xs max-w-none [&_p]:mb-1 [&_ul]:pl-4 [&_ol]:pl-4 [&_strong]:font-bold [&_em]:italic"
                style={!descExpanded && descHasOverflow ? { maxHeight: '54px' } : undefined}
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
              {!descExpanded && descHasOverflow && (
                <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-white via-white/70 to-transparent pointer-events-none" />
              )}
            </div>
          )}

          <div className="space-y-1 pt-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Presentación</p>
            <p className="text-[11px] font-semibold text-gray-800 tabular-nums">{formatProductPresentation(product)}</p>
          </div>

          {/* Spice level */}
          {product.spice_level > 0 && (
            <div className="flex items-center gap-1.5">
              <Flame className="w-3 h-3 text-nurei-promo" />
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={cn('w-1.5 h-1.5 rounded-full', i < product.spice_level ? 'bg-nurei-promo' : 'bg-gray-200')} />
                ))}
              </div>
              <span className="text-[10px] font-bold text-nurei-promo italic">{SPICE_LABELS[product.spice_level]}</span>
            </div>
          )}

          {/* Tags */}
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Etiquetas</p>
          {product.tags && product.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {product.tags.map((tag, idx) => (
                <span key={`${tag}-${idx}`} className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded-full">
                  {cleanTagLabel(tag)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400">Sin etiquetas</p>
          )}

          {/* Variants */}
          {product.has_variants && (
            variantsError ? (
              <p className="text-[11px] text-red-500">No se pudieron cargar las opciones. Recarga la página.</p>
            ) : activeVariants.length > 0 ? (
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Opción {needsVariantSelection && <span className="text-red-500">*</span>}
                </p>
                <div className="flex flex-wrap gap-1">
                  {activeVariants.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(selectedVariant?.id === v.id ? null : v)}
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold border-2 transition-all',
                        selectedVariant?.id === v.id
                          ? 'border-nurei-cta bg-nurei-cta/10 text-gray-900'
                          : 'border-gray-200 text-gray-600'
                      )}
                    >
                      {v.image && (
                        <div className="w-5 h-5 rounded-md overflow-hidden flex-shrink-0 border border-gray-100">
                          <img src={v.image} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <span>{v.name}</span>
                      {v.price !== (product.base_price ?? product.price) && (
                        <span className="ml-1 text-[10px] text-gray-400">{formatPrice(v.price)}</span>
                      )}
                      {v.stock <= 3 && v.stock > 0 && (
                        <span className="ml-1 text-[9px] text-orange-500 font-bold">Últimas {v.stock}</span>
                      )}
                      {v.stock === 0 && <span className="ml-1 text-[9px] text-red-500 font-bold">Agotado</span>}
                    </button>
                  ))}
                </div>
              </div>
            ) : null
          )}

          {/* Stock availability */}
          <div className="flex items-center gap-1.5">
            <span className={cn(
              'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0',
              product.stock_status === 'out_of_stock' ? 'bg-red-500' :
              product.stock_status === 'low_stock' ? 'bg-orange-400' : 'bg-emerald-500'
            )} />
            <span className="text-[11px] font-semibold text-gray-500">
              {product.stock_status === 'out_of_stock'
                ? 'Sin stock'
                : product.stock_status === 'low_stock'
                ? <span className="text-orange-500 font-bold">¡Últimas unidades!</span>
                : 'Disponible'}
            </span>
          </div>

          {stockFeedback && <p className="text-[11px] text-red-600">{stockFeedback}</p>}
        </div>

        {/* ── Related products (mobile) ── */}
        {related.length > 0 && (
          <div className="sm:hidden px-4 pt-1 pb-4">
            <div className="border-t border-gray-100 pt-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">También te puede gustar</p>
              <div className="grid grid-cols-2 gap-2">
                {related.map((p) => {
                  const thumb = p.images?.[p.primary_image_index] ?? p.image_thumbnail_url
                  const rPrice = p.base_price ?? p.price
                  const rCompare = p.compare_at_price
                  const rDiscount = rCompare && rCompare > rPrice ? Math.round((1 - rPrice / rCompare) * 100) : 0
                  return (
                    <Link
                      key={p.id}
                      href={`/producto/${p.slug}`}
                      className="group flex flex-col rounded-2xl border border-gray-100 bg-white overflow-hidden active:scale-[0.98] transition-transform"
                    >
                      <div className="relative aspect-square bg-gray-50 overflow-hidden">
                        {thumb ? (
                          <img src={thumb} alt={p.name} className="w-full h-full object-cover group-active:opacity-90 transition-opacity" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">
                            {getCategoryEmoji(p.category)}
                          </div>
                        )}
                        {rDiscount > 0 && (
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded-full">-{rDiscount}%</span>
                        )}
                        {p.is_limited && (
                          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-nurei-promo text-white rounded-full">Ltd</span>
                        )}
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="text-[11px] font-bold text-gray-900 leading-tight line-clamp-2">{p.name}</p>
                        <div className="flex items-baseline gap-1 mt-1 flex-wrap">
                          {rCompare && rCompare > rPrice && (
                            <span className="text-[10px] text-gray-300 line-through tabular-nums">{formatPrice(rCompare)}</span>
                          )}
                          <span className="text-xs font-black text-gray-900 tabular-nums">{formatPrice(rPrice)}</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Desktop layout ── */}
        <Container className="hidden sm:block py-4">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-3 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
            {/* Image area */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4">
              <motion.div
                className="relative aspect-square bg-gray-50 rounded-3xl flex items-center justify-center overflow-hidden cursor-zoom-in"
                drag={allImages.length > 1 ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.12}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) {
                    const nextIdx = (primaryIndex + 1) % allImages.length
                    setPrimaryIndex(nextIdx)
                    const v = variants.find((v) => v.image === allImages[nextIdx])
                    if (v) setSelectedVariant(v)
                    else setSelectedVariant(null)
                  } else if (info.offset.x > 60) {
                    const nextIdx = (primaryIndex - 1 + allImages.length) % allImages.length
                    setPrimaryIndex(nextIdx)
                    const v = variants.find((v) => v.image === allImages[nextIdx])
                    if (v) setSelectedVariant(v)
                    else setSelectedVariant(null)
                  }
                }}
                onClick={() => openLightbox(primaryIndex)}
              >
                <AnimatePresence mode="wait">
                  {activeImage ? (
                    <motion.img
                      key={activeImage}
                      src={activeImage}
                      alt={product.name}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <motion.span key="emoji" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[160px] select-none">
                      {getCategoryEmoji(product.category)}
                    </motion.span>
                  )}
                </AnimatePresence>

                {allImages.length > 1 && (
                  <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                    <button onClick={(e) => {
                      e.stopPropagation()
                      const nextIdx = (primaryIndex - 1 + allImages.length) % allImages.length
                      setPrimaryIndex(nextIdx)
                      const v = variants.find(v => v.image === allImages[nextIdx])
                      if (v) setSelectedVariant(v)
                      else setSelectedVariant(null)
                    }} className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md shadow-lg flex items-center justify-center pointer-events-auto hover:bg-white">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={(e) => {
                      e.stopPropagation()
                      const nextIdx = (primaryIndex + 1) % allImages.length
                      setPrimaryIndex(nextIdx)
                      const v = variants.find(v => v.image === allImages[nextIdx])
                      if (v) setSelectedVariant(v)
                      else setSelectedVariant(null)
                    }} className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md shadow-lg flex items-center justify-center pointer-events-auto hover:bg-white">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {/* Dot indicators desktop */}
                {allImages.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {allImages.map((_, i) => (
                      <button key={i} onClick={(e) => {
                        e.stopPropagation()
                        setPrimaryIndex(i)
                        const v = variants.find(v => v.image === allImages[i])
                        if (v) setSelectedVariant(v)
                        else setSelectedVariant(null)
                      }}
                        className={cn('rounded-full transition-all', i === primaryIndex ? 'w-5 h-2 bg-white shadow' : 'w-2 h-2 bg-white/50 hover:bg-white/80')}
                      />
                    ))}
                  </div>
                )}

                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {product.is_limited && <span className="px-3 py-1.5 text-xs font-bold uppercase bg-nurei-promo text-white rounded-full">Limitado</span>}
                  {discountPercent > 0 && <span className="px-3 py-1.5 text-xs font-black uppercase bg-red-500 text-white rounded-full">-{discountPercent}%</span>}
                  {product.is_featured && <span className="px-3 py-1.5 text-xs font-bold uppercase bg-nurei-cta text-gray-900 rounded-full">Popular</span>}
                </div>

                <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => { e.stopPropagation(); handleToggleFavorite() }}
                  className={cn('absolute top-4 right-4 p-3 rounded-full shadow-lg transition-colors', fav ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-400 hover:text-red-400')}>
                  <Heart className="w-5 h-5" fill={fav ? 'currentColor' : 'none'} />
                </motion.button>
              </motion.div>

              {allImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-none">
                  {allImages.map((img, idx) => (
                    <button key={idx} onClick={() => {
                      setPrimaryIndex(idx)
                      const v = variants.find(v => v.image === allImages[idx])
                      if (v) setSelectedVariant(v)
                      else setSelectedVariant(null)
                    }}
                      className={cn('relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all',
                        idx === primaryIndex ? 'border-nurei-cta shadow-md scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                      )}>
                      <Image src={img} alt="" width={56} height={56} unoptimized className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Product info — desktop */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
              <h1 className="text-2xl font-black text-gray-900 leading-tight mb-1.5">{product.name}</h1>

              {/* Marca + origin in same line */}
              {(product.brand || product.origin_country || product.origin) && (
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {product.brand && (
                    <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700 rounded-full">{product.brand}</span>
                  )}
                  {(product.origin_country || product.origin) && (
                    <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700 rounded-full">
                      {countryToFlag(product.origin_country ?? product.origin ?? '')}{' '}
                      {product.origin_country ?? product.origin}
                    </span>
                  )}
                </div>
              )}

              {product.description && (
                <div className="mb-2.5">
                  <div className="relative">
                    <div
                      ref={desktopDescRef}
                      className="text-[13px] text-gray-500 leading-relaxed prose prose-xs max-w-none [&_p]:mb-1 [&_ul]:pl-4 [&_ol]:pl-4 [&_strong]:font-bold [&_em]:italic"
                      style={!descExpanded ? { maxHeight: `${DESKTOP_DESCRIPTION_COLLAPSED_HEIGHT}px`, overflow: 'hidden' } : undefined}
                      dangerouslySetInnerHTML={{ __html: product.description }}
                    />
                    {!descExpanded && descHasOverflow && (
                      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
                    )}
                  </div>
                  {descHasOverflow && (
                    <button type="button" onClick={() => setDescExpanded((v) => !v)} className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-primary-cyan">
                      {descExpanded ? <><ChevronUp className="w-3 h-3" /> Ver menos</> : <><ChevronDown className="w-3 h-3" /> Ver más</>}
                    </button>
                  )}
                </div>
              )}

              {/* Presentación + Etiquetas in 2-col row */}
              <div className="grid grid-cols-2 gap-3 mb-2.5">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Presentación</p>
                  <p className="text-xs font-semibold text-gray-800 tabular-nums">{formatProductPresentation(product)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Etiquetas</p>
                  {product.tags && product.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {product.tags.map((tag, idx) => (
                        <span key={`${tag}-${idx}`} className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded-full">
                          {cleanTagLabel(tag)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400">—</p>
                  )}
                </div>
              </div>

              {product.spice_level > 0 && (
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Flame className="w-3.5 h-3.5 text-nurei-promo" />
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={cn('w-2 h-2 rounded-full', i < product.spice_level ? 'bg-nurei-promo' : 'bg-gray-200')} />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-nurei-promo italic">{SPICE_LABELS[product.spice_level]}</span>
                </div>
              )}

              <div className="flex items-baseline gap-2.5 mb-2">
                {activeComparePrice && activeComparePrice > activePrice && (
                  <span className="text-base text-gray-300 line-through font-bold tabular-nums">{formatPrice(activeComparePrice)}</span>
                )}
                <span className="text-3xl font-black text-gray-900 tabular-nums">{formatPrice(activePrice)}</span>
                {discountPercent > 0 && (
                  <span className="text-xs font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-lg">-{discountPercent}%</span>
                )}
              </div>

              {/* Stock badge */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                {product.stock_status === 'out_of_stock' && (
                  <span className="px-2 py-0.5 text-[11px] font-bold text-red-600 bg-red-50 rounded-full">Sin stock</span>
                )}
                {product.stock_status === 'low_stock' && (
                  <span className="px-2 py-0.5 text-[11px] font-bold text-orange-600 bg-orange-50 rounded-full">¡Últimas {product.stock_quantity} uds!</span>
                )}
                {product.stock_status !== 'out_of_stock' && product.stock_status !== 'low_stock' && (
                  <span className="text-[11px] text-emerald-600 font-semibold">
                    ✓ {product.stock_quantity} disponibles
                  </span>
                )}
              </div>

              {product.has_variants && (
                variantsError ? (
                  <p className="mb-2.5 text-xs text-red-500">No se pudieron cargar las opciones. Recarga la página.</p>
                ) : activeVariants.length > 0 ? (
                  <div className="mb-2.5 space-y-1.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      Opción {needsVariantSelection && <span className="text-red-500">*</span>}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {activeVariants.map(v => (
                        <button key={v.id} onClick={() => setSelectedVariant(selectedVariant?.id === v.id ? null : v)}
                          className={cn('flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all',
                            selectedVariant?.id === v.id ? 'border-nurei-cta bg-nurei-cta/10 text-gray-900 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                          )}>
                          {v.image && (
                            <div className="w-5 h-5 rounded-md overflow-hidden flex-shrink-0 border border-gray-100">
                              <img src={v.image} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <span className="font-bold">{v.name}</span>
                          {v.price !== (product.base_price ?? product.price) && <span className="text-[10px] text-gray-400">{formatPrice(v.price)}</span>}
                          {v.stock <= 3 && v.stock > 0 && <span className="text-[9px] text-orange-500 font-bold">Últimas {v.stock}</span>}
                          {v.stock === 0 && <span className="text-[9px] text-red-500 font-bold">Agotado</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null
              )}

              <AddToCartControls className="mb-2.5" />
              {stockFeedback && <p className="text-xs text-red-600 mb-2">{stockFeedback}</p>}

              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Compartir</p>
                <ShareButtons name={product.name} slug={product.slug} />
              </div>
            </motion.div>
          </div>

          {related.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-black text-gray-900 mb-4">También te puede gustar</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                {related.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            </div>
          )}
        </Container>
      </div>

      {/* ── Mobile sticky bottom bar — price + qty + add in one row ── */}
      <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-white border-t border-gray-100 shadow-xl">
        <div className="flex items-center gap-2 px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
          {/* Price block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              {activeComparePrice && activeComparePrice > activePrice && (
                <span className="text-[11px] text-gray-300 line-through tabular-nums leading-none">{formatPrice(activeComparePrice)}</span>
              )}
              <span className="text-base font-black text-gray-900 tabular-nums leading-none">{formatPrice(activePrice)}</span>
              {discountPercent > 0 && (
                <span className="text-[10px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded leading-none">-{discountPercent}%</span>
              )}
            </div>
          </div>

          {/* Qty stepper */}
          <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden shrink-0">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 font-bold text-base"
            >−</button>
            <span className="w-7 h-9 flex items-center justify-center text-sm font-bold text-gray-900 border-x border-gray-200 tabular-nums">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 font-bold text-base"
            >+</button>
          </div>

          {/* Add to cart */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleAdd}
            disabled={!canAddToCart}
            animate={added ? { scale: [1, 1.03, 1], y: [0, -1, 0] } : { scale: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className={cn(
              'flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl font-bold text-sm transition-all duration-300 shrink-0',
              added ? 'bg-green-500 text-white' :
              !canAddToCart ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
              'bg-nurei-cta text-gray-900 shadow-md shadow-nurei-cta/25'
            )}
          >
            {added ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
            <span>{added ? 'Listo' : needsVariantSelection ? 'Elegir' : 'Agregar'}</span>
          </motion.button>
        </div>
      </div>

      <FlyingSnackTrail
        items={flyingSnacks}
        onDone={(id) => setFlyingSnacks((current) => current.filter((item) => item.id !== id))}
      />

      {/* ── Image lightbox ── */}
      <AnimatePresence>
        {lightboxOpen && allImages.length > 0 && (
          <ImageLightbox
            images={allImages}
            startIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
