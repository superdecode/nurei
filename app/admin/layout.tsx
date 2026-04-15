'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package, BarChart3, LogOut, ShoppingBag, FolderTree,
  Image as ImageIcon, Settings, Menu, X, Bell, ChevronRight, Ticket, Upload,
  Users, CreditCard, Boxes,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/pedidos', label: 'Pedidos', icon: Package, badge: 3 },
  { href: '/admin/productos', label: 'Productos', icon: ShoppingBag },
  { href: '/admin/categorias', label: 'Categorías', icon: FolderTree },
  { href: '/admin/media', label: 'Multimedia', icon: ImageIcon },
  { href: '/admin/cupones', label: 'Cupones', icon: Ticket },
  { href: '/admin/pagos', label: 'Pagos', icon: CreditCard },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('nurei-admin-token')
    if (token) setAuthenticated(true)
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === 'nurei2024' || password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      localStorage.setItem('nurei-admin-token', 'authenticated')
      setAuthenticated(true)
    } else {
      setError(true)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('nurei-admin-token')
    setAuthenticated(false)
    setPassword('')
  }

  if (!authenticated) {
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
            <h1 className="text-3xl font-black text-primary-dark">
              nu<span className="text-primary-cyan">rei</span>
            </h1>
            <p className="text-gray-400 text-sm mt-2">Panel de administración</p>
          </div>

          <div className="space-y-3">
            <Input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false) }}
              placeholder="Contraseña"
              className="h-12 border-2 focus:border-primary-cyan text-center text-lg"
              autoFocus
            />
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs text-error text-center"
                >
                  Contraseña incorrecta
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-bold text-base rounded-xl"
          >
            Entrar
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b h-14 flex items-center justify-between px-4">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-lg font-black text-primary-dark">
          nu<span className="text-primary-cyan">rei</span>
        </span>
        <div className="relative">
          <Bell className="w-5 h-5 text-gray-400" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary-cyan rounded-full" />
        </div>
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
                <span className="text-xl font-black text-primary-dark">
                  nu<span className="text-primary-cyan">rei</span>
                </span>
                <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="p-3 space-y-1">
                {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                      isActive(href)
                        ? 'bg-primary-cyan/10 text-primary-cyan'
                        : 'text-gray-500 hover:bg-gray-50'
                    )}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    <span className="flex-1">{label}</span>
                    {badge && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-primary-cyan text-primary-dark rounded-full">
                        {badge}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-100 fixed h-full z-40">
        <div className="p-6 pb-4">
          <span className="text-xl font-black text-primary-dark">
            nu<span className="text-primary-cyan">rei</span>
          </span>
          <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest">Admin Panel</p>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive(href)
                  ? 'bg-primary-cyan/10 text-primary-cyan shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span className="flex-1">{label}</span>
              {badge ? (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-primary-cyan text-primary-dark rounded-full animate-pulse">
                  {badge}
                </span>
              ) : (
                isActive(href) && <ChevronRight className="w-3.5 h-3.5 opacity-50" />
              )}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  )
}
