'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
  collapsed: boolean
  toggle: () => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: 'nurei-sidebar-state' }
  )
)

export const SIDEBAR_W_EXPANDED = 256
export const SIDEBAR_W_COLLAPSED = 60
