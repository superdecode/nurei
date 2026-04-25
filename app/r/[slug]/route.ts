import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { setReferralCookie } from '@/lib/affiliate/cookie'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const destination = new URL('/menu', request.nextUrl.origin)

  if (!slug) return NextResponse.redirect(destination)

  try {
    const supabase = createServiceClient()
    const { data: link, error } = await supabase
      .from('referral_links')
      .select('id')
      .eq('slug', slug.toLowerCase())
      .maybeSingle()

    if (!link || error) return NextResponse.redirect(destination)

    const sessionId = randomUUID()
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

    if (!insertError) {
      await supabase.rpc('increment_referral_clicks', { link_id: link.id })
    }

    const response = NextResponse.redirect(destination)
    return setReferralCookie(response, link.id)
  } catch {
    return NextResponse.redirect(destination)
  }
}
