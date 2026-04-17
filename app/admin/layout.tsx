'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package, BarChart3, LogOut, ShoppingBag, FolderTree,
  Image as ImageIcon, Settings, Menu, X, ChevronRight, Ticket,
  Users, CreditCard, Loader2, Mail, Lock, Eye, EyeOff, Boxes, UserCheck,
} from 'lucide-react'
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell'
import { AdminTopBar } from '@/components/admin/AdminTopBar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAdminAuthStore } from '@/lib/stores/adminAuth'
import { useSidebarStore, SIDEBAR_W_EXPANDED, SIDEBAR_W_COLLAPSED } from '@/lib/stores/sidebarStore'

/** Pedidos badge: only brand-new orders awaiting confirmation/first processing step. */
function countOpenOrdersFromStatusMap(counts: Record<string, number>): number {
  const needsAttentionNow = ['paid', 'confirmed']
  return needsAttentionNow.reduce((sum, status) => sum + (counts[status] ?? 0), 0)
}

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/pedidos', label: 'Pedidos', icon: Package, ordersBadge: true as const },
  { href: '/admin/productos', label: 'Productos', icon: ShoppingBag },
  { href: '/admin/inventario', label: 'Inventario', icon: Boxes },
  { href: '/admin/categorias', label: 'Categorias', icon: FolderTree },
  { href: '/admin/media', label: 'Multimedia', icon: ImageIcon },
  { href: '/admin/cupones', label: 'Cupones', icon: Ticket },
  { href: '/admin/pagos', label: 'Pagos', icon: CreditCard },
  { href: '/admin/clientes', label: 'Clientes', icon: UserCheck },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/configuracion', label: 'Configuracion', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading, login, logout, checkSession } = useAdminAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { collapsed, toggle } = useSidebarStore()
  const sidebarWidth = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED
  const [openOrdersCount, setOpenOrdersCount] = useState<number | null>(null)

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/orders/counts')
        const json = await res.json()
        if (cancelled) return
        if (!res.ok || !json?.data || typeof json.data !== 'object') {
          setOpenOrdersCount(0)
          return
        }
        setOpenOrdersCount(countOpenOrdersFromStatusMap(json.data as Record<string, number>))
      } catch {
        if (!cancelled) setOpenOrdersCount(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, pathname])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const result = await login(email, password)
    if (!result.success) {
      setError(result.error || 'Error al iniciar sesion')
    }
    setSubmitting(false)
  }

  // Loading state
  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-dark to-[#0D2A3F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-cyan animate-spin" />
      </div>
    )
  }

  // Login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-dark to-[#0D2A3F] flex items-center justify-center p-4">
        <motion.form
          onSubmit={handleLogin}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm space-y-6"
        >
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <img src="/logo.png" alt="nurei" className="w-10 h-10 object-contain" />
              <h1 className="text-3xl font-black text-primary-dark">
                nu<span className="text-primary-cyan">rei</span>
              </h1>
            </div>
            <p className="text-gray-400 text-sm">Panel de administracion</p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="Email"
                className="h-12 pl-10 border-2 focus:border-primary-cyan"
                autoFocus
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="Contrasena"
                className="h-12 pl-10 pr-10 border-2 focus:border-primary-cyan"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs text-error text-center font-medium"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-bold text-base rounded-xl"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar'}
          </Button>
        </motion.form>
      </div>
    )
  }

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b h-14 flex items-center justify-between px-4">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="nurei" className="w-6 h-6 object-contain" />
          <span className="text-lg font-black text-primary-dark">
            nu<span className="text-primary-cyan">rei</span>
          </span>
        </div>
        <AdminNotificationBell />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-white shadow-xl"
            >
              <div className="p-5 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="nurei" className="w-8 h-8 object-contain" />
                  <span className="text-xl font-black text-primary-dark">
                    nu<span className="text-primary-cyan">rei</span>
                  </span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="p-3 space-y-1">
                {NAV_ITEMS.map(({ href, label, icon: Icon, ordersBadge }) => {
                  const badge =
                    ordersBadge && openOrdersCount != null && openOrdersCount > 0 ? openOrdersCount : undefined
                  return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                      isActive(href)
                        ? 'bg-primary-cyan/10 text-primary-cyan'
                        : 'text-gray-500 hover:bg-gray-50'
                    )}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    <span className="flex-1">{label}</span>
                    {badge != null && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-primary-cyan text-primary-dark rounded-full tabular-nums">
                        {badge}
                      </span>
                    )}
                  </Link>
                  )
                })}
              </nav>
              <div className="p-3 border-t mt-auto">
                <p className="px-4 py-1 text-[10px] text-gray-400 truncate">{user?.email}</p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        className="hidden lg:flex flex-col bg-white border-r border-gray-100 fixed h-full z-40 overflow-hidden"
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Logo row */}
        <div className="flex h-14 shrink-0 items-center border-b border-gray-100 px-4">
          <div className="flex flex-1 items-center gap-2.5 overflow-hidden">
            <img src="/logo.png" alt="nurei" className="w-8 h-8 shrink-0 object-contain" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="logo-text"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden whitespace-nowrap text-xl font-black text-primary-dark"
                >
                  nu<span className="text-primary-cyan">rei</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-1.5 py-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon, ordersBadge }) => {
            const active = isActive(href)
            const badge =
              ordersBadge && openOrdersCount != null && openOrdersCount > 0 ? openOrdersCount : undefined
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-primary-cyan/10 text-primary-cyan shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                )}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      key="label"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-1 items-center overflow-hidden whitespace-nowrap"
                    >
                      <span className="flex-1">{label}</span>
                      {badge != null ? (
                        <span className="ml-auto px-2 py-0.5 text-[10px] font-bold bg-primary-cyan text-primary-dark rounded-full tabular-nums">
                          {badge}
                        </span>
                      ) : active ? (
                        <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-40" />
                      ) : null}
                    </motion.span>
                  )}
                </AnimatePresence>
                {/* badge dot in collapsed mode */}
                {collapsed && badge && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary-cyan" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-gray-100 px-1.5 py-2">
          <button
            type="button"
            onClick={logout}
            title={collapsed ? 'Cerrar sesión' : undefined}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-400 transition-all hover:bg-red-50 hover:text-red-500"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="logout-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Cerrar sesión
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Sidebar collapse toggle — sits ON the right border of the sidebar */}
      <motion.button
        type="button"
        onClick={toggle}
        title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        animate={{ left: sidebarWidth }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="hidden lg:flex fixed top-[68px] z-50 -translate-x-1/2 h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm text-gray-400 hover:border-primary-cyan/60 hover:text-primary-cyan transition-colors"
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-300', !collapsed && 'rotate-180')} />
      </motion.button>

      {/* Desktop top bar (bell + user menu) */}
      <AdminTopBar />

      {/* Content — margin matches sidebar width, same top bar height */}
      <main
        className="pt-14 min-h-screen transition-[margin] duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        {/* On mobile the sidebar is an overlay, so remove the margin */}
        <style>{`@media (max-width: 1023px) { main { margin-left: 0 !important; } }`}</style>
        <div className="p-4 sm:p-6 lg:p-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0.98 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  )
}
