import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { reorderCategories } from '@/lib/supabase/queries/categories'

type ReorderPayload = {
  ids: string[]
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const body = (await request.json()) as ReorderPayload
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: 'ids es requerido' }, { status: 400 })
    }

    const orders = body.ids.map((id, index) => ({ id, sort_order: index }))
    await reorderCategories(createServiceClient(), orders)
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error reordenando categorías'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

