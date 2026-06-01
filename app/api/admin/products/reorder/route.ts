import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { reorderProducts } from '@/lib/supabase/queries/products'

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

    await reorderProducts(body.ids)
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error reordenando productos'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
