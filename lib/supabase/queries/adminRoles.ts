import { SupabaseClient } from '@supabase/supabase-js'
import type { AdminRole, PermissionLevel, AdminModule } from '@/types'

export async function getAdminRoles(supabase: SupabaseClient): Promise<AdminRole[]> {
  const { data, error } = await supabase
    .from('admin_roles')
    .select('*')
    .order('name')
  if (error) throw error
  return data as AdminRole[]
}

export async function getAdminRoleById(supabase: SupabaseClient, id: string): Promise<AdminRole | null> {
  const { data, error } = await supabase
    .from('admin_roles')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as AdminRole
}

export async function createAdminRole(
  supabase: SupabaseClient,
  role: { name: string; description?: string; color: string; permissions: Record<AdminModule, PermissionLevel> }
): Promise<AdminRole> {
  const { data, error } = await supabase
    .from('admin_roles')
    .insert(role)
    .select()
    .single()
  if (error) throw error
  return data as AdminRole
}

export async function updateAdminRole(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<AdminRole, 'name' | 'description' | 'color' | 'permissions' | 'is_active'>>
): Promise<AdminRole> {
  const { data, error } = await supabase
    .from('admin_roles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as AdminRole
}

export async function deleteAdminRole(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from('admin_roles')
    .delete()
    .eq('id', id)
    .eq('is_system', false)
  if (error) throw error
}
