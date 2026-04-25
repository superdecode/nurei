import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'

interface AffiliateUser {
  id: string
  email: string
  handle: string
}

interface AffiliateAuthState {
  user: AffiliateUser | null
  isAuthenticated: boolean
  isLoading: boolean
  checkSession: () => Promise<void>
  logout: () => Promise<void>
}

export const useAffiliateAuthStore = create<AffiliateAuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  checkSession: async () => {
    set({ isLoading: true })
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      set({ user: null, isAuthenticated: false, isLoading: false })
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: affiliateProfile } = await supabase
      .from('affiliate_profiles')
      .select('handle')
      .eq('id', user.id)
      .maybeSingle()

    // Allow access if either role is affiliate OR affiliate profile exists.
    // This avoids login loops for legacy accounts with incomplete role backfill.
    const hasAffiliateAccess = profile?.role === 'affiliate' || Boolean(affiliateProfile)
    if (!hasAffiliateAccess) {
      set({ user: null, isAuthenticated: false, isLoading: false })
      return
    }

    set({
      user: { id: user.id, email: user.email!, handle: affiliateProfile?.handle ?? '' },
      isAuthenticated: true,
      isLoading: false,
    })
  },

  logout: async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    set({ user: null, isAuthenticated: false })
  },
}))
