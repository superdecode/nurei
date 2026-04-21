import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const query = (request.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase()
  const supabase = createServiceClient()

  const [usersRes, customersRes, profilesRes] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase
      .from('customers')
      .select('id, user_id, full_name, email, phone')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('affiliate_profiles').select('id'),
  ])

  const authUserIds = (usersRes.data?.users ?? []).map((user) => user.id)
  const { data: userProfiles } = authUserIds.length
    ? await supabase
      .from('user_profiles')
      .select('id, role')
      .in('id', authUserIds)
    : { data: [] as Array<{ id: string; role: string | null }> }
  const roleByUserId = new Map((userProfiles ?? []).map((profile) => [profile.id, profile.role ?? 'customer']))

  const existingAffiliateIds = new Set((profilesRes.data ?? []).map((row) => row.id))
  const userRows = (usersRes.data?.users ?? [])
    .filter((user) => !existingAffiliateIds.has(user.id) && roleByUserId.get(user.id) !== 'admin')
    .map((user) => ({
      id: user.id,
      email: user.email ?? '',
      full_name: (user.user_metadata?.full_name as string | undefined) ?? '',
      source: 'user' as const,
      customer_id: null as string | null,
    }))

  const customerRows = (customersRes.data ?? [])
    .filter((customer) => {
      if (!customer.user_id) return true
      return !existingAffiliateIds.has(customer.user_id) && roleByUserId.get(customer.user_id) !== 'admin'
    })
    .map((customer) => ({
      id: customer.user_id ?? customer.id,
      email: customer.email ?? '',
      full_name: customer.full_name ?? '',
      source: 'customer' as const,
      customer_id: customer.id,
    }))

  const combined = [...userRows, ...customerRows]
    .filter((row) => {
      if (!query) return true
      return row.email.toLowerCase().includes(query) || row.full_name.toLowerCase().includes(query)
    })
    .slice(0, 50)

  return NextResponse.json({ data: combined })
}
