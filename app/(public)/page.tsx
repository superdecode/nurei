'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowRight, Flame, Truck, Star, Check, Plus, Heart, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/layout/Container'
// Products fetched from Supabase via API
import { SPICE_LABELS, FREE_SHIPPING_THRESHOLD } from '@/lib/utils/constants'
import { formatPrice } from '@/lib/utils/format'
import { useCartStore } from '@/lib/stores/cart'
import type { Product } from '@/types'

function SpiceDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            i < level ? 'bg-nurei-promo' : 'bg-stone-200'
          }`}
        />
      ))}
    </div>
  )
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  const addItem = useCartStore((s) => s.addItem)
  const [added, setAdded] = useState(false)

  const handleAdd = () => {
    addItem(product)
    setAdded(true)
    toast.success(`${product.name} agregado al carrito`, {
      icon: '🍘',
      description: '¡Buen provecho!',
      duration: 2000,
    })
    setTimeout(() => setAdded(false), 1400)
  }

  const emoji = product.category === 'crunchy' ? '🍘' :
                product.category === 'spicy' ? '🌶️' :
                product.category === 'limited_edition' ? '🍵' : '🥤'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="card-product group overflow-hidden flex flex-col"
    >
      {/* Image area */}
      <div className="relative aspect-square bg-yellow-50 flex items-center justify-center overflow-hidden rounded-t-[1.25rem]">
        {product.images && product.images.length > 0 ? (
          <motion.img
            src={product.images[product.primary_image_index ?? 0] || product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : (
          <motion.span
            className="text-6xl sm:text-7xl select-none"
            whileHover={{ scale: 1.2, rotate: [0, -8, 8, 0] }}
            transition={{ duration: 0.5 }}
          >
            {emoji}
          </motion.span>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.is_limited && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-nurei-promo text-white rounded-full shadow-lg">
              🔥 Edición Limitada
            </span>
          )}
          {product.compare_at_price && product.compare_at_price > (product.price || 0) && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-nurei-cta text-nurei-black rounded-full shadow-lg">
              Oferta
            </span>
          )}
        </div>

        {/* Origin flag */}
        <div className="absolute top-3 right-3 px-2.5 py-1 bg-white/70 backdrop-blur-md rounded-full border border-stone-200">
          <span className="text-[10px] font-medium text-stone-500">
            {product.origin}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        <h3 className="text-[15px] font-black text-gray-900 line-clamp-2 leading-snug group-hover:text-nurei-cta transition-colors duration-300">
          {product.name}
        </h3>

        <p className="mt-1.5 text-xs text-nurei-muted line-clamp-2 leading-relaxed">
          {product.description}
        </p>

        {/* Spice + Weight row */}
        <div className="mt-3 flex items-center gap-3">
          {product.spice_level > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-nurei-promo/10 rounded-full">
              <SpiceDots level={product.spice_level} />
              <span className="text-[10px] text-nurei-promo font-medium">
                {SPICE_LABELS[product.spice_level]}
              </span>
            </div>
          )}
          <span className="text-[10px] text-nurei-muted/70">{product.weight_g}g</span>
        </div>

        {/* Price + CTA */}
        <div className="mt-auto pt-4 flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            {product.compare_at_price && (
              <span className="text-xs text-nurei-muted/50 line-through">
                {formatPrice(product.compare_at_price)}
              </span>
            )}
            <span className="text-xl font-black text-gray-900 tabular-nums">
              {formatPrice(product.price)}
            </span>
          </div>

          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
            onClick={handleAdd}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-full transition-all duration-300 ${
              added
                ? 'bg-nurei-stock text-white shadow-lg shadow-nurei-stock/25'
                : 'bg-nurei-cta hover:bg-nurei-cta-hover text-nurei-black shadow-lg shadow-nurei-cta/20'
            }`}
          >
            <AnimatePresence mode="wait">
              {added ? (
                <motion.span
                  key="added"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> ¡Listo!
                </motion.span>
              ) : (
                <motion.span
                  key="add"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const addItem = useCartStore((s) => s.addItem)
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{value: string, label: string, emoji: string}[]>([
    { value: 'all', label: 'Todo', emoji: '✨' }
  ])
  const [featuredAdded, setFeaturedAdded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch('/api/products?status=active'),
          fetch('/api/admin/categories')
        ])
        const prodJson = await prodRes.json()
        const catJson = await catRes.json()
        
        setAllProducts(prodJson.data?.products ?? [])
        if (catJson.data) {
          const dbCats = catJson.data.map((c: any) => ({
            value: c.slug,
            label: c.name,
            emoji: c.emoji || '📦'
          }))
          setCategories([{ value: 'all', label: 'Todo', emoji: '✨' }, ...dbCats])
        }
      } catch { /* ignore */ }
    }
    load()
  }, [])

  const featuredProduct = allProducts.find((p) => p.is_featured) || allProducts[0]

  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory
      const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [activeCategory, searchQuery, allProducts])

  const handleAddFeatured = () => {
    addItem(featuredProduct)
    setFeaturedAdded(true)
    setTimeout(() => setFeaturedAdded(false), 1400)
  }

  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-white">
        <Container className="relative z-10 py-12 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-100 mb-8 shadow-sm"
              >
                <span className="flex h-2 w-2 rounded-full bg-nurei-cta animate-pulse" />
                <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">
                  Premium Asian Snacks
                </span>
              </motion.div>

              <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] text-gray-900 mb-8">
                nu<span className="text-nurei-cta">rei</span>
                <br />
                <span className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-gray-400">
                  Snacks seleccionados
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-500 max-w-xl mb-10 leading-relaxed">
                Curaduría premium de los mejores snacks importados de Asia. 
                Directo a tu puerta en CDMX con stock en tiempo real.
              </p>
            </motion.div>

            <div className="relative group">
              <motion.div 
                animate={{ rotate: [0, 5, 0, -5, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-yellow-50 rounded-full blur-3xl opacity-50 group-hover:bg-yellow-100 transition-colors duration-700"
              />
              <div className="relative flex flex-col items-center justify-center">
                <span className="text-[12rem] sm:text-[18rem] select-none filter drop-shadow-2xl">
                  🍘
                </span>
                <div className="flex gap-4 mt-[-2rem]">
                  <span className="text-6xl filter drop-shadow-xl animate-bounce" style={{ animationDelay: '0s' }}>🌶️</span>
                  <span className="text-6xl filter drop-shadow-xl animate-bounce" style={{ animationDelay: '0.2s' }}>🍵</span>
                  <span className="text-6xl filter drop-shadow-xl animate-bounce" style={{ animationDelay: '0.4s' }}>🥤</span>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Featured Snack */}
      <section className="py-20 bg-gray-50">
        <Container>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative flex flex-col md:flex-row items-center gap-10 md:gap-16 p-8 sm:p-14 rounded-[2rem] bg-white border border-gray-100 overflow-hidden shadow-card"
          >
            <div className="flex-1 space-y-6 z-10 text-center md:text-left">
              <div className="badge-fresh">Stock Real-Time</div>
              <h2 className="text-3xl sm:text-5xl font-black text-gray-900 leading-[1.1]">
                ¿Buscas algo <br />
                <span className="text-nurei-cta italic">específico?</span>
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed max-w-md">
                Nuestro inventario se actualiza en tiempo real. 
                Si lo ves disponible, es tuyo. Sin sorpresas.
              </p>
              <div className="pt-4">
                <Link href="/menu">
                  <Button className="btn-cta h-12 px-8">
                    Hacer mi pedido ahora
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4 w-full max-w-md relative z-10">
              <div className="aspect-square rounded-2xl bg-gray-50 flex items-center justify-center text-4xl shadow-sm border border-gray-100">🍱</div>
              <div className="aspect-square rounded-2xl bg-gray-50 flex items-center justify-center text-4xl shadow-sm border border-gray-100 mt-8">🍜</div>
              <div className="aspect-square rounded-2xl bg-gray-50 flex items-center justify-center text-4xl shadow-sm border border-gray-100 -mt-8">🍡</div>
              <div className="aspect-square rounded-2xl bg-gray-50 flex items-center justify-center text-4xl shadow-sm border border-gray-100">🍪</div>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* Product Grid */}
      <section id="menu" className="py-20 bg-white">
        <Container>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="text-3xl sm:text-5xl font-black text-gray-900">
                Selección de <span className="text-nurei-cta">Temporada</span>
              </h2>
              <p className="text-gray-500 mt-2 text-lg">Recién llegados de Tokyo y Seúl</p>
            </div>
            <Link href="/menu" className="inline-flex items-center gap-2 text-nurei-cta font-bold hover:gap-3 transition-all">
              Ver todo el catálogo <ChevronRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Category pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap mb-12">
            {categories.map((cat) => (
              <motion.button
                key={cat.value}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(cat.value)}
                className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium rounded-full border transition-all duration-300 ${
                  activeCategory === cat.value
                    ? 'bg-nurei-cta text-gray-900 border-nurei-cta font-bold shadow-md'
                    : 'bg-white text-gray-500 border-gray-100 hover:border-yellow-300 hover:text-gray-900 hover:bg-yellow-50'
                }`}
              >
                <span>{cat.emoji}</span>
                {cat.label}
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {filteredProducts.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        </Container>
      </section>

      {/* CTA Final */}
      <section className="relative py-20 sm:py-28 text-center overflow-hidden bg-yellow-400">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.4),transparent_70%)]" />
        <Container className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-3xl sm:text-5xl font-black text-gray-900 mb-6">
              ¿Ya se te antojó? 😋
            </h2>
            <p className="text-lg text-gray-800 max-w-md mx-auto mb-10 font-medium">
              Envío gratis en pedidos mayores a {formatPrice(FREE_SHIPPING_THRESHOLD)}. Llega directo a tu puerta.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/menu">
                <Button size="lg" className="bg-gray-900 text-white hover:bg-black h-14 px-10 text-lg rounded-full font-bold shadow-xl">
                  Explorar menú
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>
            <p className="mt-8 text-xs text-gray-800 font-bold uppercase tracking-wider">
              🚀 Envío express en CDMX · 📦 Empaque seguro · ❤️ Satisfacción garantizada
            </p>
          </motion.div>
        </Container>
      </section>
    </>
  )
}
