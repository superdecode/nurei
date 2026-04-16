import { SupabaseClient } from '@supabase/supabase-js'
import type { UserProfile } from '@/types'

export async function getAdminUsers(supabase: SupabaseClient): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, admin_role:admin_roles(*)')
    .in('role', ['admin'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as UserProfile[]
}

export async function getAllUsers(supabase: SupabaseClient): Promise<(UserProfile & { email?: string })[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, admin_role:admin_roles(*)')
    .order('created_at', { ascending: false })
  if (error) throw error

  // Fetch emails from auth.admin
  let authUsers: any[] = []
  try {
    const { data: authData } = await supabase.auth.admin.listUsers()
    authUsers = authData.users
  } catch (e) {
    // Ignore error if not using service role
  }

  return (data ?? []).map((p: any) => ({
    ...p,
    email: authUsers.find((u) => u.id === p.id)?.email,
  })) as unknown as (UserProfile & { email?: string })[]
}

export async function getUserById(supabase: SupabaseClient, id: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, admin_role:admin_roles(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data as unknown as UserProfile
}

export async function updateUserProfile(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<UserProfile, 'full_name' | 'phone' | 'role' | 'admin_role_id' | 'is_active'>>
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', id)
    .select('*, admin_role:admin_roles(*)')
    .single()
  if (error) throw error
  return data as unknown as UserProfile
}

export async function createAdminUser(
  supabase: SupabaseClient,
  params: { email: string; password: string; full_name: string; phone?: string; admin_role_id: string }
) {
  // Use admin API to create user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: { full_name: params.full_name },
  })
  if (authError) throw authError

  // Update the auto-created profile with admin role
  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      full_name: params.full_name,
      phone: params.phone ?? null,
      role: 'admin',
      admin_role_id: params.admin_role_id,
    })
    .eq('id', authData.user.id)
    .select('*, admin_role:admin_roles(*)')
    .single()
  if (error) throw error
  return data as unknown as UserProfile
}

export async function toggleUserActive(supabase: SupabaseClient, id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ is_active })
    .eq('id', id)
  if (error) throw error
}
