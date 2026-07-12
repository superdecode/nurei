import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAffiliate } from '@/lib/server/require-affiliate'

interface PaymentData {
  bank_holder?: string | null
  bank_clabe?: string | null
  bank_name?: string | null
  payment_method?: string | null
}

export async function POST() {
  const guard = await requireAffiliate()
  if (guard.error) return guard.error

  const affiliateId = guard.userId!
  const supabase = createServiceClient()

  const { data: profile, error: profileErr } = await supabase
    .from('affiliate_profiles')
    .select('id, handle, user_id, email, created_at, bank_holder, bank_clabe, bank_name')
    .eq('id', affiliateId)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  const hasPaymentInfo = !!(profile.bank_holder && profile.bank_clabe && profile.bank_name)

  if (hasPaymentInfo) {
    // Fetch admin emails from user_profiles (role is stored there, not in auth user_metadata)
    const { data: adminProfiles } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('role', 'admin')

    if (adminProfiles && adminProfiles.length > 0) {
      const adminIds = adminProfiles.map((p) => p.id)

      // Get emails from auth.users via the admin API
      const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 200 })
      const adminEmails = (authUsers?.users ?? [])
        .filter((u) => adminIds.includes(u.id) && u.email)
        .map((u) => u.email as string)

      if (adminEmails.length > 0) {
        // Log for ops visibility — no sensitive data exposed
        console.info('[affiliate] payment info completed — admin notification queued', {
          affiliateId,
          adminCount: adminEmails.length,
        })
        // TODO: wire to Resend/email service when /api/email/send is implemented
      }
    }
  }

  return NextResponse.json({ success: true, hasPaymentInfo })
}
