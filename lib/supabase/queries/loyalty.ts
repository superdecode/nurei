import type { SupabaseClient } from '@supabase/supabase-js'

export interface LoyaltyStatus {
  balance: number
  lifetime_points: number
  tier: string
  active_multiplier_expires_at: string | null
}

export async function getLoyaltyStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<LoyaltyStatus> {
  const { data, error } = await supabase
    .from('loyalty_points')
    .select('balance, lifetime_points, tier, active_multiplier_expires_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (
    data ?? { balance: 0, lifetime_points: 0, tier: 'curioso', active_multiplier_expires_at: null }
  )
}

export interface LoyaltyLedgerEntry {
  id: string
  delta: number
  reason: string
  order_id: string | null
  created_at: string
}

export async function getLedgerHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<LoyaltyLedgerEntry[]> {
  const { data, error } = await supabase
    .from('loyalty_ledger')
    .select('id, delta, reason, order_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}
