import { SupabaseClient } from '@supabase/supabase-js'

export interface Category {
  id: string
  name: string
  slug: string
  emoji: string | null
  color: string | null
  description: string | null
  sort_order: number
  position?: number
  is_active: boolean
  created_at?: string
}

export async function listCategories(supabase: SupabaseClient) {
  const withPosition = await supabase
    .from('categories')
    .select('*')
    .order('position', { ascending: true })
    .order('sort_order', { ascending: true })

  if (!withPosition.error) {
    return (withPosition.data ?? []) as Category[]
  }

  // Backward compatibility while migration for `position` is not applied.
  const fallback = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  if (fallback.error) throw fallback.error
  return (fallback.data ?? []) as Category[]
}

export async function createCategory(supabase: SupabaseClient, category: Omit<Category, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('categories')
    .insert(category)
    .select()
    .single()
  
  if (error) throw error
  return data as Category
}

export async function updateCategory(supabase: SupabaseClient, id: string, category: Partial<Category>) {
  const { data, error } = await supabase
    .from('categories')
    .update(category)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as Category
}

export async function deleteCategory(supabase: SupabaseClient, id: string) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

export async function reorderCategories(supabase: SupabaseClient, orders: { id: string, sort_order: number }[]) {
  // Supabase doesn't have a bulk update for multiple rows with different values easily
  // We'll do it in a loop or using a RPC if performance is an issue, but for <20 categories it's fine
  const promises = orders.map(o =>
    supabase.from('categories').update({ sort_order: o.sort_order, position: o.sort_order }).eq('id', o.id)
  )
  await Promise.all(promises)
}
