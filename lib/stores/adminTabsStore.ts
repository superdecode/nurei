'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AdminTabItem {
  href: string
  label: string
}

interface AdminTabsState {
  tabs: AdminTabItem[]
  activeHref: string | null
  dirtyByHref: Record<string, boolean>
  openTab: (tab: AdminTabItem) => void
  closeTab: (href: string) => void
  setActive: (href: string) => void
  setDirty: (href: string, dirty: boolean) => void
  replaceActiveTab: (newHref: string, newLabel: string) => void
}

const DEFAULT_TAB: AdminTabItem = { href: '/admin', label: 'Dashboard' }

function normalizeHref(href: string) {
  const [path] = href.split('?')
  return path === '/admin/productos/new' ? '/admin/productos/new' : href
}

export const useAdminTabsStore = create<AdminTabsState>()(
  persist(
    (set, get) => ({
      tabs: [DEFAULT_TAB],
      activeHref: '/admin',
      dirtyByHref: {},
      openTab: (tab) => {
        const current = get().tabs
        const nextTab = { ...tab, href: normalizeHref(tab.href) }
        
        // Deduplication: if opening a product edit tab, check if one already exists for the same product
        if (nextTab.href.includes('/admin/productos/') && nextTab.href.includes('/edit')) {
          const productEditPathMatch = nextTab.href.match(/\/admin\/productos\/([^\/]+)\/edit/)
          if (productEditPathMatch) {
            const productId = productEditPathMatch[1]
            const existingIdx = current.findIndex((x) => x.href.includes(`/admin/productos/${productId}/edit`))
            if (existingIdx >= 0) {
              set({ activeHref: current[existingIdx].href })
              return
            }
          }
        }

        const idx = current.findIndex((x) => normalizeHref(x.href) === nextTab.href)
        if (idx >= 0) {
          const next = [...current]
          next[idx] = { ...next[idx], ...nextTab }
          set({ tabs: next, activeHref: nextTab.href })
          return
        }
        set({ tabs: [...current, nextTab], activeHref: nextTab.href })
      },
      closeTab: (href) => {
        const current = get().tabs
        const normalizedHref = normalizeHref(href)
        const next = current.filter((x) => normalizeHref(x.href) !== normalizedHref)
        const safeTabs = next.length > 0 ? next : [DEFAULT_TAB]
        const currentActive = get().activeHref
        const currentDirty = get().dirtyByHref
        const restDirty = { ...currentDirty }
        delete restDirty[normalizedHref]
        let nextActive = currentActive
        if (normalizeHref(currentActive ?? '') === normalizedHref) {
          nextActive = safeTabs[safeTabs.length - 1].href
        }
        set({ tabs: safeTabs, activeHref: nextActive ?? safeTabs[0].href, dirtyByHref: restDirty })
      },
      setActive: (href) => set({ activeHref: href }),
      setDirty: (href, dirty) => {
        const current = get().dirtyByHref
        const currentValue = !!current[href]
        if (currentValue === dirty) return
        const map = { ...current }
        if (dirty) map[href] = true
        else delete map[href]
        set({ dirtyByHref: map })
      },
      replaceActiveTab: (newHref, newLabel) => {
        const current = get().tabs
        const active = get().activeHref
        const idx = current.findIndex((x) => x.href === active)
        if (idx < 0) return
        const next = [...current]
        next[idx] = { ...next[idx], href: normalizeHref(newHref), label: newLabel }
        const dirtyByHref = { ...get().dirtyByHref }
        const previousHref = normalizeHref(active ?? '')
        const nextHref = normalizeHref(newHref)
        if (previousHref && previousHref !== nextHref && dirtyByHref[previousHref]) {
          dirtyByHref[nextHref] = dirtyByHref[previousHref]
          delete dirtyByHref[previousHref]
        }
        set({ tabs: next, activeHref: nextHref, dirtyByHref })
      },
    }),
    { name: 'nurei-admin-tabs' },
  ),
)
