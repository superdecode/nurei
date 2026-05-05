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
}

const DEFAULT_TAB: AdminTabItem = { href: '/admin', label: 'Dashboard' }

export const useAdminTabsStore = create<AdminTabsState>()(
  persist(
    (set, get) => ({
      tabs: [DEFAULT_TAB],
      activeHref: '/admin',
      dirtyByHref: {},
      openTab: (tab) => {
        const current = get().tabs
        
        // Deduplication: if opening a product edit tab, check if one already exists for the same product
        if (tab.href.includes('/admin/productos/') && tab.href.includes('/edit')) {
          const productEditPathMatch = tab.href.match(/\/admin\/productos\/([^\/]+)\/edit/)
          if (productEditPathMatch) {
            const productId = productEditPathMatch[1]
            const existingIdx = current.findIndex((x) => x.href.includes(`/admin/productos/${productId}/edit`))
            if (existingIdx >= 0) {
              set({ activeHref: current[existingIdx].href })
              return
            }
          }
        }

        const idx = current.findIndex((x) => x.href === tab.href)
        if (idx >= 0) {
          const next = [...current]
          next[idx] = { ...next[idx], label: tab.label }
          set({ tabs: next, activeHref: tab.href })
          return
        }
        set({ tabs: [...current, tab], activeHref: tab.href })
      },
      closeTab: (href) => {
        const current = get().tabs
        const next = current.filter((x) => x.href !== href)
        const safeTabs = next.length > 0 ? next : [DEFAULT_TAB]
        const currentActive = get().activeHref
        const currentDirty = get().dirtyByHref
        const restDirty = { ...currentDirty }
        delete restDirty[href]
        let nextActive = currentActive
        if (href === currentActive) {
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
    }),
    { name: 'nurei-admin-tabs' },
  ),
)
