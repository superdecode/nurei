import { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentMethod } from '@/types'

export async function getPaymentMethods(supabase: SupabaseClient, activeOnly = false): Promise<PaymentMethod[]> {
  let query = supabase
    .from('payment_methods')
    .select('*')
    .order('sort_order')

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as PaymentMethod[]
}

export async function updatePaymentMethod(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<PaymentMethod, 'name' | 'description' | 'is_active' | 'config' | 'sort_order'>>
): Promise<PaymentMethod> {
  const { data, error } = await supabase
    .from('payment_methods')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as PaymentMethod
}

export async function togglePaymentMethod(supabase: SupabaseClient, id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase
    .from('payment_methods')
    .update({ is_active })
    .eq('id', id)
  if (error) throw error
}
