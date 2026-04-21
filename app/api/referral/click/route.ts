import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { setReferralCookie } from '@/lib/affiliate/cookie'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { slug, sessionId } = await request.json()

    if (!slug || typeof slug !== 'string' || !sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'slug y sessionId requeridos' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: link, error: linkError } = await supabase
      .from('referral_links')
      .select('id, affiliate_id')
      .eq('slug', slug.toLowerCase())
      .single()

    if (linkError || !link) {
      return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 })
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)

    const { error: insertError } = await supabase
      .from('referral_clicks')
      .insert({
        referral_link_id: link.id,
        session_id: sessionId,
        ip_hash: ipHash,
      })

    // Ignore unique violation (duplicate click within 1h)
    if (insertError && !insertError.message.includes('unique')) {
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }

    // Increment click counter only on new clicks
    if (!insertError) {
      await supabase.rpc('increment_referral_clicks', { link_id: link.id })
    }

    const response = NextResponse.json({ ok: true, linkId: link.id })
    return setReferralCookie(response, link.id)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
