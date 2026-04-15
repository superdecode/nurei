'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Heart, ShoppingBag, ArrowLeft, Share2, Check,
  ChevronLeft, ChevronRight, Eye, ShoppingCart, Flame,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { PRODUCTS } from '@/lib/data/products'
import { useCartStore } from '@/lib/stores/cart'
import { useFavoritesStore } from '@/lib/stores/favorites'
import { formatPrice } from '@/lib/utils/format'
import { SPICE_LABELS } from '@/lib/utils/constants'
import { Container } from '@/components/layout/Container'
import { ProductCard } from '@/components/productos/ProductCard'

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    crunchy: '🍘',
    spicy: '🌶️',
    limited_edition: '🍵',
    drinks: '🥤',
  }
  return map[category] || '🍘'
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
      toast.success('Link copiado', { icon: '🔗' })
      return
    }
    window.open(urls[platform], '_blank', 'width=600,height=400')
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => share('whatsapp')} className="p-2.5 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="WhatsApp">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </button>
      <button onClick={() => share('facebook')} className="p-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Facebook">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      </button>
      <button onClick={() => share('twitter')} className="p-2.5 rounded-xl bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors" title="Twitter/X">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
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
  const [added, setAdded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => { setMounted(true) }, [])

  const product = PRODUCTS.find((p) => p.slug === slug)

  if (!product) {
    return (
      <Container className="py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Producto no encontrado</h1>
        <Link href="/menu" className="text-nurei-cta font-bold hover:underline">Volver al menú</Link>
      </Container>
    )
  }

  const related = PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4)
  const fav = mounted ? isFavorite(product.id) : false

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) addItem(product)
    setAdded(true)
    toast.success(`${quantity}x ${product.name} agregado`, { icon: '🍘' })
    setTimeout(() => setAdded(false), 1400)
  }

  const handleToggleFavorite = () => {
    toggleFavorite(product.id)
    toast.success(fav ? 'Eliminado de favoritos' : 'Agregado a favoritos', {
      icon: fav ? '💔' : '❤️',
    })
  }

  return (
    <Container className="py-6 sm:py-10">
      {/* Breadcrumb */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image area */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative aspect-square bg-gray-50 rounded-3xl flex items-center justify-center overflow-hidden"
        >
          <span className="text-[120px] sm:text-[160px] select-none">
            {getCategoryEmoji(product.category)}
          </span>

          {/* Badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            {product.is_limited && (
              <span className="px-3 py-1.5 text-xs font-bold uppercase bg-nurei-promo text-white rounded-full">
                Limitado
              </span>
            )}
            {product.is_featured && (
              <span className="px-3 py-1.5 text-xs font-bold uppercase bg-nurei-cta text-gray-900 rounded-full">
                Popular
              </span>
            )}
          </div>

          {/* Favorite button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleToggleFavorite}
            className={`absolute top-4 right-4 p-3 rounded-full shadow-lg transition-colors ${
              fav ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-400 hover:text-red-400'
            }`}
          >
            <Heart className="w-5 h-5" fill={fav ? 'currentColor' : 'none'} />
          </motion.button>
        </motion.div>

        {/* Product info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col"
        >
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <span className="uppercase font-bold tracking-wide">{product.origin}</span>
            <span>·</span>
            <span className="uppercase font-bold tracking-wide">{product.weight_g}g</span>
            <span>·</span>
            <span className="uppercase font-bold tracking-wide">SKU: {product.sku}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight mb-3">
            {product.name}
          </h1>

          {product.description && (
            <p className="text-gray-500 leading-relaxed mb-5">{product.description}</p>
          )}

          {/* Spice level */}
          {product.spice_level > 0 && (
            <div className="flex items-center gap-2 mb-5">
              <Flame className="w-4 h-4 text-nurei-promo" />
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full ${i < product.spice_level ? 'bg-nurei-promo' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
              <span className="text-sm font-bold text-nurei-promo italic">
                {SPICE_LABELS[product.spice_level]}
              </span>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 mb-6 text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" /> {product.views_count} vistas
            </span>
            <span className="flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4" /> {product.purchases_count} vendidos
            </span>
          </div>

          {/* Price */}
          <div className="flex items-end gap-3 mb-6">
            {product.compare_at_price && (
              <span className="text-lg text-gray-300 line-through font-bold">
                {formatPrice(product.compare_at_price)}
              </span>
            )}
            <span className="text-4xl font-black text-gray-900 tabular-nums">
              {formatPrice(product.price)}
            </span>
          </div>

          {/* Availability */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-gray-500">Disponibilidad</span>
              <span className={`text-xs font-bold ${product.availability_score > 50 ? 'text-green-500' : 'text-nurei-promo'}`}>
                {product.availability_score > 50 ? 'En stock' : 'Últimas unidades'}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${product.availability_score > 50 ? 'bg-green-400' : 'bg-nurei-promo'}`}
                style={{ width: `${product.availability_score}%` }}
              />
            </div>
          </div>

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-11 h-11 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors font-bold text-lg"
              >
                -
              </button>
              <span className="w-11 h-11 flex items-center justify-center text-sm font-bold text-gray-900 border-x border-gray-200">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-11 h-11 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors font-bold text-lg"
              >
                +
              </button>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAdd}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all ${
                added
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                  : 'bg-nurei-cta text-gray-900 shadow-lg shadow-nurei-cta/25 hover:shadow-xl'
              }`}
            >
              {added ? (
                <><Check className="w-5 h-5" /> Agregado</>
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
          <h2 className="text-xl font-black text-gray-900 mb-6">También te puede gustar</h2>
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
