'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'
import type { UserProfile, Address } from '@/types'

interface AuthStore {
  user: UserProfile | null
  email: string | null
  isAuthenticated: boolean
  isLoading: boolean
  addresses: Address[]
  isLoadingAddresses: boolean
  // Auth actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginWithGoogle: () => void
  logout: () => Promise<void>
  checkSession: () => Promise<void>
  refreshUser: () => Promise<void>
  updateProfile: (
    updates: Partial<Pick<UserProfile, 'full_name' | 'phone' | 'avatar_url'>> & Partial<{
      accepts_marketing: boolean
      accepts_email_marketing: boolean
      accepts_sms_marketing: boolean
      accepts_whatsapp_marketing: boolean
    }>,
  ) => Promise<void>
  // Address actions
  loadAddresses: () => Promise<void>
  addAddress: (address: Omit<Address, 'id' | 'created_at'>) => Promise<void>
  updateAddress: (id: string, updates: Partial<Address>) => Promise<void>
  deleteAddress: (id: string) => Promise<void>
  setDefaultAddress: (id: string) => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      email: null,
      isAuthenticated: false,
      isLoading: true,
      addresses: [],
      isLoadingAddresses: false,

      // ─── Auth ────────────────────────────────────────────────────────────

      login: async (email, password) => {
        try {
          const res = await fetchWithCredentials('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          const json = await res.json()
          if (!res.ok) return { success: false, error: json.error }

          set({
            user: json.data.user,
            email,
            isAuthenticated: true,
            isLoading: false,
          })
          return { success: true }
        } catch {
          set({ isLoading: false })
          return { success: false, error: 'Error de conexión' }
        }
      },

      register: async (name, email, password) => {
        try {
          const res = await fetchWithCredentials('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
          })
          const json = await res.json()
          if (!res.ok) return { success: false, error: json.error }

          // Auto-login after register if session returned
          if (json.data.session) {
            const profileRes = await fetchWithCredentials('/api/auth/me')
            if (profileRes.ok) {
              const profileJson = await profileRes.json()
              set({
                user: profileJson.data.profile ?? { id: json.data.user_id, full_name: name, phone: null, avatar_url: null, role: 'customer', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
                email,
                isAuthenticated: true,
                isLoading: false,
              })
            }
          }

          return { success: true }
        } catch {
          set({ isLoading: false })
          return { success: false, error: 'Error de conexión' }
        }
      },

      loginWithGoogle: () => {
        const next =
          typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}` || '/'
            : '/'
        window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`
      },

      logout: async () => {
        try {
          await fetchWithCredentials('/api/auth/logout', { method: 'POST' })
        } catch { /* ignore */ }
        set({ user: null, email: null, isAuthenticated: false, isLoading: false, addresses: [] })
      },

