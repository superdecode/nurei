import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

type AffiliateGuard =
  | { userId: string; error?: never }
  | { userId?: never; error: NextResponse }

export async function requireAffiliate(): Promise<AffiliateGuard> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  const service = createServiceClient()
  const [profileRes, affiliateRes] = await Promise.all([
    service.from('user_profiles').select('role').eq('id', user.id).single(),
    service.from('affiliate_profiles').select('id').eq('id', user.id).maybeSingle(),
  ])

  // Require BOTH the affiliate role AND a valid affiliate_profiles row.
  // A downgraded user with a stale profile row (or role without a profile) is denied.
  const hasRole = profileRes.data?.role === 'affiliate'
  const hasProfile = Boolean(affiliateRes.data)

  if (!hasRole || !hasProfile) {
    return { error: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }

  return { userId: user.id }
}
