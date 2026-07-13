import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { moveDeal } from '@/lib/supabase/queries/crm'
import { moveDealSchema } from '@/lib/validations/crm'

// Kanban drag-and-drop: move a deal into a stage and persist the stage order.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params

  try {
    const body = await request.json()
    const parsed = moveDealSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const supabase = createServiceClient()
    await moveDeal(supabase, id, parsed.data, auth.userId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error moviendo oportunidad'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
