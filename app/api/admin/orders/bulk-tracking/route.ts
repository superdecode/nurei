import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { updateOrderStatus } from '@/lib/supabase/queries/adminOrders'
import { sendOrderStatusEmail } from '@/lib/email/send-order-emails'
import { VALID_STATUS_TRANSITIONS } from '@/lib/utils/constants'
import { isValidTrackingUrl } from '@/lib/utils/csv-tracking-mapper'

const rowSchema = z.object({
  folio: z.string().trim().min(1),
  carrier: z.string().trim().min(1),
  tracking_number: z.string().trim().min(1),
  tracking_url: z.string().trim().optional(),
})

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
})

interface RowResult {
  folio: string
  status: 'updated' | 'not_found' | 'not_shippable' | 'error'
  detail?: string
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  try {
    const body = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Formato de archivo inválido', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const results: RowResult[] = []
    let emailsSent = 0

    for (const row of parsed.data.rows) {
      const { data: order, error: findErr } = await supabase
        .from('orders')
        .select('id, status')
        .eq('short_id', row.folio)
        .maybeSingle()

      if (findErr || !order) {
        results.push({ folio: row.folio, status: 'not_found' })
        continue
      }

      // Same rule the single-order status dropdown enforces — only move to
      // 'shipped' from a status that legally allows it.
      const currentStatus = order.status as string
      const canShip = (VALID_STATUS_TRANSITIONS[currentStatus] ?? []).includes('shipped')
      if (!canShip) {
        results.push({ folio: row.folio, status: 'not_shippable', detail: `Estatus actual: ${currentStatus}` })
        continue
      }

      if (row.tracking_url && !isValidTrackingUrl(row.tracking_url)) {
        results.push({ folio: row.folio, status: 'error', detail: 'url_tracking inválida — debe ser un link http(s)' })
        continue
      }

      try {
        const { error: updateErr } = await supabase
          .from('orders')
          .update({
            carrier: row.carrier,
            tracking_number: row.tracking_number,
            tracking_url: row.tracking_url || null,
          })
          .eq('id', order.id)
        if (updateErr) throw updateErr

        await updateOrderStatus(supabase, order.id, 'shipped', 'Guía asignada por carga masiva', 'admin')

        const emailDelivery = await sendOrderStatusEmail(order.id, 'shipped')
        if (emailDelivery.sent) emailsSent += 1

        results.push({ folio: row.folio, status: 'updated' })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        results.push({ folio: row.folio, status: 'error', detail: message })
      }
    }

    const summary = {
      total: results.length,
      updated: results.filter((r) => r.status === 'updated').length,
      notFound: results.filter((r) => r.status === 'not_found').map((r) => r.folio),
      notShippable: results.filter((r) => r.status === 'not_shippable'),
      errors: results.filter((r) => r.status === 'error'),
      emailsSent,
    }

    return NextResponse.json({ data: summary })
  } catch (err) {
    console.error('[bulk-tracking] failed:', err)
    return NextResponse.json({ error: 'Error al procesar el archivo' }, { status: 500 })
  }
}
