'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  ExternalLink,
  X,
  AlertTriangle,
  CheckCircle,
  Trash2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type NotificationPriority = 'alta' | 'media' | 'baja'
type NotificationType = 'stock_bajo' | 'stock_agotado' | 'nuevo_pedido'

type NotificationItem = {
  id: string
  type: NotificationType
  title: string
  message: string
  href?: string
  created_at: string
  priority: NotificationPriority
}

const POPUP_DURATION = 5000
const MAX_INDIVIDUAL_POPUPS = 3
const LS_KEY = 'nurei-admin-notif-read'
const SOUND_UNLOCK_KEY = 'nurei-admin-sound-unlocked'

type NotificationPrefs = {
  sound_enabled: boolean
  browser_notifications: boolean
  email_on_new_order: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  sound_enabled: true,
  browser_notifications: true,
  email_on_new_order: true,
}

function getReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(LS_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>) {
  if (typeof window === 'undefined') return
  const arr = Array.from(ids).slice(-200)
  localStorage.setItem(LS_KEY, JSON.stringify(arr))
}

function getIcon(type: NotificationType, priority: NotificationPriority) {
  if (type === 'nuevo_pedido') return <span className="text-lg leading-none">🛒</span>
  if (type === 'stock_agotado') return <AlertCircle className="h-[18px] w-[18px] text-red-500" />
  if (type === 'stock_bajo') return <AlertTriangle className="h-[18px] w-[18px] text-amber-500" />
  if (priority === 'alta') return <AlertCircle className="h-[18px] w-[18px] text-red-500" />
  return <Bell className="h-[18px] w-[18px] text-primary-cyan" />
}

async function playOrderSound(audioCtxRef: MutableRefObject<AudioContext | null>) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = audioCtxRef.current ?? new Ctx()
    audioCtxRef.current = ctx
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    const play = (freq: number, start: number, duration: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(0, ctx.currentTime + start)
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }
    play(523, 0, 0.12)
    play(659, 0.13, 0.12)
    play(784, 0.26, 0.18)
    play(1047, 0.44, 0.25)
    return true
  } catch {
    return false
  }
}

function getInitialSoundUnlocked() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(SOUND_UNLOCK_KEY) === '1'
}

const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  alta: 'ALTA',
  media: 'MEDIA',
  baja: 'BAJA',
}
const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  alta: 'bg-red-100 text-red-800',
  media: 'bg-amber-100 text-amber-800',
  baja: 'bg-blue-100 text-blue-800',
}
const POPUP_BORDER: Record<NotificationPriority, string> = {
  alta: 'border-l-4 border-l-red-500',
  media: 'border-l-4 border-l-amber-500',
  baja: 'border-l-4 border-l-blue-500',
}

