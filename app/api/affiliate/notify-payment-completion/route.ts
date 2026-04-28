import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAffiliate } from '@/lib/server/require-affiliate'

interface PaymentData {
  bank_holder?: string | null
  bank_clabe?: string | null
  bank_name?: string | null
  payment_method?: string | null
}

export async function POST(request: NextRequest) {
  const guard = await requireAffiliate()
  if (guard.error) return guard.error

  const affiliateId = guard.userId!
  const supabase = createServiceClient()

  // Get updated profile data
  const { data: profile, error: profileErr } = await supabase
    .from('affiliate_profiles')
    .select('id, handle, user_id, email, created_at')
    .eq('id', affiliateId)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  // Check if payment data is now complete
  const hasPaymentInfo = !!(profile.bank_holder && profile.bank_clabe && profile.bank_name)

  if (hasPaymentInfo) {
    // Get admin users to notify
    const { data: adminUsers, error: adminErr } = await supabase.auth.admin.listUsers()
    if (!adminErr && adminUsers?.users) {
      const adminEmails = adminUsers.users
        .filter(u => u.user_metadata?.role === 'admin')
        .map(u => u.email)
        .filter(Boolean) as string[]

      if (adminEmails.length > 0) {
        // Send notification email
        const body = {
          to: adminEmails,
          subject: 'Nuevo afiliado completó datos de pago',
          template: 'affiliate-payment-data-completed',
          data: {
            affiliate_name: profile.handle,
            affiliate_id: profile.id,
            email: profile.email,
            created_at: new Date(profile.created_at).toLocaleDateString('es-MX'),
          }
        }

        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/email/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (res.ok) {
            console.log('Payment info notification sent to admins')
          }
        } catch (err) {
          console.error('Failed to send payment info notification:', err)
        }
      }
    }
  }

  return NextResponse.json({ success: true, hasPaymentInfo })
}