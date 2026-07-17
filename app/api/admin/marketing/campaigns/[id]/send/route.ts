import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { getCampaign } from '@/lib/supabase/queries/marketing'
import { buildAudienceFilter } from '@/lib/marketing/audience-filter'
import { resolveAudience } from '@/lib/supabase/queries/marketing'
import { resolveCtaUrl } from '@/lib/marketing/resolve-cta-link'
import { renderCampaignEmailHtml } from '@/lib/email/templates/campaign-email-html'

const BATCH_SIZE = 5

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { id } = await params

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY no configurado' }, { status: 503 })

  const supabase = createServiceClient()
  const campaign = await getCampaign(supabase, id)
  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

  // Atomic claim: the conditional UPDATE only succeeds if the row is still 'draft',
  // so concurrent POSTs (double-click, client retry) can never both win the race and
  // send duplicate emails to the whole audience. This replaces the old
  // read-status-then-write-status check, which had a TOCTOU gap around resolveAudience().
  const { data: claimed, error: claimError } = await supabase
    .from('marketing_campaigns')
    .update({ status: 'sending' })
    .eq('id', id)
    .eq('status', 'draft')
    .select('id')

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 })
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'Esta campaña ya fue enviada o está en proceso' }, { status: 409 })
  }

  try {
    const filter = buildAudienceFilter({ segments: campaign.audience_segments, tags: campaign.audience_tags })
    const audience = await resolveAudience(supabase, filter)
    if (audience.length === 0) {
      await supabase.from('marketing_campaigns').update({ status: 'failed' }).eq('id', id)
      return NextResponse.json({ error: 'No hay destinatarios para esta audiencia' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3500'
    const resolvedCtaUrl = await resolveCtaUrl(supabase, campaign.content.ctaLink, appUrl)

    const { data: recipientRows, error: insertError } = await supabase
      .from('marketing_campaign_recipients')
      .insert(audience.map((c) => ({
        campaign_id: id, customer_id: c.id, email: c.email, name: c.full_name, status: 'queued',
      })))
      .select('id, email, customer_id')

    if (insertError || !recipientRows) {
      await supabase.from('marketing_campaigns').update({ status: 'failed' }).eq('id', id)
      return NextResponse.json({ error: insertError?.message ?? 'Error al preparar destinatarios' }, { status: 500 })
    }

    const resend = new Resend(apiKey)
    const from = process.env.EMAIL_FROM ?? 'nurei <onboarding@resend.dev>'
    let sentCount = 0
    let failedCount = 0

    for (let i = 0; i < recipientRows.length; i += BATCH_SIZE) {
      const batch = recipientRows.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map((recipient) => {
          const trackingPixelUrl = `${appUrl}/api/marketing/track/open/${recipient.id}`
          const html = renderCampaignEmailHtml({
            content: campaign.content, resolvedCtaUrl, trackingPixelUrl,
            preheader: campaign.preheader ?? undefined,
          })
          return resend.emails.send({ from, to: [recipient.email], subject: campaign.subject, html })
        })
      )

      for (let j = 0; j < results.length; j++) {
        const recipient = batch[j]
        const result = results[j]
        if (result.status === 'fulfilled' && !result.value.error) {
          sentCount++
          await supabase.from('marketing_campaign_recipients')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', recipient.id)
        } else {
          failedCount++
          const errorMessage = result.status === 'rejected'
            ? String(result.reason)
            : (result.value.error?.message ?? 'Error desconocido')
          await supabase.from('marketing_campaign_recipients')
            .update({ status: 'failed', error_message: errorMessage })
            .eq('id', recipient.id)
        }
      }
    }

    const finalStatus = sentCount === 0 ? 'failed' : 'sent'
    await supabase.from('marketing_campaigns')
      .update({ status: finalStatus, sent_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ data: { status: finalStatus, sent: sentCount, failed: failedCount } })
  } catch (err) {
    // Any unhandled failure between the claim and the final status update must not
    // leave the campaign stuck in 'sending' forever — update/delete both require
    // status === 'draft', so a stuck campaign would be unrecoverable through the API.
    await supabase.from('marketing_campaigns').update({ status: 'failed' }).eq('id', id)
    const message = err instanceof Error ? err.message : 'Error inesperado al enviar la campaña'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
