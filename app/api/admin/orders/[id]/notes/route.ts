import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { addOrderNote } from '@/lib/supabase/queries/adminOrders'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = (await req.json()) as { message?: string }

    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const note = await addOrderNote(supabase, id, body.message.trim(), 'admin')

    return NextResponse.json({ data: note })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al agregar nota'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
