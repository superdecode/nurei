import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { getCampaign, updateCampaign, deleteCampaign } from '@/lib/supabase/queries/marketing'
import { validateCampaignDraft } from '@/lib/marketing/validate-campaign'
import type { CampaignContent } from '@/types'

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

// Known business-rule / not-found messages thrown by updateCampaign/deleteCampaign.
// Anything else is treated as an unexpected failure (500) rather than a client error (400).
const KNOWN_ERROR_STATUS: Record<string, number> = {
  'Campaña no encontrada': 404,
  'Solo se pueden editar campañas en borrador': 400,
  'Solo se pueden eliminar campañas en borrador': 400,
}

function statusForError(err: unknown): number {
  const message = err instanceof Error ? err.message : ''
  return KNOWN_ERROR_STATUS[message] ?? 500
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const { id } = await params
    const supabase = createServiceClient()
    const campaign = await getCampaign(supabase, id)
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
    return NextResponse.json({ data: campaign })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al obtener campaña'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { id } = await params
  try {
    const supabase = createServiceClient()
    const current = await getCampaign(supabase, id)
    if (!current) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

    const body = await request.json()

    // Explicit field whitelist — status, id, created_by, created_at, updated_at, sent_at
    // can never be set through this route. Status changes go through the dedicated
    // send route (Task 10) or a future dedicated status-change endpoint.
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = String(body.name)
    if (body.subject !== undefined) updates.subject = String(body.subject)
    if (body.preheader !== undefined) updates.preheader = body.preheader
    if (body.template_key !== undefined) updates.template_key = body.template_key
    if (body.content !== undefined) updates.content = normalizeCampaignContent(body.content)
    if (body.audience_segments !== undefined) updates.audience_segments = body.audience_segments
    if (body.audience_tags !== undefined) updates.audience_tags = body.audience_tags
    if (body.coupon_code !== undefined) updates.coupon_code = body.coupon_code

    if (updates.name !== undefined || updates.subject !== undefined || updates.content !== undefined) {
      const validation = validateCampaignDraft({
        name: (updates.name as string | undefined) ?? current.name,
        subject: (updates.subject as string | undefined) ?? current.subject,
        content: (updates.content as CampaignContent | undefined) ?? current.content,
      })
      if (!validation.valid) {
        return NextResponse.json({ error: validation.errors.join(' ') }, { status: 400 })
      }
    }

    const campaign = await updateCampaign(supabase, id, updates)
    return NextResponse.json({ data: campaign })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al actualizar campaña'
    return NextResponse.json({ error: message }, { status: statusForError(err) })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { id } = await params
  try {
    const supabase = createServiceClient()
    const current = await getCampaign(supabase, id)
    if (!current) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

    await deleteCampaign(supabase, id)
    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar campaña'
    return NextResponse.json({ error: message }, { status: statusForError(err) })
  }
}
