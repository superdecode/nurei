import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { updateVariantStocks } from '@/lib/supabase/queries/inventory'
import { requireAdmin } from '@/lib/server/require-admin'

const schema = z.object({
  product_id: z.string().uuid(),
  variants: z.array(
    z.object({
      id: z.string().uuid(),
      stock: z.number().int().min(0),
    })
  ).min(1),
  reason: z.string().trim().max(200).optional(),
})

export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload inválido', details: parsed.error.flatten() }, { status: 400 })
    }
    const supabase = createServiceClient()
    await updateVariantStocks(
      supabase,
      parsed.data.product_id,
      parsed.data.variants,
      guard.userId,
      parsed.data.reason
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al actualizar stock de variantes'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