type PopupItem =
  | ({ popupType: 'individual' } & NotificationItem)
  | { popupType: 'consolidated'; count: number; id: 'consolidated'; hasOrders?: boolean; orderCount?: number }

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'unread' | 'all'>('unread')
  const [items, setItems] = useState<NotificationItem[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadIds())
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [popups, setPopups] = useState<PopupItem[]>([])
  const [popupsClosing, setPopupsClosing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleBlinkRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const baseTitleRef = useRef<string | null>(null)
  const prevItemIdsRef = useRef<Set<string>>(new Set())
  const audioCtxRef = useRef<AudioContext | null>(null)
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [soundUnlocked, setSoundUnlocked] = useState<boolean>(getInitialSoundUnlocked())
  const [titleAttention, setTitleAttention] = useState(false)

  const unlockSound = useCallback(async () => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = audioCtxRef.current ?? new Ctx()
      audioCtxRef.current = ctx
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.value = 0.00001
      o.frequency.value = 440
      o.start()
      o.stop(ctx.currentTime + 0.01)
      window.localStorage.setItem(SOUND_UNLOCK_KEY, '1')
      setSoundUnlocked(true)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const onUserInteract = () => {
      void unlockSound()
      window.removeEventListener('pointerdown', onUserInteract)
      window.removeEventListener('keydown', onUserInteract)
      window.removeEventListener('touchstart', onUserInteract)
    }
    window.addEventListener('pointerdown', onUserInteract, { passive: true })
    window.addEventListener('keydown', onUserInteract, { passive: true })
    window.addEventListener('touchstart', onUserInteract, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onUserInteract)
      window.removeEventListener('keydown', onUserInteract)
      window.removeEventListener('touchstart', onUserInteract)
    }
  }, [unlockSound])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me')
        const json = await res.json()
        const raw = (json?.data?.profile?.notification_prefs ?? {}) as Record<string, unknown>
        setPrefs({
          sound_enabled: raw.sound_enabled !== false,
          browser_notifications: raw.browser_notifications !== false,
          email_on_new_order: raw.email_on_new_order !== false,
        })
      } catch {
        setPrefs(DEFAULT_PREFS)
      }
    })()
  }, [])


  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveReadIds(next)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev)
      items.forEach((i) => next.add(i.id))
      saveReadIds(next)
      return next
    })
  }, [items])

  const removeItem = useCallback(
    (id: string) => {
      setDeletedIds((prev) => new Set([...prev, id]))
      markRead(id)
    },
    [markRead]
  )

  const notifyBrowserNewOrder = useCallback((item: NotificationItem) => {
    if (!prefs.browser_notifications || typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'granted') {
      new Notification(item.title, {
        body: item.message,
        tag: item.id,
      })
      return
    }
    if (Notification.permission === 'default') {
      void Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          new Notification(item.title, { body: item.message, tag: item.id })
        }
      })
    }
  }, [prefs.browser_notifications])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications')
      const json = await res.json()
      const next: NotificationItem[] = json.data?.items ?? []
      setItems(next)

      const currentRead = getReadIds()
      const newCritical = next.filter(
        (i) =>
          (i.priority === 'alta' || i.type === 'stock_agotado' || i.type === 'nuevo_pedido') &&
          !currentRead.has(i.id) &&
          !prevItemIdsRef.current.has(i.id)
      )

      if (newCritical.length > 0 && !open) {
        if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
        setPopupsClosing(false)

        const hasNewOrder = newCritical.some(i => i.type === 'nuevo_pedido')
        if (hasNewOrder && prevItemIdsRef.current.size > 0) {
          let soundPlayed = false
          if (prefs.sound_enabled && soundUnlocked) {
            soundPlayed = await playOrderSound(audioCtxRef)
          }
          if (!soundPlayed) {
            setTitleAttention(true)
          }
          const firstOrder = newCritical.find((i) => i.type === 'nuevo_pedido')
          if (firstOrder) notifyBrowserNewOrder(firstOrder)
        }

        if (newCritical.length <= MAX_INDIVIDUAL_POPUPS) {
          setPopups(newCritical.map((n) => ({ ...n, popupType: 'individual' as const })))
        } else {
          const orderCount = newCritical.filter(i => i.type === 'nuevo_pedido').length
          setPopups([{ popupType: 'consolidated', count: newCritical.length, id: 'consolidated', hasOrders: orderCount > 0, orderCount }])
        }

        popupTimerRef.current = setTimeout(() => {
          setPopupsClosing(true)
          setTimeout(() => {
            setPopups([])
            setPopupsClosing(false)
          }, 300)
        }, POPUP_DURATION)
      }

      prevItemIdsRef.current = new Set(next.map((n) => n.id))
    } catch {
      /* ignore */
    }
  }, [notifyBrowserNewOrder, open, prefs.sound_enabled, soundUnlocked])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const id = window.setInterval(() => { void load() }, 20_000)
    return () => {
      window.clearInterval(id)
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
    }
  }, [load])

  useEffect(() => {
    const hasUnreadOrder = items.some(
      (item) => item.type === 'nuevo_pedido' && !readIds.has(item.id) && !deletedIds.has(item.id)
    )
    if (!hasUnreadOrder || open) {
      setTitleAttention(false)
    } else {
      setTitleAttention(true)
    }
  }, [deletedIds, items, open, readIds])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!titleAttention) {
      if (titleBlinkRef.current) {
        clearInterval(titleBlinkRef.current)
        titleBlinkRef.current = null
      }
      if (baseTitleRef.current) {
        document.title = baseTitleRef.current
      }
      return
    }

    if (!baseTitleRef.current) {
      baseTitleRef.current = document.title
    }

    let toggle = false
    titleBlinkRef.current = setInterval(() => {
      document.title = toggle ? '🔔 Nueva orden | Nurei' : (baseTitleRef.current ?? 'Nurei')
      toggle = !toggle
    }, 1000)

    return () => {
      if (titleBlinkRef.current) {
        clearInterval(titleBlinkRef.current)
        titleBlinkRef.current = null
      }
      if (baseTitleRef.current) {
        document.title = baseTitleRef.current
      }
    }
  }, [titleAttention])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin-orders-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        void load()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const visibleItems = useMemo(() => {
    return items.filter((i) => !deletedIds.has(i.id))
  }, [items, deletedIds])

  const unreadItems = useMemo(
    () => visibleItems.filter((i) => !readIds.has(i.id)),
    [visibleItems, readIds]
  )

  const tabItems = tab === 'unread' ? unreadItems : visibleItems

  const unreadCount = unreadItems.length
  const badge = unreadCount > 0 ? (unreadCount > 9 ? '9+' : String(unreadCount)) : null

  const dismissPopup = (id: string) => {
    setPopups((prev) => prev.filter((p) => p.id !== id))
    if (id !== 'consolidated') markRead(id)
  }

  const dismissAllPopups = () => {
    setPopupsClosing(true)
    setTimeout(() => {
      setPopups([])
      setPopupsClosing(false)
    }, 300)
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
  }

  return (
    <>
      <div className="relative" ref={panelRef}>
        <button
          ref={bellRef}
          type="button"
          aria-label="Notificaciones"
          onClick={() => {
            setOpen((v) => !v)
            if (!open) load()
          }}
          className="relative rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <Bell className="h-[22px] w-[22px]" />
          {badge && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {badge}
            </span>
          )}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="absolute right-0 top-full z-[300] mt-2 w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              style={{ maxHeight: '600px' }}
            >
              {/* Header */}
              <div className="border-b border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Notificaciones</h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-xs font-medium text-primary-cyan hover:text-primary-cyan/80"
                      >
                        Marcar todas leídas
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                      onClick={() => setOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* Tabs */}
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setTab('unread')}
                    className={cn(
                      'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      tab === 'unread'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    )}
                  >
                    No leídas{' '}
                    {unreadCount > 0 && (
                      <span className="ml-1 rounded-full bg-primary-cyan/20 px-1.5 py-0.5 text-xs text-primary-dark">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('all')}
                    className={cn(
                      'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      tab === 'all'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    )}
                  >
                    Todas
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: '420px' }}>
                {tabItems.length === 0 ? (
                  <div className="py-10 text-center">
                    <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
                    <p className="font-medium text-slate-600">
                      {tab === 'unread' ? '¡Todo al día!' : 'Sin notificaciones'}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {tab === 'unread'
                        ? 'No tienes notificaciones sin leer'
                        : 'No hay notificaciones registradas'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {tabItems.map((item) => {
                      const unread = !readIds.has(item.id)
                      return (
                        <Link
                          key={item.id}
                          href={item.href ?? (item.type === 'nuevo_pedido' ? '/admin/pedidos' : '/admin/inventario')}
                          onClick={() => {
                            markRead(item.id)
                            setOpen(false)
                          }}
                          className={cn(
                            'group flex cursor-pointer items-start gap-3 px-4 py-3.5 transition hover:bg-slate-50',
                            item.type === 'nuevo_pedido' && 'border-l-4 border-l-nurei-cta pl-3 bg-nurei-warm/40',
                            item.priority === 'alta' && item.type !== 'nuevo_pedido' && 'border-l-4 border-l-red-500 pl-3',
                            !unread && 'opacity-60'
                          )}
                        >
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                            {getIcon(item.type, item.priority)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <p
                                className={cn(
                                  'text-sm text-slate-900',
                                  unread ? 'font-semibold' : 'font-medium'
                                )}
                              >
                                {item.title}
                              </p>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <span
                                  className={cn(
                                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                    PRIORITY_COLORS[item.priority]
                                  )}
                                >
                                  {PRIORITY_LABELS[item.priority]}
                                </span>
                                <button
                                  type="button"
                                  title="Eliminar"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    removeItem(item.id)
                                  }}
                                  className="rounded p-1 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-100"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </button>
                              </div>
                            </div>
                            <p className="line-clamp-2 text-xs text-slate-500">{item.message}</p>
                            <div className="mt-1.5 flex items-center gap-3">
                              <p className="text-[11px] text-slate-400">
                                {new Date(item.created_at).toLocaleString('es-MX', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                              {unread && (
                                <span className="inline-block h-2 w-2 rounded-full bg-primary-cyan" />
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  markRead(item.id)
                                }}
                                className="ml-auto flex items-center gap-0.5 text-[11px] font-medium text-slate-400 hover:text-primary-cyan"
                              >
                                <CheckCircle className="h-3 w-3" /> Resolver
                              </button>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 flex items-center justify-center gap-4">
                <Link href="/admin/pedidos" className="text-xs font-semibold text-primary-dark hover:underline" onClick={() => setOpen(false)}>
                  Ver pedidos
                </Link>
                <span className="text-slate-200">·</span>
                <Link href="/admin/inventario" className="text-xs font-semibold text-primary-dark hover:underline" onClick={() => setOpen(false)}>
                  Ver inventario
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Popup toasts */}
      <div
        className={cn(
          'pointer-events-none fixed right-4 top-20 z-[9998] flex max-w-sm flex-col gap-2 transition-all duration-300',
          popupsClosing && 'translate-x-4 opacity-0'
        )}
      >
        <AnimatePresence>
          {popups.map((popup, idx) => (
            <motion.div
              key={popup.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.22, delay: idx * 0.08 }}
              className={cn(
                'pointer-events-auto rounded-xl border border-slate-200 bg-white shadow-xl',
                popup.popupType === 'individual' &&
                  POPUP_BORDER[(popup as NotificationItem).priority]
              )}
            >
              {popup.popupType === 'consolidated' ? (
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', popup.hasOrders ? 'bg-nurei-cta/20 text-xl' : 'bg-primary-cyan/10')}>
                      {popup.hasOrders ? '🛒' : <Bell className="h-5 w-5 text-primary-cyan" />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {popup.hasOrders && popup.orderCount ? `${popup.orderCount} nuevo${popup.orderCount > 1 ? 's' : ''} pedido${popup.orderCount > 1 ? 's' : ''}` : `${popup.count} nuevas alertas`}
                      </p>
                      <button
                        type="button"
                        onClick={() => { setOpen(true); dismissAllPopups() }}
                        className="mt-0.5 flex items-center gap-1 text-sm font-medium text-primary-cyan"
                      >
                        Ver {popup.hasOrders ? 'pedidos' : 'todas'} <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => dismissPopup(popup.id)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className={cn('p-4', popup.type === 'nuevo_pedido' && 'bg-gradient-to-br from-nurei-warm to-white')}>
                  {popup.type === 'nuevo_pedido' && (
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-nurei-cta px-2.5 py-0.5 text-[10px] font-black text-gray-900 animate-pulse">
                        ● NUEVO PEDIDO
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg', popup.type === 'nuevo_pedido' ? 'bg-nurei-cta/20' : 'bg-slate-100')}>
                      {getIcon(popup.type, popup.priority)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900 truncate">{popup.title}</p>
                      <p className="mt-0.5 text-sm text-slate-600 line-clamp-2">{popup.message}</p>
                    </div>
                    <button type="button" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => dismissPopup(popup.id)}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-3 flex justify-end">
                    <Link
                      href={popup.href ?? '/admin/pedidos'}
                      className={cn('flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold', popup.type === 'nuevo_pedido' ? 'bg-nurei-cta text-gray-900 hover:bg-nurei-cta-hover' : 'bg-primary-dark text-white hover:bg-primary-dark/90')}
                      onClick={() => dismissPopup(popup.id)}
                    >
                      {popup.type === 'nuevo_pedido' ? 'Ver pedido' : 'Ir al módulo'} <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}
