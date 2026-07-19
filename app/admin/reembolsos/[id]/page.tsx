'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Mail, ShoppingBag, CreditCard, Calendar, FileText,
  Loader2, AlertCircle, Hash,
} from 'lucide-react'

import { Separator } from '@/components/ui/separator'

import type { OrderRefund, RefundStatus } from '@/types'
import { REFUND_STATUS_MAP, PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'
import { formatPrice, formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

function statusMeta(status: RefundStatus) {
  return REFUND_STATUS_MAP[status] ?? REFUND_STATUS_MAP.pending
}

function StatusBadge({ status }: { status: RefundStatus }) {
  const m = statusMeta(status)
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold', m.color, m.bgColor, m.borderColor)}>
      {m.icon} {m.label}
    </span>
  )
}

export default function RefundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [refund, setRefund] = useState<OrderRefund | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchRefund = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/refunds/${id}`)
      const json = await res.json() as { data?: OrderRefund; error?: string }
      if (!res.ok || !json.data) {
        setError(json.error ?? 'Reembolso no encontrado')
        return
      }
      setRefund(json.data)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchRefund() }, [fetchRefund])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 text-primary-cyan animate-spin" />
      </div>
    )
  }

  if (error || !refund) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <AlertCircle className="w-10 h-10 text-gray-300" />
        <p className="text-sm text-gray-500 font-medium">{error || 'Reembolso no encontrado'}</p>
        <Link href="/admin/reembolsos" className="text-sm text-primary-cyan hover:underline">
          Volver a reembolsos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/reembolsos" className="p-2 -ml-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Reembolso</p>
          <h1 className="text-2xl font-black text-primary-dark tabular-nums">{formatPrice(refund.amount_cents)}</h1>
        </div>
        <StatusBadge status={refund.status} />
      </div>

      {/* Pedido asociado */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
          <ShoppingBag className="h-3.5 w-3.5" /> Pedido asociado
        </p>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <Link href={`/admin/pedidos/${refund.order_id}`} className="font-mono text-lg font-bold text-primary-cyan hover:underline">
              {refund.order?.short_id ?? refund.order_id}
            </Link>
            {refund.order?.customer_name && <p className="text-sm text-gray-700 mt-0.5">{refund.order.customer_name}</p>}
            {refund.order?.customer_email && (
              <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5"><Mail className="h-3 w-3" /> {refund.order.customer_email}</p>
            )}
          </div>
          {refund.order?.total != null && (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total del pedido</p>
              <p className="text-sm font-semibold tabular-nums">{formatPrice(refund.order.total)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Detalle del reembolso */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Detalle del reembolso</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-2.5">
            <CreditCard className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Método</p>
              <p className="text-sm font-medium text-gray-900">{PAYMENT_METHOD_LABELS[refund.refund_method] ?? refund.refund_method}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Fecha</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(refund.refunded_at)}</p>
            </div>
          </div>
          {refund.stripe_refund_id && (
            <div className="flex items-start gap-2.5 sm:col-span-2">
              <Hash className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-400">ID de Stripe</p>
                <p className="text-sm font-mono text-gray-900 truncate">{refund.stripe_refund_id}</p>
              </div>
            </div>
          )}
        </div>

        {refund.reason && (
          <>
            <Separator />
            <div>
              <p className="text-xs text-gray-400 mb-1">Motivo</p>
              <p className="text-sm text-gray-800">{refund.reason}</p>
            </div>
          </>
        )}

        {refund.notes && (
          <>
            <Separator />
            <div className="flex items-start gap-2.5">
              <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 mb-1">Notas internas</p>
                <p className="text-sm text-gray-800">{refund.notes}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
