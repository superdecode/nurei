'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Plus, Heart, Ban, Flame, ChevronRight, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useCartStore } from '@/lib/stores/cart'
import { useFavoritesStore } from '@/lib/stores/favorites'
import { formatPrice, stripHtml } from '@/lib/utils/format'
import { countryToFlag } from '@/lib/utils/country-flag'
import { formatProductPresentation } from '@/lib/utils/product-presentation'
import { SPICE_LABELS } from '@/lib/utils/constants'
import type { Product } from '@/types'

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-gray-900 rounded-sm not-italic">{part}</mark>
        ) : part
      )}
    </>
  )
}

interface ProductCardProps {
  product: Product
  searchQuery?: string
  compact?: boolean
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    crunchy: '🍜', spicy: '🌶️', limited_edition: '🍵', drinks: '🥤',
    snacks: '🍿', ramen: '🍜', dulces: '🍬', salsas: '🫙',
  }
  return map[category] || '🍜'
}

function SpiceDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i < level ? 'bg-nurei-promo' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  )
}

interface ImageCarouselProps {
  images: string[]
  primaryIndex: number
  isHovered: boolean
  onSwipeDetected: () => void
}

function ImageCarousel({ images, primaryIndex, isHovered, onSwipeDetected }: ImageCarouselProps) {
  const [idx, setIdx] = useState(primaryIndex)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const touchStartX = useRef<number | null>(null)
  const mouseStartX = useRef<number | null>(null)
  const didDrag = useRef(false)

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length)
  const next = () => setIdx((i) => (i + 1) % images.length)

  // Start auto-advance when card is hovered
  useEffect(() => {
    if (images.length <= 1) return
    if (isHovered) {
      intervalRef.current = setInterval(() => {
        setIdx((i) => (i + 1) % images.length)
      }, 1560)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isHovered, images.length])

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    didDrag.current = false
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current !== null && Math.abs(e.touches[0].clientX - touchStartX.current) > 8) {
      didDrag.current = true
    }
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 35) {
      onSwipeDetected()
      delta < 0 ? next() : prev()
    }
    touchStartX.current = null
  }

  // Mouse drag swipe (desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseStartX.current = e.clientX
    didDrag.current = false
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (mouseStartX.current !== null && Math.abs(e.clientX - mouseStartX.current) > 8) {
      didDrag.current = true
    }
  }
  const handleMouseUp = (e: React.MouseEvent) => {
    if (mouseStartX.current === null) return
    const delta = e.clientX - mouseStartX.current
    if (didDrag.current && Math.abs(delta) > 35) {
      e.preventDefault()
      onSwipeDetected()
      delta < 0 ? next() : prev()
    }
    mouseStartX.current = null
    didDrag.current = false
  }

  return (
    <div
      className="relative w-full h-full select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ touchAction: 'pan-y' }}
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={idx}
          src={images[idx]}
          alt=""
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      </AnimatePresence>

      {/* Arrow buttons — visible on hover */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); prev() }}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm z-10"
            aria-label="Imagen anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); next() }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm z-10"
            aria-label="Imagen siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none z-10">
          {images.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === idx ? 'w-3 h-1.5 bg-white shadow-sm' : 'w-1.5 h-1.5 bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const SPRING_SNAP = { type: 'spring', stiffness: 400, damping: 20 } as const
const SPRING_SMOOTH = { type: 'spring', stiffness: 300, damping: 28 } as const

export function ProductCard({ product, searchQuery = '', compact = false }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem)
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const [added, setAdded] = useState(false)
  const [stockFeedback, setStockFeedback] = useState<string | null>(null)
  const [isCardHovered, setIsCardHovered] = useState(false)
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number | null>(null)
  const [variantOffset, setVariantOffset] = useState(0)
  const swipedRef = useRef(false)
  const fav = isFavorite(product.id)

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (product.has_variants && !selectedVariant) {
      const message = 'Escoge una variante primero'
      setStockFeedback(message)
      toast.error(message)
      return
    }
    try {
      const stockBody: Record<string, unknown> = { quantity: 1, currentCartQuantity }
      if (selectedVariant) stockBody.variant_id = selectedVariant.id
      const response = await fetch(`/api/products/${product.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stockBody),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.can_add) {
        const message = payload?.message ?? 'No hay stock suficiente por ahora.'
        setStockFeedback(message)
        toast.error(message)
        return
      }
      setStockFeedback(null)
      addItem(product, selectedVariant ? {
        id: selectedVariant.id,
        name: selectedVariant.name,
        image: selectedVariant.image,
        price: selectedVariant.price,
      } : null)
      setAdded(true)
      toast.success(`${product.name}${selectedVariant ? ` - ${selectedVariant.name}` : ''} agregado`, { icon: '🍜', duration: 2000 })
      setTimeout(() => setAdded(false), 1400)
    } catch {
      const message = 'No se pudo validar inventario en este momento.'
      setStockFeedback(message)
      toast.error(message)
    }
  }

  const handleToggleFav = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleFavorite(product.id)
    toast.success(fav ? 'Eliminado de favoritos' : 'Agregado a favoritos', {
      icon: fav ? '💔' : '❤️',
      duration: 1500,
    })
  }

  // All active variants are selectable; image thumbnails come from those that have images
  const activeVariants = product.has_variants && product.variants
    ? product.variants.filter((v) => v.status === 'active')
    : []
  const clickableVariants = activeVariants.filter((v) => v.image)
  // selectedVariantIdx always indexes into activeVariants
  const selectedVariant = selectedVariantIdx !== null ? activeVariants[selectedVariantIdx] ?? null : null
  const currentCartQuantity = useCartStore((s) =>
    s.items
      .filter((item) => item.product.id === product.id && (item.variant_id ?? null) === (selectedVariant?.id ?? null))
      .reduce((sum, item) => sum + item.quantity, 0)
  )

  const isOutOfStock = product.stock_status === 'out_of_stock'
  const isLowStock = product.stock_status === 'low_stock'
  const variantIsOOS = (v: { stock?: number | null }) =>
    product.track_inventory !== false && !product.allow_backorder && (v.stock ?? 0) <= 0
  const basePrice = product.base_price ?? product.price
  const price = selectedVariant ? selectedVariant.price : basePrice
  const discountPercent = product.compare_at_price && product.compare_at_price > price
    ? Math.round((1 - price / product.compare_at_price) * 100) : 0

  // When variants exist use their images for the carousel; fall back to product images
  const carouselImages: string[] = product.has_variants && product.variant_images && product.variant_images.length > 0
    ? product.variant_images
    : (product.images ?? [])

  const hasImages = carouselImages.length > 0 || !!selectedVariant?.image
  const primaryImage = selectedVariant?.image ?? (hasImages ? carouselImages[0] : null)
  const hasMultipleImages = !selectedVariant && carouselImages.length > 1

  // Circular variant thumbnails — come from clickableVariants when available, else carouselImages
  const variantThumbs: string[] = clickableVariants.length > 0
    ? clickableVariants.map((v) => v.image as string)
    : product.has_variants
      ? carouselImages
      : []
  const needsVariantSelection = product.has_variants && activeVariants.length > 0 && !selectedVariant

  return (
    <Link
      href={`/producto/${product.slug}`}
      onClick={(e) => {
        if (swipedRef.current) {
          e.preventDefault()
          swipedRef.current = false
        }
      }}
    >
      <motion.div
        layout
        transition={SPRING_SMOOTH}
        whileHover={isOutOfStock ? {} : { y: -3, transition: SPRING_SMOOTH }}
        onHoverStart={() => setIsCardHovered(true)}
        onHoverEnd={() => setIsCardHovered(false)}
        className={`card-product group overflow-hidden flex flex-col ${
          isOutOfStock ? 'ring-1 ring-amber-200/80' : ''
        }`}
      >
        {/* ── Image area ── */}
        <div className="relative aspect-square bg-gray-50 flex items-center justify-center overflow-hidden rounded-t-[1.25rem]">
          {hasImages && primaryImage ? (
            selectedVariant ? (
              <motion.img
                key={selectedVariant.id}
                src={selectedVariant.image!}
                alt={selectedVariant.name}
                className="w-full h-full object-cover"
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
              />
            ) : hasMultipleImages ? (
              <div className="w-full h-full">
                <ImageCarousel
                  images={carouselImages}
                  primaryIndex={0}
                  isHovered={isCardHovered}
                  onSwipeDetected={() => { swipedRef.current = true }}
                />
              </div>
            ) : (
              <motion.img
                src={primaryImage}
                alt={product.name}
                className={`w-full h-full object-cover transition-transform duration-700 ease-out ${
                  isOutOfStock ? '' : 'group-hover:scale-110'
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              />
            )
          ) : (
            <motion.span
              className="text-5xl sm:text-6xl select-none opacity-40"
              whileHover={isOutOfStock ? {} : { scale: 1.2, rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.5 }}
            >
              {getCategoryEmoji(product.category)}
            </motion.span>
          )}

          {/* Out of stock overlay */}
          {isOutOfStock && (
            <>
              <div className="absolute inset-0 bg-[#FFF3CE]/65" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FFF3CE] border border-amber-300/80 text-amber-800 text-[11px] font-bold uppercase tracking-widest shadow-sm">
                  <Ban className="w-3 h-3 shrink-0" />
                  Agotado
                </span>
              </div>
            </>
          )}

          {/* Badges */}
          {!isOutOfStock && (
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {/* Circular variant image thumbnails — clickable */}
              {product.has_variants && (activeVariants.length > 0 || variantThumbs.length > 0) && (() => {
                // Map a clickableVariants index → activeVariants index for correct selection
                const thumbToActiveIdx = (thumbIdx: number) =>
                  activeVariants.findIndex(v => v.id === clickableVariants[thumbIdx]?.id)

                if (variantThumbs.length === 0) return null

                const total = variantThumbs.length
                if (total <= 4) {
                  return (
                    <div className="flex gap-1.5">
                      {variantThumbs.map((img, i) => {
                        const activeIdx = thumbToActiveIdx(i)
                        const oos = variantIsOOS(clickableVariants[i])
                        return (
                          <motion.button
                            key={i}
                            type="button"
                            whileTap={oos ? {} : { scale: 0.88 }}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!oos) setSelectedVariantIdx(selectedVariantIdx === activeIdx ? null : activeIdx) }}
                            className={`w-7 h-7 rounded-full overflow-hidden border-2 shadow-md bg-gray-100 shrink-0 transition-all duration-150 ${oos ? 'opacity-35 cursor-not-allowed' : ''} ${selectedVariantIdx === activeIdx ? 'border-nurei-cta scale-110 shadow-nurei-cta/40' : 'border-white hover:border-nurei-cta/60'}`}
                          >
                            <img src={img} alt="" className="w-full h-full object-cover" draggable={false} />
                          </motion.button>
                        )
                      })}
                    </div>
                  )
                }
                const hasLeft = variantOffset > 0
                const hasRight = variantOffset + (hasLeft ? 2 : 3) < total
                const fullStart = variantOffset
                const fullCount = hasLeft && hasRight ? 2 : 3
                const fullThumbs = variantThumbs.slice(fullStart, fullStart + fullCount)
                return (
                  <div className="flex gap-1 items-center">
                    {hasLeft && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setVariantOffset(v => v - 1) }}
                        className="w-3.5 h-7 rounded-r-full overflow-hidden border-2 border-white shadow-md bg-gray-100 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <img src={variantThumbs[variantOffset - 1]} alt="" className="w-full h-full object-cover" draggable={false} />
                      </button>
                    )}
                    {fullThumbs.map((img, i) => {
                      const thumbIdx = fullStart + i
                      const activeIdx = thumbToActiveIdx(thumbIdx)
                      const oos = variantIsOOS(clickableVariants[thumbIdx])
                      return (
                        <motion.button
                          key={thumbIdx}
                          type="button"
                          whileTap={oos ? {} : { scale: 0.88 }}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!oos) setSelectedVariantIdx(selectedVariantIdx === activeIdx ? null : activeIdx) }}
                          className={`w-7 h-7 rounded-full overflow-hidden border-2 shadow-md bg-gray-100 shrink-0 transition-all duration-150 ${oos ? 'opacity-35 cursor-not-allowed' : ''} ${selectedVariantIdx === activeIdx ? 'border-nurei-cta scale-110 shadow-nurei-cta/40' : 'border-white hover:border-nurei-cta/60'}`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" draggable={false} />
                        </motion.button>
                      )
                    })}
                    {hasRight && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setVariantOffset(v => v + 1) }}
                        className="w-3.5 h-7 rounded-l-full overflow-hidden border-2 border-white shadow-md bg-gray-100 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <img src={variantThumbs[fullStart + fullCount]} alt="" className="w-7 h-7 object-cover" draggable={false} />
                      </button>
                    )}
                  </div>
                )
              })()}
              {product.is_limited && (
                <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-nurei-promo text-white rounded-full shadow-lg">
                  🕐 Limitado
                </span>
              )}
              {discountPercent > 0 && (
                <span className="px-2.5 py-1 text-[10px] font-black uppercase bg-red-500 text-white rounded-full shadow-lg">
                  -{discountPercent}% Off
                </span>
              )}
              {product.is_featured && (
                <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-nurei-cta text-gray-900 rounded-full shadow-lg">
                  🔥 Popular
                </span>
              )}
              {needsVariantSelection && stockFeedback && (
                <span className="px-2.5 py-1 text-[10px] font-black uppercase bg-red-500 text-white rounded-full shadow-lg">
                  Elige variante
                </span>
              )}
            </div>
          )}

          {/* Favorite button */}
          <motion.button
            whileTap={{ scale: 0.82 }}
            transition={SPRING_SNAP}
            onClick={handleToggleFav}
            className={`absolute top-3 right-3 p-2 rounded-full shadow-sm transition-colors duration-200 ${
              fav ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-400 hover:text-red-400 hover:bg-white'
            }`}
          >
            <Heart className="w-4 h-4" fill={fav ? 'currentColor' : 'none'} />
          </motion.button>


          {/* Bottom row: low stock + country chips */}
          {(isLowStock || product.origin_country || product.origin) && (
            <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
              {isLowStock ? (
                <div className="pointer-events-auto px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-full shadow-sm">
                  <span className="text-[10px] font-bold text-nurei-promo animate-pulse whitespace-nowrap">
                    ¡Últimas unidades!
                  </span>
                </div>
              ) : (
                <span />
              )}
              {(product.origin_country || product.origin) && (
                <span className="hidden sm:inline-flex pointer-events-auto px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-white/40 border border-white/40 text-gray-800 backdrop-blur-sm whitespace-nowrap">
                  {countryToFlag(product.origin_country ?? product.origin ?? '') || ''} {product.origin_country ?? product.origin}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Card body ── */}
        <div className={`${compact ? 'p-2' : 'p-4 sm:px-4 sm:py-3.5'} flex flex-col flex-1 transition-colors duration-300 ${isOutOfStock ? 'bg-amber-50/40' : ''}`}>
          <h3 className={`${compact ? 'text-[11px]' : 'text-[15px]'} font-bold line-clamp-2 leading-snug transition-colors duration-300 ${
            isOutOfStock ? 'text-amber-900/60' : 'text-gray-900 group-hover:text-nurei-cta'
          }`}>
            <HighlightText text={product.name} query={searchQuery} />
          </h3>

          {!compact && product.description && (
            <p className="mt-1.5 text-xs text-gray-400 line-clamp-2 leading-relaxed">
              {stripHtml(product.description)}
            </p>
          )}

          {/* Spice + Weight */}
          {!compact && !isOutOfStock && (
            <div className="mt-3 flex items-center gap-3">
              {product.spice_level > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-nurei-promo/10 rounded-full">
                  <Flame className="w-3 h-3 text-nurei-promo flex-shrink-0" />
                  <SpiceDots level={product.spice_level} />
                  <span className="text-[10px] text-nurei-promo font-bold italic">
                    {SPICE_LABELS[product.spice_level]}
                  </span>
                </div>
              )}
              <span className="text-[10px] font-bold text-gray-400 uppercase tabular-nums">
                {formatProductPresentation(product)}
              </span>
            </div>
          )}

          {/* Price + CTA */}
          <div className={`mt-auto ${compact ? 'pt-1.5' : 'pt-4'} flex items-end justify-between gap-3`}>
            <div className="flex flex-col">
              {product.compare_at_price && product.compare_at_price > price && !product.has_variants && (
                <span className="text-[10px] font-bold text-gray-300 line-through tabular-nums">
                  {formatPrice(product.compare_at_price)}
                </span>
              )}
              <span className={`${compact ? 'text-sm' : 'text-xl'} font-black tabular-nums tracking-tight transition-colors duration-300 ${
                isOutOfStock ? 'text-amber-400' : 'text-gray-900'
              }`}>
                {product.has_variants ? (
                  selectedVariant ? (
                    <span className="flex flex-col">
                      <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-semibold text-gray-400 leading-tight truncate max-w-[100px]`}>{selectedVariant.name}</span>
                      <span className={`${compact ? 'text-sm' : 'text-xl'} font-black text-gray-900 tabular-nums leading-tight`}>{formatPrice(price)}</span>
                    </span>
                  ) : compact
                    ? <span className="text-[11px] font-bold text-gray-600">{formatPrice(price)}</span>
                    : <span className="text-base font-bold text-gray-500">Desde{' '}<span className="text-gray-900 font-black">{formatPrice(price)}</span></span>
                ) : formatPrice(price)}
              </span>
            </div>

            {isOutOfStock ? (
              compact ? (
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 border border-amber-200">
                  <Ban className="w-3 h-3 text-amber-500 shrink-0" />
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                  <Ban className="w-3 h-3 shrink-0" />
                  Sin stock
                </span>
              )
            ) : product.has_variants ? (
              <motion.button
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.06 }}
                transition={SPRING_SNAP}
                onClick={handleAdd}
                className={`flex items-center justify-center ${compact ? 'w-7 h-7 rounded-full' : 'gap-1.5 px-4 py-2.5 rounded-full'} text-xs font-bold transition-colors duration-300 shadow-lg ${
                  added
                    ? 'bg-nurei-stock text-white shadow-nurei-stock/25'
                    : needsVariantSelection && stockFeedback
                      ? 'bg-red-500 text-white shadow-red-500/20'
                      : 'bg-nurei-cta text-gray-900 shadow-nurei-cta/30'
                }`}
                aria-label={needsVariantSelection ? 'Escoge una variante primero' : 'Agregar al carrito'}
              >
                {added ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {!compact && <span>{selectedVariant ? 'Agregar' : 'Elegir'}</span>}
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.06 }}
                transition={SPRING_SNAP}
                onClick={handleAdd}
                className={`flex items-center justify-center ${compact ? 'w-7 h-7 rounded-full' : 'gap-1.5 px-5 py-2.5 rounded-full'} text-xs font-bold transition-colors duration-300 shadow-lg ${
                  added
                    ? 'bg-nurei-stock text-white shadow-nurei-stock/25'
                    : 'bg-nurei-cta text-gray-900 shadow-nurei-cta/30'
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {added ? (
                    <motion.span
                      key="added"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={SPRING_SNAP}
                      className="flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="add"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={SPRING_SNAP}
                      className="flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )}
          </div>

          <AnimatePresence>
            {stockFeedback && (
              <motion.p
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 text-[11px] text-red-600 font-medium"
              >
                {stockFeedback}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </Link>
  )
}
