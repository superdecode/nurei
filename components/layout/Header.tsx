'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Heart, User, LogIn, LogOut, Settings, ChevronRight, Home, UtensilsCrossed, Info, BookOpen } from 'lucide-react'
import { Container } from './Container'
import { useCartStore } from '@/lib/stores/cart'
import { useUIStore } from '@/lib/stores/ui'
import { useAuthStore } from '@/lib/stores/auth'
import { useFavoritesStore } from '@/lib/stores/favorites'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'

const desktopNavItems = [
  { href: '/', label: 'Inicio', icon: Home, exact: true },
  { href: '/menu', label: 'Menú', icon: UtensilsCrossed, exact: false },
  { href: '/guias', label: 'Guías', icon: BookOpen, exact: false },
  { href: '/nosotros', label: 'Nosotros', icon: Info, exact: false },
]

export function Header() {
  const items = useCartStore((s) => s.items)
  const openCart = useUIStore((s) => s.openCart)
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
  const pathname = usePathname()

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
    window.addEventListener('scroll', handleScroll, { passive: true })
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

  const isNavActive = (href: string, exact: boolean) =>
    exact
      ? pathname === href
      : href === '/menu'
        ? pathname.startsWith('/menu') || pathname.startsWith('/producto')
        : pathname.startsWith(href)

  const mobileNavItems = [
    { key: 'inicio', icon: Home, href: '/', isActive: pathname === '/', badge: 0 },
    { key: 'menu', icon: UtensilsCrossed, href: '/menu', isActive: pathname.startsWith('/menu') || pathname.startsWith('/producto'), badge: 0 },
    { key: 'favoritos', icon: Heart, href: '/favoritos', isActive: pathname.startsWith('/favoritos'), badge: favoritesCount },
    { key: 'carrito', icon: ShoppingBag, onClick: openCart, isActive: false, badge: itemCount },
    {
      key: 'cuenta',
      icon: mounted && isAuthenticated ? User : LogIn,
      href: mounted && isAuthenticated ? '/perfil' : '/login',
      isActive: pathname.startsWith('/perfil') || pathname.startsWith('/login'),
      badge: 0,
    },
  ]

  return (
    <header
      className={cn(
        'sticky top-0 z-50 h-14 transition-all duration-300',
        scrolled
          ? 'bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm'
          : 'bg-white/70 backdrop-blur-sm'
      )}
    >
      <Container className="flex items-center h-full gap-2">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <img
            src="/logo.png"
            alt="nurei logo"
            className="w-7 h-7 group-hover:animate-[wiggle_0.5s_ease-in-out] object-contain"
          />
          <span className="text-base font-black tracking-tight text-gray-900 hidden sm:block">
            nurei
          </span>
        </Link>

        {/* ── Mobile nav — icons only ── */}
        <div className="md:hidden flex-1 min-w-0 grid grid-cols-5">
          {mobileNavItems.map((item) => {
            const Icon = item.icon
            const inner = (
              <div
                className={cn(
                  'relative flex items-center justify-center h-11 w-full rounded-xl transition-colors duration-150',
                  item.isActive ? 'text-gray-900' : 'text-gray-400 active:bg-gray-100'
                )}
              >
                <div className="relative">
                  <Icon
                    style={{ width: item.isActive ? 22 : 20, height: item.isActive ? 22 : 20 }}
                    strokeWidth={item.isActive ? 2.5 : 1.8}
                  />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[15px] h-[15px] px-0.5 text-[8px] font-bold bg-nurei-cta text-gray-900 rounded-full leading-none">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                {item.isActive && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute bottom-1 w-1 h-1 rounded-full bg-nurei-cta"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
            )
            return 'onClick' in item && item.onClick ? (
              <button key={item.key} type="button" onClick={item.onClick} className="outline-none">
                {inner}
              </button>
            ) : (
              <Link key={item.key} href={(item as { href: string }).href} className="outline-none">
                {inner}
              </Link>
            )
          })}
        </div>

        {/* ── Desktop nav — icon + label ── */}
        <nav className="hidden md:flex items-center gap-0.5 ml-8">
          {desktopNavItems.map(({ href, label, icon: Icon, exact }) => {
            const active = isNavActive(href, exact)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-full transition-all duration-200',
                  active
                    ? 'text-gray-900 bg-nurei-cta/15 font-bold'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2.5 : 1.8} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* ── Desktop actions ── */}
        <div className="hidden md:flex items-center gap-1 ml-auto">
          {/* Favorites */}
          <Link
            href="/favoritos"
            className="relative flex items-center justify-center w-10 h-10 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-50 transition-all duration-200"
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
                  className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] font-bold bg-red-400 text-white rounded-full shadow-sm"
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
            data-cart-target="true"
            className="relative flex items-center justify-center w-10 h-10 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-yellow-50 transition-all duration-200"
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
                  className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[9px] font-bold bg-nurei-cta text-gray-900 rounded-full shadow-sm"
                >
                  {itemCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Auth */}
          {mounted && isAuthenticated ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200"
              >
                <div className="w-6 h-6 rounded-full bg-nurei-cta flex items-center justify-center">
                  <User className="w-3 h-3 text-gray-900" />
                </div>
                <span className="max-w-[72px] truncate">{user?.full_name?.split(' ')[0] || 'Perfil'}</span>
              </button>
              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-gray-100 bg-yellow-50/50">
                      <p className="text-sm font-bold text-gray-900 truncate">{user?.full_name || 'Mi cuenta'}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{userEmail || ''}</p>
                    </div>
                    <div className="py-1.5">
                      <Link href="/perfil" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-yellow-50 transition-colors">
                        <span className="flex items-center gap-2.5"><User className="w-4 h-4 text-gray-400" /> Mi perfil</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                      </Link>
                      <Link href="/perfil?tab=cuenta" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-yellow-50 transition-colors">
                        <span className="flex items-center gap-2.5"><Settings className="w-4 h-4 text-gray-400" /> Configuración</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                      </Link>
                    </div>
                    <div className="py-1.5 border-t border-gray-100">
                      <button type="button" onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-bold bg-nurei-cta text-gray-900 shadow-md shadow-nurei-cta/20 hover:shadow-lg transition-all duration-200"
            >
              <LogIn className="w-4 h-4" />
              Entrar
            </Link>
          ) : null}
        </div>

      </Container>
    </header>
  )
}
