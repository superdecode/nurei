'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Order, OrderItem } from '@/types'
import { ORDER_STATUS_MAP } from '@/lib/utils/constants'
import type { OrderStatus } from '@/types'
import { formatPrice, formatDate, formatPhone } from '@/lib/utils/format'

interface PickItem {
  name: string
  sku: string
  totalQty: number
  orders: Array<{ short_id: string; qty: number }>
}

function aggregateItems(orders: Order[]): PickItem[] {
  const map = new Map<string, PickItem>()
  for (const o of orders) {
    for (const item of (o.items ?? []) as OrderItem[]) {
      const key = item.sku ?? item.product_id ?? item.name
      if (!map.has(key)) {
        map.set(key, { name: item.name, sku: item.sku ?? '', totalQty: 0, orders: [] })
      }
      const entry = map.get(key)!
      entry.totalQty += item.quantity
      entry.orders.push({ short_id: o.short_id, qty: item.quantity })
      // Preserve SKU if it was missing initially but found in another order
      if (!entry.sku && item.sku) {
        entry.sku = item.sku
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

// ── Hoja de surtido (picking) ─────────────────────────────────────────────

function SurtidoView({ orders, brandColor }: { orders: Order[]; brandColor: string }) {
  const pickItems = aggregateItems(orders)
  const totalUnits = pickItems.reduce((s, p) => s + p.totalQty, 0)
  const printDate = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="max-w-[680px] mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-end justify-between mb-5 pb-4 border-b-2" style={{ borderColor: brandColor }}>
        <div>
          <h1 className="text-2xl font-black tracking-tight leading-none" style={{ color: brandColor }}>
            nurei
          </h1>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 mt-1">
            Hoja de surtido
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p className="font-semibold text-gray-900">{printDate}</p>
          <p className="mt-0.5">
            {orders.length} pedido{orders.length !== 1 ? 's' : ''} · {totalUnits} und
          </p>
          <p className="mt-0.5 font-mono text-[10px]">
            {orders.map(o => o.short_id).join(' · ')}
          </p>
        </div>
      </div>

      {/* Picking table */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2" style={{ borderColor: brandColor }}>
            <th className="py-2 pr-3 text-center text-[10px] font-bold uppercase tracking-wider text-gray-500 w-8">✓</th>
            <th className="py-2 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Producto</th>
            <th className="py-2 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 w-24">SKU</th>
            <th className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-500 w-14">Cant.</th>
          </tr>
        </thead>
        <tbody>
          {pickItems.map((item, i) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="py-3 pr-3 text-center">
                <div className="w-4 h-4 border-2 border-gray-400 rounded mx-auto" />
              </td>
              <td className="py-3 pr-3">
                <p className="font-semibold text-gray-900 leading-tight">{item.name}</p>
                {item.orders.length > 1 && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {item.orders.map(o => `${o.short_id}×${o.qty}`).join(' · ')}
                  </p>
                )}
              </td>
              <td className="py-3 pr-3 font-mono text-[11px] text-gray-700">{item.sku || '—'}</td>
              <td className="py-3 text-center">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white text-base font-black" style={{ backgroundColor: brandColor }}>
                  {item.totalQty}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2" style={{ borderColor: brandColor }}>
            <td colSpan={3} className="py-2.5 text-xs font-bold text-gray-700 text-right pr-3">TOTAL UNIDADES</td>
            <td className="py-2.5 text-center">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white text-base font-black" style={{ backgroundColor: brandColor }}>
                {totalUnits}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Signature */}
      <div className="mt-10 pt-6 border-t border-gray-300 grid grid-cols-2 gap-10 text-xs">
        <div>
          <p className="text-gray-400 uppercase tracking-widest mb-8">Surtido por</p>
          <div className="border-b border-gray-400 w-full" />
          <p className="text-gray-400 mt-1">Firma y nombre</p>
        </div>
        <div>
          <p className="text-gray-400 uppercase tracking-widest mb-8">Revisado por</p>
          <div className="border-b border-gray-400 w-full" />
          <p className="text-gray-400 mt-1">Firma y nombre</p>
        </div>
      </div>
    </div>
  )
}

// ── Ticket de venta ───────────────────────────────────────────────────────

function TicketView({ orders, brandColor }: { orders: Order[]; brandColor: string }) {
  return (
    <div className="max-w-[680px] mx-auto px-6 py-6 space-y-8">
      {orders.map((order) => {
        const items = (order.items ?? []) as OrderItem[]
        return (
          <div key={order.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Ticket header */}
            <div className="px-5 py-4 text-white" style={{ backgroundColor: brandColor }}>
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-black tracking-tight leading-none text-white">
                    nurei
                  </h1>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 mt-0.5">Comprobante de venta</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black font-mono text-white">{order.short_id}</p>
                  <p className="text-[11px] text-white/80 mt-0.5">{formatDate(order.created_at)}</p>
                  <p className="text-[10px] text-white/70 mt-0.5 uppercase tracking-wider">
                    {ORDER_STATUS_MAP[order.status as OrderStatus]?.label ?? order.status}
                  </p>
                </div>
              </div>
            </div>

            {/* Customer + delivery */}
            <div className="grid grid-cols-2 gap-4 px-5 py-4 border-b border-gray-100 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Cliente</p>
                <p className="font-semibold text-gray-900">{order.customer_name ?? '—'}</p>
                {order.customer_phone && <p className="text-gray-500 mt-0.5">{formatPhone(order.customer_phone)}</p>}
                {order.customer_email && <p className="text-gray-500 mt-0.5">{order.customer_email}</p>}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Entrega</p>
                <p className="text-gray-700 leading-relaxed">{order.delivery_address ?? '—'}</p>
                {order.delivery_instructions && (
                  <p className="text-gray-400 italic mt-0.5">{order.delivery_instructions}</p>
                )}
              </div>
            </div>

            {/* Items */}
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2 text-gray-400 font-semibold">Artículo</th>
                  <th className="text-center px-3 py-2 text-gray-400 font-semibold w-12">Cant.</th>
                  <th className="text-right px-3 py-2 text-gray-400 font-semibold w-20">Precio</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-semibold w-20">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      {item.sku && <p className="text-[10px] text-gray-400 font-mono">{item.sku}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-gray-900">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{formatPrice(item.unit_price)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">{formatPrice(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-gray-200 px-4 py-3 bg-gray-50/50 space-y-1 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Descuento</span>
                  <span className="tabular-nums">-{formatPrice(order.discount)}</span>
                </div>
              )}
              {order.coupon_discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Cupón {order.coupon_code && `(${order.coupon_code})`}</span>
                  <span className="tabular-nums">-{formatPrice(order.coupon_discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500">
                <span>Envío</span>
                <span className="tabular-nums">{order.shipping_fee === 0 ? 'Gratis' : formatPrice(order.shipping_fee)}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-gray-900 pt-1 border-t border-gray-200 mt-1">
                <span>Total</span>
                <span className="tabular-nums">{formatPrice(order.total)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 text-center border-t border-gray-100">
              <p className="text-[10px] text-gray-400">Gracias por tu compra · nurei.mx</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────

function PrintContent() {
  const searchParams = useSearchParams()
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? []
  const type = (searchParams.get('type') ?? 'surtido') as 'surtido' | 'ticket'
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [brandColor, setBrandColor] = useState('#111827')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(json => {
        const color = json.data?.appearance?.primary_color as string | undefined
        if (color) setBrandColor(color)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (ids.length === 0) { setLoading(false); return }
    Promise.all(
      ids.map(async (id) => {
        const res = await fetch(`/api/admin/orders/${id}`)
        const json = await res.json() as { data?: { order: Order } }
        return json.data?.order ?? null
      })
    ).then((results) => {
      setOrders(results.filter(Boolean) as Order[])
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const title = type === 'ticket'
    ? `Ticket — ${ids.length} pedido${ids.length !== 1 ? 's' : ''}`
    : `Surtido — ${ids.length} pedido${ids.length !== 1 ? 's' : ''}`

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Preparando {type === 'ticket' ? 'ticket' : 'hoja de surtido'}…</p>
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-sm text-gray-500">No se encontraron pedidos.</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media screen { .screen-overlay { position: fixed; inset: 0; z-index: 9999; background: white; overflow: auto; } }
        @media print {
          @page { size: letter; margin: 1.2cm; }
          body * { visibility: hidden; }
          .print-root, .print-root * { visibility: visible; }
          .print-root { position: fixed !important; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      `}</style>

      <div className="screen-overlay print-root">
        {/* Toolbar (screen only) */}
        <div className="no-print sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-6 py-3">
          <button
            onClick={() => window.close()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            ← Cerrar
          </button>
          <span className="flex-1 text-sm font-semibold text-gray-700">{title}</span>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 transition"
          >
            Imprimir
          </button>
        </div>

        {type === 'ticket' ? (
          <TicketView orders={orders} brandColor={brandColor} />
        ) : (
          <SurtidoView orders={orders} brandColor={brandColor} />
        )}
      </div>
    </>
  )
}

export default function PrintPage() {
  return (
    <Suspense>
      <PrintContent />
    </Suspense>
  )
}
