import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { listCampaigns, createCampaign } from '@/lib/supabase/queries/marketing'
import { validateCampaignDraft } from '@/lib/marketing/validate-campaign'
import type { CampaignContent, CampaignStatus } from '@/types'

/** Defensively coerces an arbitrary client payload into a well-shaped CampaignContent before validation. */
function normalizeCampaignContent(rawInput: unknown): CampaignContent {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>
  return {
    heading: String(raw.heading ?? ''),
    body: String(raw.body ?? ''),
    imageUrl: (raw.imageUrl as string | null | undefined) ?? null,
    ctaLabel: String(raw.ctaLabel ?? ''),
    ctaLink: (raw.ctaLink as CampaignContent['ctaLink']) ?? null,
    couponCode: (raw.couponCode as string | null | undefined) ?? null,
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as CampaignStatus | null
    const campaigns = await listCampaigns(supabase, { status: status ?? undefined })
    return NextResponse.json({ data: campaigns })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al listar campañas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const body = await request.json()
    const name = String(body.name ?? '')
    const subject = String(body.subject ?? '')
    const content = normalizeCampaignContent(body.content)

    const validation = validateCampaignDraft({ name, subject, content })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join(' ') }, { status: 400 })
    }

    const supabase = createServiceClient()
    const campaign = await createCampaign(supabase, {
      name,
      subject,
      preheader: body.preheader ?? null,
      template_key: body.template_key ?? null,
      content,
      audience_segments: body.audience_segments ?? [],
      audience_tags: body.audience_tags ?? [],
      coupon_code: body.coupon_code ?? null,
      created_by: guard.userId,
    })
    return NextResponse.json({ data: campaign }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear campaña'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
