'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'

interface AdminUser {
  id: string
  email: string
  role: string
}

interface AdminAuthStore {
  user: AdminUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
}

export const useAdminAuthStore = create<AdminAuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (email, password) => {
        try {
          const res = await fetchWithCredentials('/api/auth/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          const json = await res.json()
          if (!res.ok) return { success: false, error: json.error }

          set({
            user: json.data.user,
            isAuthenticated: true,
            isLoading: false,
          })
          return { success: true }
        } catch {
          return { success: false, error: 'Error de conexión' }
        }
      },

      logout: async () => {
        try {
          await fetchWithCredentials('/api/auth/logout', { method: 'POST' })
        } catch { /* ignore */ }
        set({ user: null, isAuthenticated: false, isLoading: false })
      },

      checkSession: async () => {
        try {
          const res = await fetchWithCredentials('/api/auth/me')
          if (!res.ok) {
            set({ user: null, isAuthenticated: false, isLoading: false })
            return
          }
          const json = await res.json()
          if (json.data?.profile?.role === 'admin') {
            set({
              user: {
                id: json.data.profile.id,
                email: json.data.email,
                role: 'admin',
              },
              isAuthenticated: true,
              isLoading: false,
            })
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false })
          }
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },
    }),
    {
      name: 'nurei-admin-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
