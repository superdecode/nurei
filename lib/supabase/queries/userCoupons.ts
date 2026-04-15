import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserCoupon } from '@/types'

export async function getUserCoupons(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('user_coupons')
    .select(`
      id,
      received_at,
      used_at,
      order_id,
      coupon:coupons(*)
    `)
    .eq('user_id', userId)
    .order('received_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as UserCoupon[]
}

export async function markCouponUsed(
  supabase: SupabaseClient,
  userCouponId: string,
  orderId: string
) {
  const { error } = await supabase
    .from('user_coupons')
    .update({ used_at: new Date().toISOString(), order_id: orderId })
    .eq('id', userCouponId)
  if (error) throw error
}

export async function grantCouponToUser(
  supabase: SupabaseClient,
  userId: string,
  couponId: string
) {
  const { data, error } = await supabase
    .from('user_coupons')
    .upsert({ user_id: userId, coupon_id: couponId })
    .select()
    .single()
  if (error) throw error
  return data
}