      checkSession: async () => {
        try {
          const res = await fetchWithCredentials('/api/auth/me')
          if (!res.ok) {
            set({ user: null, email: null, isAuthenticated: false, isLoading: false })
            return
          }
          const json = await res.json()
          const nowIso = new Date().toISOString()
          const fallbackUser: UserProfile = {
            id: json.data.id,
            full_name: null,
            phone: null,
            avatar_url: null,
            role: 'customer',
            admin_role_id: null,
            admin_role: null,
            is_active: true,
            notification_prefs: null,
            last_login_at: null,
            created_at: nowIso,
            updated_at: nowIso,
          }
          set({
            user: (json.data.profile ?? fallbackUser) as UserProfile,
            email: json.data.email ?? null,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch {
          set({ user: null, email: null, isAuthenticated: false, isLoading: false })
        }
      },

      refreshUser: async () => {
        try {
          const res = await fetchWithCredentials('/api/auth/me')
          if (!res.ok) {
            set({ user: null, email: null, isAuthenticated: false, isLoading: false })
            return
          }
          const json = await res.json()
          const nowIso = new Date().toISOString()
          const fallbackUser: UserProfile = {
            id: json.data.id,
            full_name: null,
            phone: null,
            avatar_url: null,
            role: 'customer',
            admin_role_id: null,
            admin_role: null,
            is_active: true,
            notification_prefs: null,
            last_login_at: null,
            created_at: nowIso,
            updated_at: nowIso,
          }
          set({
            user: (json.data.profile ?? fallbackUser) as UserProfile,
            email: json.data.email,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch {
          set({ isLoading: false })
        }
      },

      updateProfile: async (updates) => {
        try {
          const res = await fetchWithCredentials('/api/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })
          if (!res.ok) throw new Error('Failed to update')
          const json = await res.json()
          const row = json.data as Record<string, unknown>
          const {
            email: newEmail,
            customer: _c,
            legal_terms_accepted_at: _l,
            ...profile
          } = row
          set({
            user: profile as unknown as UserProfile,
            email: typeof newEmail === 'string' ? newEmail : get().email,
          })
        } catch {
          // Optimistic update fallback
          const current = get().user
          if (current) set({ user: { ...current, ...updates, updated_at: new Date().toISOString() } })
        }
      },

      // ─── Addresses ───────────────────────────────────────────────────────

      loadAddresses: async () => {
        set({ isLoadingAddresses: true })
        try {
          const res = await fetchWithCredentials('/api/profile/addresses')
          if (!res.ok) return
          const json = await res.json()
          set({ addresses: json.data ?? [] })
        } catch { /* ignore */ } finally {
          set({ isLoadingAddresses: false })
        }
      },

      addAddress: async (addressData) => {
        try {
          const res = await fetchWithCredentials('/api/profile/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(addressData),
          })
          if (!res.ok) throw new Error('Failed')
          const json = await res.json()
          const newAddr: Address = json.data
          // If new address is default, unset others locally
          set((state) => ({
            addresses: newAddr.is_default
              ? [...state.addresses.map((a) => ({ ...a, is_default: false })), newAddr]
              : [...state.addresses, newAddr],
          }))
        } catch {
          // Optimistic fallback
          const newAddr: Address = {
            ...addressData,
            id: `addr-${Date.now()}`,
            created_at: new Date().toISOString(),
          }
          set((state) => {
            const existing = newAddr.is_default
              ? state.addresses.map((a) => ({ ...a, is_default: false }))
              : state.addresses
            return { addresses: [...existing, newAddr] }
          })
        }
      },

      updateAddress: async (id, updates) => {
        // Optimistic update
        set((state) => ({
          addresses: state.addresses.map((a) =>
            a.id === id ? { ...a, ...updates } : updates.is_default ? { ...a, is_default: false } : a
          ),
        }))
        try {
          await fetchWithCredentials(`/api/profile/addresses/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })
        } catch { /* keep optimistic */ }
      },

      deleteAddress: async (id) => {
        const { addresses } = get()
        const wasDefault = addresses.find((a) => a.id === id)?.is_default
        const filtered = addresses.filter((a) => a.id !== id)
        if (wasDefault && filtered.length > 0) {
          filtered[0] = { ...filtered[0], is_default: true }
        }
        set({ addresses: filtered })
        try {
          await fetchWithCredentials(`/api/profile/addresses/${id}`, { method: 'DELETE' })
        } catch { /* keep optimistic */ }
      },

      setDefaultAddress: async (id) => {
        set((state) => ({
          addresses: state.addresses.map((a) => ({ ...a, is_default: a.id === id })),
        }))
        try {
          await fetchWithCredentials(`/api/profile/addresses/${id}/default`, { method: 'POST' })
        } catch { /* keep optimistic */ }
      },
    }),
    {
      name: 'nurei-auth',
      partialize: (state) => ({
        user: state.user,
        email: state.email,
        isAuthenticated: state.isAuthenticated,
        addresses: state.addresses,
      }),
    }
  )
)
