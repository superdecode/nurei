import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { getBoard } from '@/lib/supabase/queries/crm'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const pipelineId = request.nextUrl.searchParams.get('pipeline') ?? undefined
    const supabase = createServiceClient()
    const board = await getBoard(supabase, pipelineId)
    if (!board) return NextResponse.json({ error: 'No hay pipeline configurado' }, { status: 404 })
    return NextResponse.json({ data: board })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error cargando el tablero'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
