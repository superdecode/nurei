import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { exportOrders } from '@/lib/supabase/queries/adminOrders'
import { ORDER_STATUS_MAP, PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'
import type { Order, OrderItem, OrderStatus } from '@/types'

function formatCents(cents: number) {
  return (cents / 100).toFixed(2)
}

function csvEscape(val: string | null | undefined): string {
  if (!val) return ''
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function buildCsv(orders: Order[]): string {
  const header = [
    'Orden', 'Fecha', 'Cliente', 'Email', 'Teléfono', 'Estatus',
    'Método de pago', 'Producto', 'SKU', 'Cantidad', 'Precio unitario',
    'Subtotal línea', 'Subtotal', 'Descuento', 'Envío', 'Total', 'Dirección',
  ]

  const rows: string[] = [header.join(',')]

  for (const o of orders) {
    const items = (o.items ?? []) as OrderItem[]
    const statusLabel = ORDER_STATUS_MAP[o.status as OrderStatus]?.label ?? o.status
    const payLabel = PAYMENT_METHOD_LABELS[o.payment_method ?? ''] ?? o.payment_method ?? ''

    if (items.length === 0) {
      rows.push([
        csvEscape(o.short_id), o.created_at, csvEscape(o.customer_name), csvEscape(o.customer_email),
        csvEscape(o.customer_phone), statusLabel, payLabel, '', '', '', '',
        '', formatCents(o.subtotal), formatCents(o.discount), formatCents(o.shipping_fee),
        formatCents(o.total), csvEscape(o.delivery_address),
      ].join(','))
    } else {
      for (const item of items) {
        rows.push([
          csvEscape(o.short_id), o.created_at, csvEscape(o.customer_name), csvEscape(o.customer_email),
          csvEscape(o.customer_phone), statusLabel, payLabel,
          csvEscape(item.name), csvEscape(item.sku ?? ''), String(item.quantity),
          formatCents(item.unit_price), formatCents(item.subtotal),
          formatCents(o.subtotal), formatCents(o.discount), formatCents(o.shipping_fee),
          formatCents(o.total), csvEscape(o.delivery_address),
        ].join(','))
      }
    }
  }

  return rows.join('\n')
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)

    const orders = await exportOrders(supabase, {
      status: searchParams.get('status') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
    })

    const csv = buildCsv(orders)
    const filename = `pedidos_nurei_${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al exportar'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
