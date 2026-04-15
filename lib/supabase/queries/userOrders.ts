import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order, OrderUpdate, OrderStatus } from '@/types'

export async function getUserOrders(
  supabase: SupabaseClient,
  userId: string,
  status?: OrderStatus
) {
  let query = supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Order[]
}

export async function getOrderById(supabase: SupabaseClient, orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()
  if (error) throw error
  return data as Order
}

export async function getOrderUpdates(supabase: SupabaseClient, orderId: string) {
  const { data, error } = await supabase
    .from('order_updates')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as OrderUpdate[]
}
