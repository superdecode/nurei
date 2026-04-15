import type { SupabaseClient } from '@supabase/supabase-js'
import type { Address } from '@/types'

export async function getAddresses(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Address[]
}

export async function createAddress(
  supabase: SupabaseClient,
  userId: string,
  address: Omit<Address, 'id' | 'created_at'>
) {
  const { data, error } = await supabase
    .from('addresses')
    .insert({ ...address, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data as Address
}

export async function updateAddress(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Omit<Address, 'id' | 'user_id' | 'created_at'>>
) {
  const { data, error } = await supabase
    .from('addresses')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Address
}

export async function deleteAddress(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('addresses').delete().eq('id', id)
  if (error) throw error
}

export async function setDefaultAddress(supabase: SupabaseClient, id: string) {
  // The DB trigger handles unsetting other defaults
  const { data, error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Address
}
