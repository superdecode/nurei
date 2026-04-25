'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, ShoppingBag, CreditCard, User, LogOut, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAffiliateAuthStore } from '@/lib/stores/affiliateAuth'

const NAV = [
  { href: '/affiliate/overview', label: 'Resumen', icon: BarChart3 },
  { href: '/affiliate/ventas', label: 'Ventas', icon: ShoppingBag },
  { href: '/affiliate/pagos', label: 'Pagos', icon: CreditCard },
  { href: '/affiliate/perfil', label: 'Perfil', icon: User },
]

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, isLoading, checkSession, logout } = useAffiliateAuthStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => { checkSession() }, [checkSession])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/affiliates/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-dark to-[#0D2A3F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-cyan animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  const isActive = (href: string) => pathname.startsWith(href)
  const initial = user?.handle?.slice(0, 1).toUpperCase() ?? '?'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b h-14 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="nurei" className="w-7 h-7 object-contain" />
          <span className="text-lg font-black text-primary-dark">
            nu<span className="text-primary-cyan">rei</span>
            <span className="text-xs font-medium text-gray-400 ml-2">afiliados</span>
          </span>
        </div>

        {/* User popover trigger */}
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary-cyan/10 flex items-center justify-center text-xs font-bold text-primary-cyan shrink-0">
              {initial}
            </div>
            <span className="text-sm text-gray-600 font-medium hidden sm:block">@{user?.handle}</span>
            <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', profileOpen && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden"
              >
                {/* Profile summary */}
                <div className="p-4 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-cyan/10 flex items-center justify-center text-sm font-bold text-primary-cyan shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-primary-dark text-sm">@{user?.handle}</p>
                        <span className="px-1.5 py-0.5 rounded-full bg-primary-cyan/10 text-primary-cyan text-[9px] font-bold uppercase tracking-wide">
                          Afiliado
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-2">
                  <Link
                    href="/affiliate/perfil"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 w-full"
                  >
                    <User className="w-4 h-4 text-gray-400" />
                    Ir a Perfil
                  </Link>
                  <button
                    type="button"
                    onClick={async () => { await logout(); setProfileOpen(false) }}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors text-sm font-medium text-red-500 w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors',
                isActive(href)
                  ? 'border-primary-cyan text-primary-cyan'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:block">{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <motion.div
          key={pathname}
          initial={{ opacity: 0.95 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}
