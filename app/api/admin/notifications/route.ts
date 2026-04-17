import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computeStockStatus } from '@/lib/inventory/stock-status'

export type AdminNotificationItem = {
  id: string
  type: 'stock_bajo' | 'stock_agotado' | 'movimiento' | 'nuevo_pedido' | 'pedido_pagado'
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

    // ── New/recent orders (last 2 hours) — highest priority ──────────────────
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, short_id, status, total, customer_name, customer_email, created_at')
      .in('status', ['pending_payment', 'paid'])
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: false })
      .limit(15)

    for (const o of recentOrders ?? []) {
      const isPaid = o.status === 'paid'
      const totalFormatted = o.total ? `$${(o.total / 100).toFixed(2)}` : ''
      items.push({
        id: `order-${o.id}`,
        type: isPaid ? 'pedido_pagado' : 'nuevo_pedido',
        title: isPaid ? `💳 Pedido pagado #${o.short_id}` : `🛒 Nuevo pedido #${o.short_id}`,
        message: `${o.customer_name ?? 'Cliente'} · ${totalFormatted}`,
        href: `/admin/pedidos/${o.id}`,
        created_at: o.created_at,
        priority: isPaid ? 'alta' : 'alta',
      })
    }

    // ── Stock alerts ──────────────────────────────────────────────────────────
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

    // ── Recent inventory movements (non-sale) ─────────────────────────────────
    const { data: movements } = await supabase
      .from('inventory_movements')
      .select('id, type, quantity, reason, reference, created_at')
      .neq('type', 'venta')
      .order('created_at', { ascending: false })
      .limit(5)

    for (const m of movements ?? []) {
      items.push({
        id: `mov-${m.id}`,
        type: 'movimiento',
        title: `Movimiento: ${m.type}`,
        message: `${m.reason ?? 'Sin detalle'} · Ref. ${m.reference ?? '—'}`.slice(0, 160),
        href: '/admin/inventario',
        created_at: m.created_at,
        priority: 'baja',
      })
    }

    // Sort: orders first, then by date desc
    items.sort((a, b) => {
      const isOrderA = a.type === 'nuevo_pedido' || a.type === 'pedido_pagado'
      const isOrderB = b.type === 'nuevo_pedido' || b.type === 'pedido_pagado'
      if (isOrderA && !isOrderB) return -1
      if (!isOrderA && isOrderB) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return NextResponse.json({
      data: {
        items: items.slice(0, 30),
        unread_estimate: items.filter((i) => i.priority === 'alta').length,
      },
    })
  } catch {
    return NextResponse.json({ data: { items: [], unread_estimate: 0 } })
  }
}
