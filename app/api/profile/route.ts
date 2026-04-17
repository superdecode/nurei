import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProfile, upsertProfile } from '@/lib/supabase/queries/profile'
import { z } from 'zod'

const updateSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  accepts_marketing: z.boolean().optional(),
  accepts_email_marketing: z.boolean().optional(),
  accepts_sms_marketing: z.boolean().optional(),
  accepts_whatsapp_marketing: z.boolean().optional(),
})

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const profile = await getProfile(supabase, user.id)
    const { data: customer } = await supabase
      .from('customers')
      .select(
        'first_name, last_name, full_name, accepts_marketing, accepts_email_marketing, accepts_sms_marketing, accepts_whatsapp_marketing, consent_updated_at',
      )
      .eq('user_id', user.id)
      .maybeSingle()

    const meta = user.user_metadata as Record<string, unknown> | undefined
    const legalTermsAcceptedAt =
      typeof meta?.legal_terms_accepted_at === 'string' ? meta.legal_terms_accepted_at : null

    return NextResponse.json({
      data: {
        ...profile,
        email: user.email,
        customer: customer ?? null,
        legal_terms_accepted_at: legalTermsAcceptedAt,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error al obtener perfil' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const {
      accepts_marketing,
      accepts_email_marketing,
      accepts_sms_marketing,
      accepts_whatsapp_marketing,
      ...profilePatch
    } = parsed.data

    const hasProfilePatch =
      profilePatch.full_name !== undefined
      || profilePatch.phone !== undefined
      || profilePatch.avatar_url !== undefined

    let profile = await getProfile(supabase, user.id)
    if (hasProfilePatch) {
      profile = await upsertProfile(supabase, user.id, profilePatch)
    }

    const hasMarketing =
      accepts_marketing !== undefined
      || accepts_email_marketing !== undefined
      || accepts_sms_marketing !== undefined
      || accepts_whatsapp_marketing !== undefined

    if (hasMarketing) {
      const payload: Record<string, unknown> = {}
      if (accepts_marketing !== undefined) payload.accepts_marketing = accepts_marketing
      if (accepts_email_marketing !== undefined) payload.accepts_email_marketing = accepts_email_marketing
      if (accepts_sms_marketing !== undefined) payload.accepts_sms_marketing = accepts_sms_marketing
      if (accepts_whatsapp_marketing !== undefined) {
        payload.accepts_whatsapp_marketing = accepts_whatsapp_marketing
      }
      if (
        parsed.data.accepts_marketing
        || parsed.data.accepts_email_marketing
        || parsed.data.accepts_sms_marketing
        || parsed.data.accepts_whatsapp_marketing
      ) {
        payload.consent_updated_at = new Date().toISOString()
      }
      await supabase.from('customers').update(payload).eq('user_id', user.id)
    }

    const { data: customer } = await supabase
      .from('customers')
      .select(
        'first_name, last_name, full_name, accepts_marketing, accepts_email_marketing, accepts_sms_marketing, accepts_whatsapp_marketing, consent_updated_at',
      )
      .eq('user_id', user.id)
      .maybeSingle()

    const meta = user.user_metadata as Record<string, unknown> | undefined
    const legalTermsAcceptedAt =
      typeof meta?.legal_terms_accepted_at === 'string' ? meta.legal_terms_accepted_at : null

    return NextResponse.json({
      data: {
        ...profile,
        email: user.email,
        customer: customer ?? null,
        legal_terms_accepted_at: legalTermsAcceptedAt,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 500 })
  }
}
