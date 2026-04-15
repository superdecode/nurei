'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Menu, X, Heart, User, LogIn } from 'lucide-react'
import { Container } from './Container'
import { useCartStore } from '@/lib/stores/cart'
import { useUIStore } from '@/lib/stores/ui'
import { useAuthStore } from '@/lib/stores/auth'
import { useFavoritesStore } from '@/lib/stores/favorites'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function Header() {
  const getItemCount = useCartStore((s) => s.getItemCount)
  const openCart = useUIStore((s) => s.openCart)
  const isMobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen)
  const openMobileMenu = useUIStore((s) => s.openMobileMenu)
  const closeMobileMenu = useUIStore((s) => s.closeMobileMenu)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const favCount = useFavoritesStore((s) => s.favoriteIds.length)
  const [scrolled, setScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const itemCount = mounted ? getItemCount() : 0
  const favoritesCount = mounted ? favCount : 0

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 h-16 transition-all duration-500',
          scrolled
            ? 'bg-background/80 backdrop-blur-md border-b shadow-sm'
            : 'bg-transparent'
        )}
      >
        <Container className="flex items-center justify-between h-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="text-2xl group-hover:animate-[wiggle_0.5s_ease-in-out]">🍘</span>
            <span className="text-xl font-black tracking-tight text-gray-900">
              nu<span className="text-nurei-cta">rei</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/menu"
              className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-900 hover:bg-yellow-50 rounded-full transition-all duration-200 uppercase tracking-tight"
            >
              Menú
            </Link>
            <Link
              href="/nosotros"
              className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-900 hover:bg-yellow-50 rounded-full transition-all duration-200 uppercase tracking-tight"
            >
              Nosotros
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {/* Favorites */}
            <Link
              href="/favoritos"
              className="relative flex items-center justify-center w-11 h-11 rounded-2xl text-gray-500 hover:text-red-400 hover:bg-red-50 transition-all duration-200"
              aria-label="Favoritos"
            >
              <Heart className="w-5 h-5" />
              <AnimatePresence>
                {favoritesCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold bg-red-400 text-white rounded-full shadow-sm"
                  >
                    {favoritesCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>

            {/* Cart */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={openCart}
              className="relative flex items-center justify-center w-11 h-11 rounded-2xl text-gray-500 hover:text-gray-900 hover:bg-yellow-50 transition-all duration-200"
              aria-label="Abrir carrito"
            >
              <ShoppingBag className="w-5 h-5" />
              <AnimatePresence>
                {itemCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold bg-nurei-cta text-gray-900 rounded-full shadow-sm"
                  >
                    {itemCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Auth */}
            {mounted && isAuthenticated ? (
              <Link
                href="/perfil"
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-bold text-gray-500 hover:text-gray-900 hover:bg-yellow-50 transition-all duration-200"
              >
                <User className="w-4 h-4" />
                <span className="max-w-[80px] truncate">{user?.full_name || 'Perfil'}</span>
              </Link>
            ) : mounted ? (
              <Link
                href="/login"
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold bg-nurei-cta text-gray-900 shadow-md shadow-nurei-cta/20 hover:shadow-lg transition-all duration-200"
              >
                <LogIn className="w-4 h-4" />
                Entrar
              </Link>
            ) : null}

            <button
              onClick={isMobileMenuOpen ? closeMobileMenu : openMobileMenu}
              className="flex md:hidden items-center justify-center w-11 h-11 rounded-2xl text-gray-500 hover:text-gray-900 hover:bg-yellow-50 transition-all duration-200"
              aria-label="Menú"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </Container>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 pt-16 bg-background/97 backdrop-blur-2xl md:hidden"
          >
            <nav className="flex flex-col items-center gap-6 pt-20">
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}>
                <Link href="/menu" onClick={closeMobileMenu} className="text-3xl font-black text-gray-900">
                  Menú 🍘
                </Link>
              </motion.div>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
                <Link href="/favoritos" onClick={closeMobileMenu} className="text-2xl text-gray-500 font-bold">
                  Favoritos ❤️
                </Link>
              </motion.div>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
                <Link href="/nosotros" onClick={closeMobileMenu} className="text-2xl text-gray-500 font-bold">
                  Nosotros ✨
                </Link>
              </motion.div>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                {mounted && isAuthenticated ? (
                  <Link href="/perfil" onClick={closeMobileMenu} className="text-2xl text-gray-500 font-bold">
                    Mi perfil 👤
                  </Link>
                ) : (
                  <Link href="/login" onClick={closeMobileMenu} className="text-2xl text-nurei-cta font-bold">
                    Entrar 🔑
                  </Link>
                )}
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
