import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { getCampaign, updateCampaign, deleteCampaign } from '@/lib/supabase/queries/marketing'
import { validateCampaignDraft } from '@/lib/marketing/validate-campaign'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { id } = await params
  const supabase = createServiceClient()
  const campaign = await getCampaign(supabase, id)
  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  return NextResponse.json({ data: campaign })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { id } = await params
  try {
    const body = await request.json()

    if (body.name !== undefined || body.subject !== undefined || body.content !== undefined) {
      const supabase = createServiceClient()
      const current = await getCampaign(supabase, id)
      if (!current) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

      const validation = validateCampaignDraft({
        name: body.name ?? current.name,
        subject: body.subject ?? current.subject,
        content: body.content ?? current.content,
      })
      if (!validation.valid) {
        return NextResponse.json({ error: validation.errors.join(' ') }, { status: 400 })
      }
    }

    const supabase = createServiceClient()
    const campaign = await updateCampaign(supabase, id, body)
    return NextResponse.json({ data: campaign })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al actualizar campaña'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { id } = await params
  try {
    const supabase = createServiceClient()
    await deleteCampaign(supabase, id)
    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar campaña'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
