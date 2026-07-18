import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { bulkCustomerTagsSchema } from '@/lib/validations/customer'

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()
    const parsed = bulkCustomerTagsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload inválido', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const { customer_ids, tag, action } = parsed.data
    const supabase = createServiceClient()

    const { data: rows, error: fetchError } = await supabase
      .from('customers')
      .select('id, tags')
      .in('id', customer_ids)

    if (fetchError || !rows) {
      return NextResponse.json({ error: 'No se pudieron cargar los clientes' }, { status: 400 })
    }

    let updated = 0
    for (const row of rows) {
      const current: string[] = row.tags ?? []
      const next = action === 'add'
        ? Array.from(new Set([...current, tag]))
        : current.filter((t) => t !== tag)

      // Skip the write when nothing actually changes (tag already present/absent).
      if (next.length === current.length && next.every((t, i) => t === current[i])) continue

      const { error: updateError } = await supabase
        .from('customers')
        .update({ tags: next })
        .eq('id', row.id)
      if (!updateError) updated += 1
    }

    return NextResponse.json({ data: { updated, total: customer_ids.length } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error actualizando etiquetas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
