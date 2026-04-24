'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogOut, ChevronDown, Shield,
  KeyRound, Eye, EyeOff, Loader2,
  Settings, CheckCircle2,
} from 'lucide-react'
import { useAdminAuthStore } from '@/lib/stores/adminAuth'
import { useSidebarStore, SIDEBAR_W_EXPANDED, SIDEBAR_W_COLLAPSED } from '@/lib/stores/sidebarStore'
import { AdminNotificationBell } from './AdminNotificationBell'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ModalType = 'none' | 'settings'

type UserSettingsPayload = {
  id: string
  full_name: string | null
  email: string | null
  has_pedidos_module: boolean
  notification_prefs: {
    sound_enabled: boolean
    browser_notifications: boolean
    email_on_new_order: boolean
  }
}

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
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsData, setSettingsData] = useState<UserSettingsPayload | null>(null)

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

  useEffect(() => {
    if (modal !== 'settings') return
    void loadUserSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal])

  const sidebarWidth = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED
  const initials = user?.email?.charAt(0).toUpperCase() ?? 'A'
  const emailDisplay = user?.email ?? 'admin@nurei.mx'
  const userFullName = user?.full_name?.trim() || null
  const displayNameFromEmail = (() => {
    const local = emailDisplay.split('@')[0]?.trim() ?? ''
    if (!local) return 'Administrador'
    return local
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
      .join(' ')
      .trim() || 'Administrador'
  })()
  const roleLabel = 'Administrador'

  const openModal = (type: ModalType) => {
    setUserOpen(false)
    setPassError('')
    setPassSuccess(false)
    setNewPass('')
    setConfirmPass('')
    setShowNew(false)
    setShowConfirm(false)
    setModal(type)
  }

  const loadUserSettings = async () => {
    setSettingsLoading(true)
    setSettingsError('')
    try {
      const res = await fetch('/api/admin/me/preferences')
      const json = await res.json() as { data?: UserSettingsPayload; error?: string }
      if (!res.ok || !json.data) {
        setSettingsError(json.error ?? 'No se pudo cargar la configuración')
        return
      }
      setSettingsData(json.data)
    } catch {
      setSettingsError('No se pudo cargar la configuración')
    } finally {
      setSettingsLoading(false)
    }
  }

  const updateSetting = (key: 'sound_enabled' | 'browser_notifications' | 'email_on_new_order', value: boolean) => {
    setSettingsData((prev) =>
      prev
        ? {
            ...prev,
            notification_prefs: {
              ...prev.notification_prefs,
              [key]: value,
            },
          }
        : prev,
    )
  }

  const saveUserSettings = async () => {
    if (!settingsData) return
    setSettingsSaving(true)
    setSettingsError('')
    try {
      const res = await fetch('/api/admin/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_prefs: settingsData.notification_prefs }),
      })
      const json = await res.json() as { data?: { notification_prefs?: UserSettingsPayload['notification_prefs'] }; error?: string }
      if (!res.ok) {
        setSettingsError(json.error ?? 'No se pudo guardar')
        return
      }
      if (json.data?.notification_prefs) {
        setSettingsData((prev) => (prev ? { ...prev, notification_prefs: json.data!.notification_prefs! } : prev))
      }
      setModal('none')
    } catch {
      setSettingsError('No se pudo guardar')
    } finally {
      setSettingsSaving(false)
    }
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
              <p className="text-[13px] font-semibold text-gray-900 max-w-[140px] truncate">{userFullName || displayNameFromEmail}</p>
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
                    <p className="truncate text-sm font-semibold text-gray-900">{userFullName || displayNameFromEmail}</p>
                    <span className="inline-flex items-center gap-1 mt-0.5 rounded-full bg-primary-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-primary-dark">
                      <Shield className="h-2.5 w-2.5" /> {roleLabel}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="py-1.5">
                  <button
                    type="button"
                    onClick={() => openModal('settings')}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4 text-gray-400" />
                    Configuración
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

      {/* ── Unified settings modal ── */}
      <AnimatePresence>
        {modal === 'settings' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Amber header */}
              <div className="bg-gradient-to-br from-amber-400 via-amber-400 to-yellow-300 px-6 py-5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-950/10 ring-2 ring-amber-950/10 text-amber-950 font-black text-xl">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-950 truncate max-w-[240px]">
                      {settingsData?.full_name?.trim() || userFullName || displayNameFromEmail}
                    </p>
                    <p className="text-xs text-amber-900/70 truncate">{settingsData?.email || emailDisplay}</p>
                  </div>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {settingsLoading ? (
                  <div className="py-10 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    {/* ── Notifications section ── */}
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-2 px-0.5">Notificaciones</p>
                      <div className="space-y-2">
                        {([
                          {
                            key: 'sound_enabled' as const,
                            title: 'Sonido al llegar pedido',
                            hint: 'Alerta sonora para nuevos pedidos.',
                            disabled: false,
                          },
                          {
                            key: 'browser_notifications' as const,
                            title: 'Notificaciones del navegador',
                            hint: 'Notificación push cuando haya un pedido nuevo.',
                            disabled: false,
                          },
                          {
                            key: 'email_on_new_order' as const,
                            title: 'Correo de pedido nuevo',
                            hint: settingsData?.has_pedidos_module
                              ? 'Se enviará al correo de tu cuenta.'
                              : 'Deshabilitado: tu rol no tiene módulo de Pedidos.',
                            disabled: !settingsData?.has_pedidos_module,
                          },
                        ]).map((item) => (
                          <div
                            key={item.key}
                            className={cn(
                              'flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5',
                              item.disabled ? 'border-gray-100 bg-gray-50 opacity-70' : 'border-gray-200 bg-white',
                            )}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{item.hint}</p>
                            </div>
                            <button
                              type="button"
                              disabled={item.disabled}
                              className={cn(
                                'relative shrink-0 h-6 w-11 rounded-full transition-colors',
                                settingsData?.notification_prefs?.[item.key] ? 'bg-primary-cyan' : 'bg-gray-300',
                                item.disabled && 'cursor-not-allowed',
                              )}
                              onClick={() =>
                                updateSetting(item.key, !(settingsData?.notification_prefs?.[item.key] ?? false))
                              }
                            >
                              <span
                                className={cn(
                                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                                  settingsData?.notification_prefs?.[item.key] ? 'left-5' : 'left-0.5',
                                )}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Password section ── */}
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-2 px-0.5">Seguridad</p>
                      {passSuccess ? (
                        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-emerald-800">Contraseña actualizada</p>
                            <p className="text-xs text-emerald-600/80">Tu contraseña fue cambiada correctamente.</p>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={(e) => { void handleChangePassword(e) }} className="space-y-2.5">
                          <div className="relative">
                            <Input
                              type={showNew ? 'text' : 'password'}
                              value={newPass}
                              onChange={(e) => { setNewPass(e.target.value); setPassError('') }}
                              placeholder="Nueva contraseña (mín. 8 caracteres)"
                              className="h-9 pr-10 text-sm rounded-xl border-gray-200"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNew((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <div className="relative">
                            <Input
                              type={showConfirm ? 'text' : 'password'}
                              value={confirmPass}
                              onChange={(e) => { setConfirmPass(e.target.value); setPassError('') }}
                              placeholder="Confirmar nueva contraseña"
                              className="h-9 pr-10 text-sm rounded-xl border-gray-200"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirm((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
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
                          <Button
                            type="submit"
                            disabled={passLoading || !newPass}
                            variant="outline"
                            className="w-full h-9 rounded-xl text-sm gap-2"
                          >
                            {passLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                            Cambiar contraseña
                          </Button>
                        </form>
                      )}
                    </div>

                    {settingsError && <p className="text-xs text-red-600 font-medium">{settingsError}</p>}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-2 border-t border-gray-100 px-5 py-4 shrink-0">
                <Button
                  variant="outline"
                  className="flex-1 h-9 rounded-xl text-sm"
                  onClick={() => setModal('none')}
                  disabled={settingsSaving}
                >
                  Cerrar
                </Button>
                <Button
                  className="flex-1 h-9 rounded-xl text-sm gap-2"
                  onClick={saveUserSettings}
                  disabled={settingsLoading || settingsSaving || !settingsData}
                >
                  {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                  Guardar
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
