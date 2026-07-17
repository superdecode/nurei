'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { formatPrice } from '@/lib/utils/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'
import type { Order } from '@/types'

const REFUND_REASONS = [
  'Producto defectuoso',
  'Cliente cambió de opinión',
  'Error en el pedido',
  'Otro',
] as const

const STRIPE_PAYMENT_METHODS = new Set(['stripe_card', 'card', 'stripe'])

interface RefundModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order
  onSuccess: (updatedOrder: Order) => void
}

export function RefundModal({ open, onOpenChange, order, onSuccess }: RefundModalProps) {
  const remainingCents = Math.max(0, order.total - (order.refunded_amount_cents ?? 0))
  const isStripe = STRIPE_PAYMENT_METHODS.has(order.payment_method ?? '')

  const [amountPesos, setAmountPesos] = useState(() => (remainingCents / 100).toFixed(2))
  const [reason, setReason] = useState<string>(REFUND_REASONS[0])
  const [referenceNote, setReferenceNote] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setAmountPesos((remainingCents / 100).toFixed(2))
      setReason(REFUND_REASONS[0])
      setReferenceNote('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.id])

  const amountCents = Math.round(parseFloat(amountPesos || '0') * 100)
  const isValidAmount = Number.isFinite(amountCents) && amountCents > 0 && amountCents <= remainingCents
  const isFull = amountCents === remainingCents

  const submit = async () => {
    if (!isValidAmount) {
      toast.error('El monto no es válido')
      return
    }
    if (!isStripe && !referenceNote.trim()) {
      toast.error('Agrega una referencia del reembolso manual (folio de transferencia, etc.)')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, reason, referenceNote: referenceNote.trim() || undefined }),
      })
      const json = (await res.json()) as { data?: { order: Order }; error?: string }
      if (!res.ok) {
        toast.error(json.error ?? 'Error al procesar el reembolso')
        return
      }
      toast.success(isFull ? 'Reembolso completo procesado' : 'Reembolso parcial procesado')
      if (json.data?.order) onSuccess(json.data.order)
      onOpenChange(false)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-2xl duration-200">
        <div className="p-5 space-y-4">
          <DialogTitle className="text-base font-semibold text-gray-900">Reembolsar pedido</DialogTitle>

          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 space-y-1">
            <p>Método de pago: <span className="font-semibold">{PAYMENT_METHOD_LABELS[order.payment_method ?? ''] ?? order.payment_method ?? '—'}</span></p>
            <p>Total pagado: <span className="font-semibold">{formatPrice(order.total)}</span></p>
            {(order.refunded_amount_cents ?? 0) > 0 && (
              <p>Ya reembolsado: <span className="font-semibold">{formatPrice(order.refunded_amount_cents ?? 0)}</span></p>
            )}
            <p>Saldo reembolsable: <span className="font-semibold">{formatPrice(remainingCents)}</span></p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Monto a reembolsar (MXN)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={(remainingCents / 100).toFixed(2)}
              className="h-9 text-sm rounded-xl border-gray-200"
              value={amountPesos}
              onChange={(e) => setAmountPesos(e.target.value)}
            />
            {!isValidAmount && amountPesos !== '' && (
              <p className="text-[11px] text-red-500 mt-1">Monto inválido o mayor al saldo reembolsable</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Motivo</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-9 rounded-xl border border-gray-200 bg-white text-sm px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-cyan/30"
            >
              {REFUND_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {!isStripe && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Referencia del reembolso manual</label>
              <Input
                className="h-9 text-sm rounded-xl border-gray-200"
                value={referenceNote}
                onChange={(e) => setReferenceNote(e.target.value)}
                placeholder="Folio de transferencia, comprobante…"
              />
            </div>
          )}

          <p className="text-xs text-gray-500">
            {isStripe
              ? `Se reembolsarán ${formatPrice(amountCents || 0)} a la tarjeta vía Stripe.`
              : `Se marcará como reembolso manual confirmado por ${PAYMENT_METHOD_LABELS[order.payment_method ?? ''] ?? 'el método de pago'}.`}
          </p>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-9 rounded-xl text-sm">Cancelar</Button>
            <Button
              onClick={() => { void submit() }}
              disabled={loading || !isValidAmount}
              className="flex-1 h-9 rounded-xl text-sm font-semibold"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar reembolso'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
