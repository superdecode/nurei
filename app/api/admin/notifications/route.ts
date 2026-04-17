import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computeStockStatus } from '@/lib/inventory/stock-status'

export type AdminNotificationItem = {
  id: string
  type: 'stock_bajo' | 'stock_agotado' | 'movimiento'
  title: string
  message: string
  href?: string
  created_at: string
  priority: 'alta' | 'media' | 'baja'
}

export async function GET() {
  try {

    const supabase = createServiceClient()
    const items: AdminNotificationItem[] = []

    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku, stock_quantity, low_stock_threshold, track_inventory, allow_backorder, status')
      .eq('status', 'active')
      .eq('is_active', true)
      .limit(80)

    for (const p of products ?? []) {
      const status = computeStockStatus(p)
      if (status === 'out_of_stock') {
        items.push({
          id: `stock-out-${p.id}`,
          type: 'stock_agotado',
          title: 'Producto agotado',
          message: `${p.name} (${p.sku})`,
          href: '/admin/inventario',
          created_at: new Date().toISOString(),
          priority: 'alta',
        })
      } else if (status === 'low_stock') {
        items.push({
          id: `stock-low-${p.id}`,
          type: 'stock_bajo',
          title: 'Stock bajo',
          message: `${p.name}: ${p.stock_quantity ?? 0} uds. (alerta ${p.low_stock_threshold ?? 5})`,
          href: '/admin/inventario',
          created_at: new Date().toISOString(),
          priority: 'media',
        })
      }
    }

    const { data: movements } = await supabase
      .from('inventory_movements')
      .select('id, type, quantity, reason, reference, created_at')
      .order('created_at', { ascending: false })
      .limit(8)

    for (const m of movements ?? []) {
      items.push({
        id: `mov-${m.id}`,
        type: 'movimiento',
        title: `Movimiento: ${m.type}`,
        message: `${m.reason ?? 'Sin detalle'} · Ref. ${m.reference ?? '—'}`.slice(0, 160),
        href: '/admin/inventario',
        created_at: m.created_at,
        priority: m.type === 'venta' ? 'baja' : 'media',
      })
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({
      data: {
        items: items.slice(0, 25),
        unread_estimate: items.filter((i) => i.priority === 'alta' || i.type === 'stock_agotado').length,
      },
    })
  } catch {
    return NextResponse.json({ data: { items: [], unread_estimate: 0 } })
  }
}
