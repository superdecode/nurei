'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogOut, ChevronDown, Shield, User,
  KeyRound, Eye, EyeOff, Loader2,
  LayoutDashboard, Package, ShoppingBag, Boxes, FolderTree,
  Image as ImageIcon, Ticket, CreditCard, Users, BarChart3, Settings,
  CheckCircle2,
} from 'lucide-react'
import { useAdminAuthStore } from '@/lib/stores/adminAuth'
import { useSidebarStore, SIDEBAR_W_EXPANDED, SIDEBAR_W_COLLAPSED } from '@/lib/stores/sidebarStore'
import { AdminNotificationBell } from './AdminNotificationBell'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MODULES = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: ShoppingBag, label: 'Pedidos' },
  { icon: Package, label: 'Productos' },
  { icon: Boxes, label: 'Inventario' },
  { icon: FolderTree, label: 'Categorías' },
  { icon: ImageIcon, label: 'Multimedia' },
  { icon: Ticket, label: 'Cupones' },
  { icon: CreditCard, label: 'Pagos' },
  { icon: Users, label: 'Usuarios' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Settings, label: 'Configuración' },
]

type ModalType = 'none' | 'profile' | 'password'

export function AdminTopBar() {
  const { user, logout } = useAdminAuthStore()
  const { collapsed } = useSidebarStore()
  const [userOpen, setUserOpen] = useState(false)
  const [modal, setModal] = useState<ModalType>('none')
  const menuRef = useRef<HTMLDivElement>(null)

  // Password change state
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passError, setPassError] = useState('')
  const [passSuccess, setPassSuccess] = useState(false)
  const [passLoading, setPassLoading] = useState(false)

  useEffect(() => {
    if (!userOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userOpen])

  const sidebarWidth = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED
  const initials = user?.email?.charAt(0).toUpperCase() ?? 'A'
  const emailDisplay = user?.email ?? 'admin@nurei.mx'
  const roleLabel = 'Administrador'

  const openModal = (type: ModalType) => {
    setUserOpen(false)
    setPassError('')
    setPassSuccess(false)
    setNewPass('')
    setConfirmPass('')
    setModal(type)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassError('')
    if (newPass.length < 8) { setPassError('Mínimo 8 caracteres'); return }
    if (newPass !== confirmPass) { setPassError('Las contraseñas no coinciden'); return }
    setPassLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPass }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) { setPassError(json.error ?? 'Error al cambiar contraseña'); return }
      setPassSuccess(true)
      setNewPass('')
      setConfirmPass('')
    } catch {
      setPassError('Error de conexión')
    } finally {
      setPassLoading(false)
    }
  }

  return (
    <>
      {/* ── Top bar ── */}
      <div
        className="hidden lg:flex fixed top-0 right-0 z-30 items-center gap-1 px-5 h-14 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm transition-[left] duration-300"
        style={{ left: sidebarWidth }}
      >
        <div className="flex-1" />

        <AdminNotificationBell />
        <div className="h-6 w-px bg-gray-200 mx-1" />

        {/* User trigger */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setUserOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-dark text-sm font-bold text-white">
              {initials}
            </div>
            <div className="hidden xl:block text-left leading-tight">
              <p className="text-[13px] font-semibold text-gray-900 max-w-[140px] truncate">{emailDisplay}</p>
              <p className="text-[11px] text-gray-400">{roleLabel}</p>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', userOpen && 'rotate-180')} />
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {userOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl z-[70]"
              >
                {/* Mini user card */}
                <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-dark text-base font-bold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{emailDisplay}</p>
                    <span className="inline-flex items-center gap-1 mt-0.5 rounded-full bg-primary-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-primary-dark">
                      <Shield className="h-2.5 w-2.5" /> {roleLabel}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="py-1.5">
                  <button
                    type="button"
                    onClick={() => openModal('profile')}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50"
                  >
                    <User className="h-4 w-4 text-gray-400" />
                    Mi Perfil
                  </button>
                  <button
                    type="button"
                    onClick={() => openModal('password')}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50"
                  >
                    <KeyRound className="h-4 w-4 text-gray-400" />
                    Cambiar contraseña
                  </button>
                </div>

                <div className="border-t border-gray-100 py-1.5">
                  <button
                    type="button"
                    onClick={() => { setUserOpen(false); logout() }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Backdrop ── */}
      <AnimatePresence>
        {modal !== 'none' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm"
            onClick={() => setModal('none')}
          />
        )}
      </AnimatePresence>

      {/* ── Profile modal ── */}
      <AnimatePresence>
        {modal === 'profile' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-br from-primary-dark to-[#0D2A3F] px-6 py-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl font-black text-white ring-2 ring-white/20">
                    {initials}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white truncate max-w-[240px]">{emailDisplay}</p>
                    <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary-cyan/20 px-2.5 py-0.5 text-xs font-semibold text-primary-cyan">
                      <Shield className="h-3 w-3" /> {roleLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                {/* Modules */}
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">Módulos con acceso</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MODULES.map(({ icon: Icon, label }) => (
                      <div
                        key={label}
                        className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-2 text-[11px] font-medium text-gray-700"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-primary-cyan" />
                        <span className="truncate">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Permisos summary */}
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Permisos</p>
                  <p className="text-xs">Acceso total al panel de administración — puede gestionar productos, pedidos, usuarios, inventario y configuración del sistema.</p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
                <Button
                  variant="outline"
                  className="flex-1 h-9 rounded-xl text-sm"
                  onClick={() => setModal('none')}
                >
                  Cerrar
                </Button>
                <Button
                  className="flex-1 h-9 rounded-xl text-sm gap-2"
                  onClick={() => { setModal('none'); setTimeout(() => openModal('password'), 80) }}
                >
                  <KeyRound className="h-4 w-4" />
                  Cambiar contraseña
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Change password modal ── */}
      <AnimatePresence>
        {modal === 'password' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-dark/8 text-primary-dark">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Cambiar contraseña</h2>
                    <p className="text-xs text-gray-400">Configuración de cuenta · {emailDisplay}</p>
                  </div>
                </div>

                {passSuccess ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                    <p className="text-sm font-semibold text-gray-900">Contraseña actualizada</p>
                    <p className="text-xs text-gray-400">Tu contraseña se ha cambiado correctamente.</p>
                  </div>
                ) : (
                  <form onSubmit={(e) => { void handleChangePassword(e) }} className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Nueva contraseña</label>
                      <div className="relative">
                        <Input
                          type={showNew ? 'text' : 'password'}
                          value={newPass}
                          onChange={(e) => { setNewPass(e.target.value); setPassError('') }}
                          placeholder="Mínimo 8 caracteres"
                          className="h-9 pr-10 text-sm rounded-xl border-gray-200"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Confirmar contraseña</label>
                      <div className="relative">
                        <Input
                          type={showConfirm ? 'text' : 'password'}
                          value={confirmPass}
                          onChange={(e) => { setConfirmPass(e.target.value); setPassError('') }}
                          placeholder="Repite la nueva contraseña"
                          className="h-9 pr-10 text-sm rounded-xl border-gray-200"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {passError && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-red-600 font-medium"
                        >
                          {passError}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <div className="flex gap-2 pt-1 pb-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-9 rounded-xl text-sm"
                        onClick={() => setModal('none')}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={passLoading}
                        className="flex-1 h-9 rounded-xl text-sm font-semibold"
                      >
                        {passLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {passSuccess && (
                <div className="px-6 pb-5">
                  <Button
                    className="w-full h-9 rounded-xl text-sm"
                    onClick={() => setModal('none')}
                  >
                    Listo
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
