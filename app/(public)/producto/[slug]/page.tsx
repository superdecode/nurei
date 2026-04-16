'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart, ShoppingBag, ArrowLeft, Share2, Check,
  ChevronLeft, ChevronRight, Eye, ShoppingCart, Flame, Loader2,
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

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    crunchy: '🍘', spicy: '🌶️', limited_edition: '🍵', drinks: '🥤',
    snacks: '🍿', ramen: '🍜', dulces: '🍬', salsas: '🫙',
  }
  return map[category] || '🍘'
}

function ShareButtons({ name, slug }: { name: string; slug: string }) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/producto/${slug}` : ''
  const text = `Mira ${name} en nurei — snacks asiaticos premium`

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

export default function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const { isFavorite, toggleFavorite } = useFavoritesStore()

  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [primaryIndex, setPrimaryIndex] = useState(0)
  const [added, setAdded] = useState(false)
  const [quantity, setQuantity] = useState(1)

  // Fetch product from Supabase via API
  useEffect(() => {
    async function load() {
      try {
        // Fetch by slug — we need a slug-based endpoint
        const res = await fetch(`/api/products?search=${encodeURIComponent(slug)}`)
        const json = await res.json()
        const products: Product[] = json.data?.products ?? []
        const found = products.find(p => p.slug === slug)
        if (!found) { setLoading(false); return }

        setProduct(found)
        setPrimaryIndex(found.primary_image_index ?? 0)

        // Fetch variants if product has them
        if (found.has_variants) {
          const vRes = await fetch(`/api/products/${found.id}/variants`)
          const vJson = await vRes.json()
          setVariants(vJson.data ?? [])
        }

        // Fetch related products
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

  if (loading) {
    return (
      <Container className="py-20 flex justify-center">
        <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
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
  const activeImage = selectedVariant?.image || product.images?.[primaryIndex] || null
  const discountPercent = activeComparePrice && activeComparePrice > activePrice
    ? Math.round((1 - activePrice / activeComparePrice) * 100) : 0

  const needsVariantSelection = product.has_variants && variants.length > 0 && !selectedVariant
  const canAddToCart = !needsVariantSelection

  const handleAdd = () => {
    if (!canAddToCart) {
      toast.error('Selecciona una variante primero')
      return
    }
    for (let i = 0; i < quantity; i++) addItem(product)
    setAdded(true)
    toast.success(`${quantity}x ${product.name}${selectedVariant ? ` - ${selectedVariant.name}` : ''} agregado`)
    setTimeout(() => setAdded(false), 1400)
  }

  const handleToggleFavorite = () => {
    toggleFavorite(product.id)
    toast.success(fav ? 'Eliminado de favoritos' : 'Agregado a favoritos', { icon: fav ? '💔' : '❤️' })
  }

  // Group variants by attribute keys for chip selector
  const variantGroups = new Map<string, Set<string>>()
  for (const v of variants) {
    for (const [key, value] of Object.entries(v.attributes)) {
      if (!variantGroups.has(key)) variantGroups.set(key, new Set())
      variantGroups.get(key)!.add(value)
    }
  }

  return (
    <Container className="py-6 sm:py-10">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image area */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4">
          <div className="relative aspect-square bg-gray-50 rounded-3xl flex items-center justify-center overflow-hidden">
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
                <motion.span key="emoji" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[120px] sm:text-[160px] select-none">
                  {getCategoryEmoji(product.category)}
                </motion.span>
              )}
            </AnimatePresence>

            {product.images && product.images.length > 1 && (
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                <button onClick={() => { setPrimaryIndex(prev => (prev - 1 + product.images.length) % product.images.length); setSelectedVariant(null) }} className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md shadow-lg flex items-center justify-center pointer-events-auto hover:bg-white">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => { setPrimaryIndex(prev => (prev + 1) % product.images.length); setSelectedVariant(null) }} className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md shadow-lg flex items-center justify-center pointer-events-auto hover:bg-white">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {product.is_limited && (
                <span className="px-3 py-1.5 text-xs font-bold uppercase bg-nurei-promo text-white rounded-full">Limitado</span>
              )}
              {discountPercent > 0 && (
                <span className="px-3 py-1.5 text-xs font-black uppercase bg-red-500 text-white rounded-full">
                  -{discountPercent}%
                </span>
              )}
              {product.is_featured && (
                <span className="px-3 py-1.5 text-xs font-bold uppercase bg-nurei-cta text-gray-900 rounded-full">Popular</span>
              )}
            </div>

            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleToggleFavorite}
              className={`absolute top-4 right-4 p-3 rounded-full shadow-lg transition-colors ${fav ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-400 hover:text-red-400'}`}
            >
              <Heart className="w-5 h-5" fill={fav ? 'currentColor' : 'none'} />
            </motion.button>
          </div>

          {/* Thumbnails */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => { setPrimaryIndex(idx); setSelectedVariant(null) }}
                  className={`relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                    idx === primaryIndex && !selectedVariant?.image ? 'border-nurei-cta shadow-md scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Product info */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            {product.brand && <span className="uppercase font-bold tracking-wide">{product.brand}</span>}
            {product.brand && <span>·</span>}
            <span className="uppercase font-bold tracking-wide">{product.origin_country ?? product.origin}</span>
            <span>·</span>
            <span className="uppercase font-bold tracking-wide">{product.weight_g}{product.unit_of_measure ?? 'g'}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight mb-3">{product.name}</h1>

          {product.description && (
            <p className="text-gray-500 leading-relaxed mb-5">{product.description}</p>
          )}

          {/* Spice level */}
          {product.spice_level > 0 && (
            <div className="flex items-center gap-2 mb-5">
              <Flame className="w-4 h-4 text-nurei-promo" />
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < product.spice_level ? 'bg-nurei-promo' : 'bg-gray-200'}`} />
                ))}
              </div>
              <span className="text-sm font-bold text-nurei-promo italic">
                {SPICE_LABELS[product.spice_level]}
              </span>
            </div>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {product.tags.map(tag => (
                <span key={tag} className="px-2.5 py-1 text-[11px] font-medium bg-gray-100 text-gray-600 rounded-full">{tag}</span>
              ))}
            </div>
          )}

          {/* Price */}
          <div className="flex items-end gap-3 mb-6">
            {activeComparePrice && activeComparePrice > activePrice && (
              <span className="text-lg text-gray-300 line-through font-bold">{formatPrice(activeComparePrice)}</span>
            )}
            <span className="text-4xl font-black text-gray-900 tabular-nums">{formatPrice(activePrice)}</span>
            {discountPercent > 0 && (
              <span className="text-sm font-black text-red-500 bg-red-50 px-2 py-1 rounded-lg">-{discountPercent}%</span>
            )}
          </div>

          {/* Variant selector */}
          {product.has_variants && variants.length > 0 && (
            <div className="mb-6 space-y-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Selecciona una opcion {needsVariantSelection && <span className="text-red-500">*</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {variants.filter(v => v.status === 'active').map(v => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(selectedVariant?.id === v.id ? null : v)}
                    className={cn(
                      'px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                      selectedVariant?.id === v.id
                        ? 'border-nurei-cta bg-nurei-cta/10 text-gray-900 shadow-sm'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <span className="font-bold">{v.name}</span>
                    {v.price !== (product.base_price ?? product.price) && (
                      <span className="ml-2 text-xs text-gray-400">{formatPrice(v.price)}</span>
                    )}
                    {v.stock <= 3 && v.stock > 0 && (
                      <span className="ml-2 text-[10px] text-orange-500 font-bold">Ultimas {v.stock}</span>
                    )}
                    {v.stock === 0 && (
                      <span className="ml-2 text-[10px] text-red-500 font-bold">Agotado</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-11 h-11 flex items-center justify-center text-gray-400 hover:bg-gray-50 font-bold text-lg">-</button>
              <span className="w-11 h-11 flex items-center justify-center text-sm font-bold text-gray-900 border-x border-gray-200">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="w-11 h-11 flex items-center justify-center text-gray-400 hover:bg-gray-50 font-bold text-lg">+</button>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAdd}
              disabled={!canAddToCart || (selectedVariant?.stock === 0)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all',
                added ? 'bg-green-500 text-white shadow-lg shadow-green-500/25' :
                !canAddToCart ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
                'bg-nurei-cta text-gray-900 shadow-lg shadow-nurei-cta/25 hover:shadow-xl'
              )}
            >
              {added ? (
                <><Check className="w-5 h-5" /> Agregado</>
              ) : !canAddToCart ? (
                'Selecciona una variante'
              ) : (
                <><ShoppingBag className="w-5 h-5" /> Agregar al carrito</>
              )}
            </motion.button>
          </div>

          {/* Share */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Compartir</p>
            <ShareButtons name={product.name} slug={product.slug} />
          </div>
        </motion.div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="text-xl font-black text-gray-900 mb-6">Tambien te puede gustar</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {related.map((p) => (
              <Link key={p.id} href={`/producto/${p.slug}`}>
                <ProductCard product={p} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </Container>
  )
}
