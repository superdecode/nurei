import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

export async function requireAffiliate() {
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

  const isAffiliate = profileRes.data?.role === 'affiliate' || Boolean(affiliateRes.data)
  if (!isAffiliate) {
    return { error: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }

  return { userId: user.id }
}
