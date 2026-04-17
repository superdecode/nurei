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
  unitPrice: number
  totalQty: number
  orders: Array<{ short_id: string; qty: number }>
}

function aggregateItems(orders: Order[]): PickItem[] {
  const map = new Map<string, PickItem>()
  for (const o of orders) {
    for (const item of (o.items ?? []) as OrderItem[]) {
      const key = item.sku ?? item.product_id ?? item.name
      if (!map.has(key)) {
        map.set(key, { name: item.name, sku: item.sku ?? '', unitPrice: item.unit_price, totalQty: 0, orders: [] })
      }
      const entry = map.get(key)!
      entry.totalQty += item.quantity
      entry.orders.push({ short_id: o.short_id, qty: item.quantity })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

function PrintContent() {
  const searchParams = useSearchParams()
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? []
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

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
      setTimeout(() => window.print(), 600)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Preparando lista de surtido…</p>
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-sm text-gray-500">No se encontraron pedidos para imprimir.</p>
      </div>
    )
  }

  const pickItems = aggregateItems(orders)
  const totalUnits = pickItems.reduce((s, p) => s + p.totalQty, 0)
  const printDate = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <style>{`
        @media screen { .screen-overlay { position: fixed; inset: 0; z-index: 9999; background: white; overflow: auto; } }
        @media print {
          @page { size: letter; margin: 1.5cm; }
          body * { visibility: hidden; }
          .print-root, .print-root * { visibility: visible; }
          .print-root { position: fixed !important; left: 0; top: 0; width: 100%; height: auto; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      `}</style>

      {/* Screen overlay to hide admin layout */}
      <div className="screen-overlay print-root">
        {/* Toolbar (screen only) */}
        <div className="no-print sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-6 py-3">
          <button onClick={() => window.history.back()} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
            ← Volver
          </button>
          <span className="flex-1 text-sm font-semibold text-gray-700">
            Lista de surtido — {orders.length} pedido{orders.length !== 1 ? 's' : ''}
          </span>
          <button onClick={() => window.print()} className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 transition">
            Imprimir
          </button>
        </div>

        <div className="max-w-[720px] mx-auto px-6 py-8">
          {/* ── Document header ── */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight">nu<span style={{color:'#00E5CC'}}>rei</span></h1>
              <p className="text-[10px] uppercase tracking-[0.15em] text-gray-400 mt-0.5">Lista de surtido</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900 capitalize">{printDate}</p>
              <p className="text-xs text-gray-500 mt-0.5">{orders.length} pedido{orders.length !== 1 ? 's' : ''} · {totalUnits} unidades totales</p>
            </div>
          </div>

          {/* ── Pedidos summary ── */}
          <div className="mb-6 rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Pedidos incluidos</p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-white">
                  <th className="text-left px-4 py-2 text-gray-500 font-semibold">Orden</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-semibold">Cliente</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-semibold">Estatus</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2 font-mono font-bold text-gray-900">{o.short_id}</td>
                    <td className="px-4 py-2 text-gray-700">{o.customer_name ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{ORDER_STATUS_MAP[o.status as OrderStatus]?.label ?? o.status}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatPrice(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Aggregated picking table ── */}
          <div className="mb-2">
            <div className="bg-gray-900 text-white px-4 py-2.5 rounded-t-lg flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest">Artículos a surtir</p>
              <p className="text-xs opacity-70">{pickItems.length} SKU · {totalUnits} uds totales</p>
            </div>
            <table className="w-full border-collapse text-sm border border-gray-200 rounded-b-lg overflow-hidden">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-center px-3 py-2.5 text-[10px] font-bold uppercase text-gray-500 w-8">OK</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase text-gray-500">Producto</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase text-gray-500 w-24">SKU</th>
                  <th className="text-center px-3 py-2.5 text-[10px] font-bold uppercase text-gray-500 w-16">Cant.</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase text-gray-500 w-24">Precio unit.</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase text-gray-500">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {pickItems.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2.5 text-center">
                      <div className="w-4 h-4 border-2 border-gray-400 rounded mx-auto" />
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-gray-900">{item.name}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-gray-500">{item.sku || '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white text-sm font-black">
                        {item.totalQty}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-gray-500">{formatPrice(item.unitPrice)}</td>
                    <td className="px-3 py-2.5 text-[10px] text-gray-400">
                      {item.orders.map((o) => `${o.short_id}×${o.qty}`).join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td colSpan={3} className="px-3 py-2 text-xs font-bold text-gray-700">Total unidades</td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white text-sm font-black">{totalUnits}</span>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── Per-order detail ── */}
          {orders.map((order, idx) => {
            const items = (order.items ?? []) as OrderItem[]
            return (
              <div key={order.id} className={idx > 0 ? 'page-break mt-0' : 'mt-6'}>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-black text-gray-900">{order.short_id}</span>
                      <span className="text-[10px] uppercase tracking-widest text-gray-500">{ORDER_STATUS_MAP[order.status as OrderStatus]?.label}</span>
                    </div>
                    <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3 text-xs border-b border-gray-100">
                    <div>
                      <p className="text-gray-400 mb-0.5">Cliente</p>
                      <p className="font-semibold text-gray-900">{order.customer_name ?? '—'}</p>
                      {order.customer_phone && <p className="text-gray-500">{formatPhone(order.customer_phone)}</p>}
                      {order.customer_email && <p className="text-gray-500">{order.customer_email}</p>}
                    </div>
                    <div>
                      <p className="text-gray-400 mb-0.5">Entrega</p>
                      <p className="text-gray-700 leading-relaxed">{order.delivery_address}</p>
                      {order.delivery_instructions && <p className="text-gray-400 italic">{order.delivery_instructions}</p>}
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-center px-3 py-1.5 text-gray-400 font-semibold w-7">✓</th>
                        <th className="text-left px-3 py-1.5 text-gray-400 font-semibold">Artículo</th>
                        <th className="text-left px-3 py-1.5 text-gray-400 font-semibold w-20">SKU</th>
                        <th className="text-center px-3 py-1.5 text-gray-400 font-semibold w-12">Cant.</th>
                        <th className="text-right px-3 py-1.5 text-gray-400 font-semibold w-20">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0">
                          <td className="px-3 py-1.5 text-center"><div className="w-3.5 h-3.5 border border-gray-400 rounded mx-auto" /></td>
                          <td className="px-3 py-1.5 font-medium text-gray-900">{item.name}</td>
                          <td className="px-3 py-1.5 font-mono text-gray-400">{item.sku ?? '—'}</td>
                          <td className="px-3 py-1.5 text-center font-bold">{item.quantity}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{formatPrice(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t border-gray-200 px-4 py-2 flex justify-end gap-6 text-xs">
                    {order.discount > 0 && <span className="text-red-500">Dto: -{formatPrice(order.discount)}</span>}
                    <span className="text-gray-500">Envío: {order.shipping_fee === 0 ? 'Gratis' : formatPrice(order.shipping_fee)}</span>
                    <span className="font-bold text-sm text-gray-900">Total: {formatPrice(order.total)}</span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* ── Signature ── */}
          <div className="mt-8 pt-6 border-t border-gray-300 grid grid-cols-2 gap-8 text-xs">
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
