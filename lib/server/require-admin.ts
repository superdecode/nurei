import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

/** Returns the authenticated admin ID without producing an HTTP response. */
export async function getAdminUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const { data: profile } = await createServiceClient()
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin' ? user.id : null
}

export async function requireAdmin() {
  const userId = await getAdminUserId()
  if (!userId) {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
    }
    return { error: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }

  return { userId }
}
