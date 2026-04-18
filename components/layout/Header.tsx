'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Menu, X, Heart, User, LogIn, LogOut, Settings, ChevronRight } from 'lucide-react'
import { Container } from './Container'
import { useCartStore } from '@/lib/stores/cart'
import { useUIStore } from '@/lib/stores/ui'
import { useAuthStore } from '@/lib/stores/auth'
import { useFavoritesStore } from '@/lib/stores/favorites'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function Header() {
  const items = useCartStore((s) => s.items)
  const openCart = useUIStore((s) => s.openCart)
  const isMobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen)
  const openMobileMenu = useUIStore((s) => s.openMobileMenu)
  const closeMobileMenu = useUIStore((s) => s.closeMobileMenu)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const userEmail = useAuthStore((s) => s.email)
  const logout = useAuthStore((s) => s.logout)
  const favCount = useFavoritesStore((s) => s.favoriteIds.length)
  const [scrolled, setScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isBumping, setIsBumping] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const handleLogout = async () => {
    setUserMenuOpen(false)
    await logout()
    toast.success('Sesión cerrada')
    router.push('/')
  }

  const itemCount = mounted ? items.reduce((sum, item) => sum + item.quantity, 0) : 0
  const favoritesCount = mounted ? favCount : 0

  useEffect(() => {
    if (itemCount === 0 || !mounted) return
    setIsBumping(true)
    const timeout = setTimeout(() => setIsBumping(false), 300)
    return () => clearTimeout(timeout)
  }, [itemCount, mounted])

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!userMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

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
          <Link href="/" className="flex items-center gap-2 group">
            <img 
              src="/logo.png" 
              alt="nurei logo" 
              className="w-8 h-8 group-hover:animate-[wiggle_0.5s_ease-in-out] object-contain"
            />
            <span className="text-lg font-black tracking-tight text-gray-900">
              nurei
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
              animate={isBumping ? { scale: [1, 1.2, 0.9, 1.1, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
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
              <div className="relative hidden sm:block" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-bold text-gray-500 hover:text-gray-900 hover:bg-yellow-50 transition-all duration-200"
                >
                  <div className="w-7 h-7 rounded-full bg-nurei-cta flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-gray-900" />
                  </div>
                  <span className="max-w-[80px] truncate">{user?.full_name?.split(' ')[0] || 'Perfil'}</span>
                </button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-gray-100 bg-yellow-50/50">
                        <p className="text-sm font-bold text-gray-900 truncate">{user?.full_name || 'Mi cuenta'}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{userEmail || ''}</p>
                      </div>
                      <div className="py-1.5">
                        <Link
                          href="/perfil"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-yellow-50 transition-colors"
                        >
                          <span className="flex items-center gap-2.5"><User className="w-4 h-4 text-gray-400" /> Mi perfil</span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        </Link>
                        <Link
                          href="/perfil?tab=cuenta"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-yellow-50 transition-colors"
                        >
                          <span className="flex items-center gap-2.5"><Settings className="w-4 h-4 text-gray-400" /> Configuración</span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        </Link>
                      </div>
                      <div className="py-1.5 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" /> Cerrar sesión
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
