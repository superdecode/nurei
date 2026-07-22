'use client'

import { create } from 'zustand'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'

export interface LoyaltyLedgerEntry {
  id: string
  delta: number
  reason: string
  order_id: string | null
  created_at: string
}

interface LoyaltyStore {
  balance: number
  lifetimePoints: number
  tier: string
  history: LoyaltyLedgerEntry[]
  loaded: boolean
  isLoading: boolean
  lastTierSeen: string | null
  fetchStatus: () => Promise<void>
  spinWheel: (cartSessionId: string, subtotalCents: number) => Promise<
    | { ok: true; prizeType: string; couponCode: string | null }
    | { ok: false; reason: string }
  >
}

export const useLoyaltyStore = create<LoyaltyStore>()((set, get) => ({
  balance: 0,
  lifetimePoints: 0,
  tier: 'curioso',
  history: [],
  loaded: false,
  isLoading: false,
  lastTierSeen: null,

  fetchStatus: async () => {
    if (get().isLoading) return
    set({ isLoading: true })
    try {
      const res = await fetchWithCredentials('/api/loyalty/status')
      if (!res.ok) {
        set({ isLoading: false, loaded: true })
        return
      }
      const json = await res.json()
      set({
        balance: json.data.balance,
        lifetimePoints: json.data.lifetime_points,
        tier: json.data.tier,
        history: json.data.history ?? [],
        loaded: true,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false, loaded: true })
    }
  },

  spinWheel: async (cartSessionId, subtotalCents) => {
    try {
      const res = await fetchWithCredentials('/api/loyalty/wheel/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart_session_id: cartSessionId, subtotal: subtotalCents }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        return { ok: false as const, reason: json.reason ?? 'server_error' }
      }
      return { ok: true as const, prizeType: json.prize_type, couponCode: json.coupon_code ?? null }
    } catch {
      return { ok: false as const, reason: 'network_error' }
    }
  },
}))
