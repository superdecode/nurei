'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminTabsStore } from '@/lib/stores/adminTabsStore'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

type NavItem = { href: string; label: string }

function resolveLabel(pathname: string, navItems: NavItem[]) {
  if (pathname.startsWith('/admin/productos/new')) return 'Nuevo producto'
  if (pathname.startsWith('/admin/productos/') && pathname.endsWith('/edit')) return 'Editar producto'
  if (pathname.startsWith('/admin/pedidos/') && pathname !== '/admin/pedidos') {
    const rawId = pathname.split('/').filter(Boolean).pop() ?? ''
    const orderRef = rawId.slice(-6).toUpperCase()
    return orderRef ? `Detalle orden ${orderRef}` : 'Detalle orden'
  }
  if (pathname.startsWith('/admin/clientes/') && pathname !== '/admin/clientes') return 'Detalle cliente'

  const sorted = [...navItems].sort((a, b) => b.href.length - a.href.length)
  const hit = sorted.find((item) => {
    if (item.href === '/admin') return pathname === '/admin'
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  })
  return hit?.label ?? 'Admin'
}

export function AdminWorkspaceTabs({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { tabs, activeHref, openTab, closeTab, setActive, dirtyByHref } = useAdminTabsStore()
  const [confirmCloseHref, setConfirmCloseHref] = useState<string | null>(null)

  const query = searchParams.toString()
  const fullHref = query ? `${pathname}?${query}` : pathname
  const label = useMemo(() => {
    const base = resolveLabel(pathname, navItems)
    if (!pathname.startsWith('/admin/productos/new')) return base
    const tabNumber = searchParams.get('tab')
    if (!tabNumber) return base
    const n = Number(tabNumber)
    return Number.isFinite(n) && n > 0 ? `${base} ${n}` : `${base} ${tabNumber}`
  }, [pathname, navItems, searchParams])

  useEffect(() => {
    if (pathname.startsWith('/admin/productos/new') && !searchParams.get('tab')) return
    openTab({ href: fullHref, label })
    setActive(fullHref)
  }, [fullHref, label, openTab, pathname, searchParams, setActive])

  return (
    <>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max py-1">
        {tabs.map((tab) => {
          const isActive = (activeHref ?? fullHref) === tab.href
          return (
            <div
              key={tab.href}
              className={cn(
                'group inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                isActive
                  ? 'border-primary-dark bg-primary-dark text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
              )}
            >
              <Link
                href={tab.href}
                className="max-w-[180px] truncate"
                onClick={() => setActive(tab.href)}
              >
                {tab.label}
              </Link>
              {tab.href !== '/admin' && (
                <button
                  type="button"
                  className={cn(
                    'rounded-full p-0.5 transition-colors',
                    isActive ? 'hover:bg-white/20' : 'hover:bg-gray-200',
                  )}
                  onClick={() => {
                    const wasActive = (activeHref ?? fullHref) === tab.href
                    const hasUnsaved = !!dirtyByHref[tab.href]
                    if (hasUnsaved && tab.href.startsWith('/admin/productos/new')) {
                      setConfirmCloseHref(tab.href)
                      return
                    }
                    closeTab(tab.href)
                    if (wasActive) {
                      const remaining = tabs.filter((t) => t.href !== tab.href)
                      router.push((remaining[remaining.length - 1]?.href) ?? '/admin')
                    }
                  }}
                  aria-label={`Cerrar ${tab.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )
        })}
        </div>
      </div>
      <Dialog open={!!confirmCloseHref} onOpenChange={(open) => { if (!open) setConfirmCloseHref(null) }}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogTitle className="text-base font-bold text-gray-900">Cerrar pestaña con cambios</DialogTitle>
          <p className="text-sm text-gray-500 mt-2">
            Esta pestaña tiene datos sin guardar. Si la cierras, perderás la información no guardada. ¿Deseas continuar?
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              className="h-9 px-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              onClick={() => setConfirmCloseHref(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700"
              onClick={() => {
                if (!confirmCloseHref) return
                const wasActive = (activeHref ?? fullHref) === confirmCloseHref
                closeTab(confirmCloseHref)
                if (wasActive) {
                  const remaining = tabs.filter((t) => t.href !== confirmCloseHref)
                  router.push((remaining[remaining.length - 1]?.href) ?? '/admin')
                }
                setConfirmCloseHref(null)
              }}
            >
              Sí, cerrar pestaña
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
