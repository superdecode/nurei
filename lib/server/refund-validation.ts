export interface RefundableOrder {
  total: number
  refunded_amount_cents: number
  payment_status: string
}

export interface RefundValidationResult {
  ok: boolean
  error?: string
  remainingCents?: number
}

export function validateRefundRequest(
  order: RefundableOrder,
  amountCents: number,
  reason: string
): RefundValidationResult {
  if (!reason || !reason.trim()) {
    return { ok: false, error: 'El motivo es requerido' }
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: 'El monto debe ser mayor a 0' }
  }
  if (order.payment_status !== 'paid' && order.payment_status !== 'partially_refunded') {
    return { ok: false, error: 'El pedido no está pagado o ya fue reembolsado por completo' }
  }

  const remainingCents = order.total - order.refunded_amount_cents
  if (amountCents > remainingCents) {
    return {
      ok: false,
      error: `El monto excede el saldo reembolsable ($${(remainingCents / 100).toFixed(2)} MXN)`,
    }
  }

  return { ok: true, remainingCents }
}

export type RefundMethod = 'stripe' | 'cash' | 'bank_transfer' | 'other'

const STRIPE_PAYMENT_METHODS = new Set(['stripe_card', 'card', 'stripe'])
const BANK_TRANSFER_METHODS = new Set(['transfer', 'bank_transfer'])
const CASH_METHODS = new Set(['cash', 'cash_on_delivery'])

export function resolveRefundMethod(paymentMethod: string | null | undefined): RefundMethod {
  const method = paymentMethod ?? ''
  if (STRIPE_PAYMENT_METHODS.has(method)) return 'stripe'
  if (BANK_TRANSFER_METHODS.has(method)) return 'bank_transfer'
  if (CASH_METHODS.has(method)) return 'cash'
  return 'other'
}
