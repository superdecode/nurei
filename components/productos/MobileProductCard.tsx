'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Ban, Heart } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useCartStore } from '@/lib/stores/cart'
import { useFavoritesStore } from '@/lib/stores/favorites'
import { formatPrice, stripHtml } from '@/lib/utils/format'
import type { Product } from '@/types'

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    crunchy: '🍘', spicy: '🌶️', limited_edition: '🍵', drinks: '🥤',
    snacks: '🍿', ramen: '🍜', dulces: '🍬', salsas: '🫙',
  }
  return map[category] || '🍘'
}

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const MinusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <path d="M5 12h14" />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

const SPRING_SNAP = { type: 'spring', stiffness: 400, damping: 20 } as const
const SPRING_SMOOTH = { type: 'spring', stiffness: 350, damping: 28 } as const

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

interface MobileProductCardProps {
  product: Product
  searchQuery?: string
}

export function MobileProductCard({ product, searchQuery = '' }: MobileProductCardProps) {
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const fav = isFavorite(product.id)
  const [added, setAdded] = useState(false)
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number | null>(null)
  const [variantOffset, setVariantOffset] = useState(0)
  const [variantError, setVariantError] = useState(false)

  const activeVariants = product.has_variants && product.variants
    ? product.variants.filter((v) => v.status === 'active')
    : []
  const selectedVariant = selectedVariantIdx !== null ? activeVariants[selectedVariantIdx] ?? null : null
  const qty = useCartStore((s) =>
    s.items.find((i) => i.product.id === product.id && (i.variant_id ?? null) === (selectedVariant?.id ?? null))?.quantity ?? 0
  )

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (product.has_variants && activeVariants.length > 0 && !selectedVariant) {
      setVariantError(true)
      toast.error('Escoge una variante primero')
      return
    }
    try {
      const stockBody: Record<string, unknown> = { quantity: 1, currentCartQuantity: qty }
      if (selectedVariant) stockBody.variant_id = selectedVariant.id
      const res = await fetch(`/api/products/${product.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stockBody),
      })
      const payload = await res.json()
      if (!res.ok || !payload?.can_add) {
        toast.error(payload?.message ?? 'No hay stock suficiente.')
        return
      }
      addItem(product, selectedVariant ? {
        id: selectedVariant.id,
        name: selectedVariant.name,
        image: selectedVariant.image,
        price: selectedVariant.price,
      } : null)
      setAdded(true)
      setVariantError(false)
      toast.success(`${product.name}${selectedVariant ? ` - ${selectedVariant.name}` : ''} agregado`, { icon: '🍘', duration: 1500 })
      setTimeout(() => setAdded(false), 1200)
    } catch {
      toast.error('No se pudo validar inventario.')
    }
  }

  const handleMinus = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(product.id, qty - 1, selectedVariant?.id ?? null)
  }

  const isOutOfStock = product.stock_status === 'out_of_stock'
  const isLowStock = product.stock_status === 'low_stock'
  const price = selectedVariant?.price ?? product.base_price ?? product.price
  const shortDescription = product.description ? stripHtml(product.description).trim() : ''
  const hasDiscount = !!product.compare_at_price && product.compare_at_price > price
  const discountPercent = hasDiscount
    ? Math.round((1 - price / product.compare_at_price!) * 100)
    : 0

  return (
    <Link href={`/producto/${product.slug}`}>
      <motion.div
        layout
        transition={SPRING_SMOOTH}
        whileTap={isOutOfStock ? {} : { scale: 0.98 }}
        className={`flex items-center gap-3 p-3 bg-white rounded-2xl border shadow-sm transition-colors duration-300 ${
          isOutOfStock ? 'border-amber-200/70' : 'border-gray-100'
        }`}
      >
        {/* Image */}
        <div className="relative w-[76px] h-[76px] flex-shrink-0 rounded-xl overflow-hidden bg-gray-50">
          {(selectedVariant?.image ?? product.images?.[product.primary_image_index] ?? product.image_thumbnail_url) ? (
            <img
              src={selectedVariant?.image ?? product.images?.[product.primary_image_index] ?? product.image_thumbnail_url!}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <span className="text-2xl opacity-30">{getCategoryEmoji(product.category)}</span>
            </div>
          )}

          {/* Out of stock — amber wash + pill */}
          {isOutOfStock && (
            <>
              <div className="absolute inset-0 bg-[#FFF3CE]/70" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-[#FFF3CE] border border-amber-300/80 text-amber-800 text-[8px] font-bold uppercase tracking-wider">
                  <Ban className="w-2 h-2 shrink-0" />
                  Agotado
                </span>
              </div>
            </>
          )}

          {/* Discount badge */}
          {discountPercent > 0 && !isOutOfStock && (
            <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-black bg-red-500 text-white rounded-full leading-none">
              -{discountPercent}% Off
            </span>
          )}

          {/* Limited badge */}
          {product.is_limited && !discountPercent && !isOutOfStock && (
            <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-bold bg-nurei-promo text-white rounded-full leading-none">
              🕐 Ltd
            </span>
          )}

          {/* Favorite button */}
          <motion.button
            whileTap={{ scale: 0.8 }}
            transition={SPRING_SNAP}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleFavorite(product.id)
              toast.success(fav ? 'Eliminado de favoritos' : 'Agregado a favoritos', {
                icon: fav ? '💔' : '❤️',
                duration: 1500,
              })
            }}
            className={`absolute bottom-1 right-1 p-1.5 rounded-full shadow-sm transition-colors duration-200 ${
              fav ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-400'
            }`}
          >
            <Heart className="w-3 h-3" fill={fav ? 'currentColor' : 'none'} />
          </motion.button>

        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 self-stretch flex flex-col justify-center pr-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`text-sm font-bold line-clamp-1 leading-tight transition-colors duration-300 ${
                isOutOfStock ? 'text-amber-900/60' : 'text-gray-900'
              }`}>
                <HighlightText text={product.name} query={searchQuery} />
              </p>
              {shortDescription && (
                <p className="mt-0.5 text-[11px] text-gray-400 line-clamp-1 leading-tight">
                  <HighlightText text={shortDescription} query={searchQuery} />
                </p>
              )}
              <div className="mt-1 flex items-center gap-1.5">
              {hasDiscount && (
                <span className="text-[11px] text-gray-300 line-through font-medium tabular-nums">
                  {formatPrice(product.compare_at_price!)}
                </span>
              )}
              <span className={`text-base font-black tabular-nums tracking-tight transition-colors duration-300 ${
                isOutOfStock ? 'text-amber-400' : hasDiscount ? 'text-nurei-promo' : 'text-gray-900'
              }`}>
                {formatPrice(price)}
              </span>
            </div>
              {selectedVariant && (
                <p className="mt-0.5 text-[10px] font-bold text-nurei-cta line-clamp-1">{selectedVariant.name}</p>
              )}
            </div>
            {activeVariants.length > 0 && (() => {
              const total = activeVariants.length
              if (total <= 4) {
                return (
                  <div className="flex shrink-0 gap-1">
                    {activeVariants.map((variant, idx) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedVariantIdx(selectedVariantIdx === idx ? null : idx); setVariantError(false) }}
                        className={variant.image
                          ? `w-6 h-6 rounded-full overflow-hidden border-2 shadow-sm bg-gray-100 shrink-0 transition-all duration-150 ${selectedVariant?.id === variant.id ? 'border-nurei-cta scale-110 shadow-nurei-cta/40' : variantError ? 'border-red-300' : 'border-white hover:border-nurei-cta/60'}`
                          : `h-6 min-w-6 max-w-[54px] rounded-full border px-1.5 text-[9px] font-black transition-all ${selectedVariant?.id === variant.id ? 'border-nurei-cta bg-nurei-cta text-gray-900 shadow-sm' : variantError ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 bg-gray-50 text-gray-500'}`
                        }
                        aria-label={`Seleccionar ${variant.name}`}
                      >
                        {variant.image ? <img src={variant.image} alt="" className="w-full h-full object-cover" /> : <span className="block truncate">{variant.name}</span>}
                      </button>
                    ))}
                  </div>
                )
              }
              const hasLeft = variantOffset > 0
              const hasRight = variantOffset + (hasLeft ? 2 : 3) < total
              const fullStart = variantOffset
              const fullCount = hasLeft && hasRight ? 2 : 3
              const visible = activeVariants.slice(fullStart, fullStart + fullCount)
              return (
                <div className="flex shrink-0 gap-1 items-center overflow-hidden">
                  {hasLeft && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setVariantOffset(v => v - 1) }}
                      className="h-6 w-3 rounded-r-full border border-gray-200 bg-gray-50 overflow-hidden shrink-0 opacity-60"
                      aria-label="Anterior"
                    >
                      {activeVariants[variantOffset - 1].image
                        ? <img src={activeVariants[variantOffset - 1].image!} alt="" className="w-full h-full object-cover" />
                        : <span className="block w-full h-full flex items-center justify-center text-[7px] font-black text-gray-400 truncate px-0.5">{activeVariants[variantOffset - 1].name.charAt(0)}</span>}
                    </button>
                  )}
                  {visible.map((variant, i) => {
                    const globalIdx = fullStart + i
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedVariantIdx(selectedVariantIdx === globalIdx ? null : globalIdx); setVariantError(false) }}
                        className={variant.image
                          ? `w-6 h-6 rounded-full overflow-hidden border-2 shadow-sm bg-gray-100 shrink-0 transition-all duration-150 ${selectedVariant?.id === variant.id ? 'border-nurei-cta scale-110 shadow-nurei-cta/40' : variantError ? 'border-red-300' : 'border-white hover:border-nurei-cta/60'}`
                          : `h-6 min-w-6 max-w-[54px] rounded-full border px-1.5 text-[9px] font-black transition-all ${selectedVariant?.id === variant.id ? 'border-nurei-cta bg-nurei-cta text-gray-900 shadow-sm' : variantError ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 bg-gray-50 text-gray-500'}`
                        }
                        aria-label={`Seleccionar ${variant.name}`}
                      >
                        {variant.image ? <img src={variant.image} alt="" className="w-full h-full object-cover" /> : <span className="block truncate">{variant.name}</span>}
                      </button>
                    )
                  })}
                  {hasRight && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setVariantOffset(v => v + 1) }}
                      className="h-6 w-3 rounded-l-full border border-gray-200 bg-gray-50 overflow-hidden shrink-0 opacity-60"
                      aria-label="Siguiente"
                    >
                      <div className="w-6 h-6 flex items-center justify-center text-[8px] font-black text-gray-400">
                        {activeVariants[fullStart + fullCount].image
                          ? <img src={activeVariants[fullStart + fullCount].image!} alt="" className="h-4 w-4 rounded-full object-cover" />
                          : <span className="block truncate">{activeVariants[fullStart + fullCount].name}</span>}
                      </div>
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
          {variantError && (
            <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-red-500">
              <AlertCircle className="h-3 w-3" /> Escoge variante
            </p>
          )}
          {isLowStock && !variantError && (
            <p className="mt-1 text-[10px] font-bold text-nurei-promo">Últimas unidades</p>
          )}
        </div>

        {/* Qty controls */}
        <div className="flex-shrink-0">
          {isOutOfStock ? (
            <span className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold rounded-full bg-amber-50 text-amber-600 border border-amber-200">
              <Ban className="w-2.5 h-2.5 shrink-0" />
              Sin stock
            </span>
          ) : qty > 0 ? (
            <div className="flex items-center gap-1.5">
              <motion.button
                whileTap={{ scale: 0.8 }}
                transition={SPRING_SNAP}
                onClick={handleMinus}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:bg-gray-200 transition-colors duration-150"
              >
                <MinusIcon />
              </motion.button>

              <AnimatePresence mode="popLayout">
                <motion.span
                  key={qty}
                  initial={{ y: -10, opacity: 0, scale: 0.8 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 10, opacity: 0, scale: 0.8 }}
                  transition={SPRING_SNAP}
                  className="w-6 text-center text-sm font-black text-gray-900 tabular-nums"
                >
                  {qty}
                </motion.span>
              </AnimatePresence>

              <motion.button
                whileTap={{ scale: 0.8 }}
                transition={SPRING_SNAP}
                onClick={handleAdd}
                className="w-8 h-8 rounded-full bg-nurei-cta flex items-center justify-center text-gray-900 shadow-sm shadow-nurei-cta/30 active:brightness-95 transition-all duration-150"
              >
                <PlusIcon />
              </motion.button>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.85 }}
              transition={SPRING_SNAP}
              onClick={handleAdd}
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-md bg-nurei-cta text-gray-900 shadow-nurei-cta/30 active:brightness-95 transition-all duration-150"
            >
              <AnimatePresence mode="wait" initial={false}>
                {added ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }}
                    transition={SPRING_SNAP}
                  >
                    <CheckIcon />
                  </motion.span>
                ) : (
                  <motion.span
                    key="plus"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={SPRING_SNAP}
                  >
                    <PlusIcon />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </div>
      </motion.div>
    </Link>
  )
}
