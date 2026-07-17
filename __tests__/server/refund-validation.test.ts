import { describe, it, expect } from 'vitest'
import { validateRefundRequest, resolveRefundMethod } from '../../lib/server/refund-validation'

describe('validateRefundRequest', () => {
  const paidOrder = { total: 50000, refunded_amount_cents: 0, payment_status: 'paid' }

  it('accepts a full refund of a paid order', () => {
    const result = validateRefundRequest(paidOrder, 50000, 'Producto defectuoso')
    expect(result.ok).toBe(true)
    expect(result.remainingCents).toBe(50000)
  })

  it('accepts a partial refund', () => {
    const result = validateRefundRequest(paidOrder, 10000, 'Error en el pedido')
    expect(result.ok).toBe(true)
  })

  it('rejects an empty reason', () => {
    const result = validateRefundRequest(paidOrder, 10000, '   ')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/motivo/i)
  })

  it('rejects a zero or negative amount', () => {
    expect(validateRefundRequest(paidOrder, 0, 'Otro').ok).toBe(false)
    expect(validateRefundRequest(paidOrder, -100, 'Otro').ok).toBe(false)
  })

  it('rejects a non-integer amount', () => {
    expect(validateRefundRequest(paidOrder, 100.5, 'Otro').ok).toBe(false)
  })

  it('rejects an amount exceeding the refundable balance', () => {
    const result = validateRefundRequest(paidOrder, 50001, 'Otro')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/excede/i)
  })

  it('accounts for a previous partial refund when checking the remaining balance', () => {
    const partiallyRefunded = { total: 50000, refunded_amount_cents: 30000, payment_status: 'partially_refunded' }
    expect(validateRefundRequest(partiallyRefunded, 20000, 'Otro').ok).toBe(true)
    expect(validateRefundRequest(partiallyRefunded, 20001, 'Otro').ok).toBe(false)
  })

  it('rejects an order that is not paid', () => {
    const pendingOrder = { total: 50000, refunded_amount_cents: 0, payment_status: 'pending' }
    expect(validateRefundRequest(pendingOrder, 10000, 'Otro').ok).toBe(false)
  })

  it('rejects an order that is already fully refunded', () => {
    const refundedOrder = { total: 50000, refunded_amount_cents: 50000, payment_status: 'refunded' }
    expect(validateRefundRequest(refundedOrder, 100, 'Otro').ok).toBe(false)
  })
})

describe('resolveRefundMethod', () => {
  it('resolves stripe payment methods', () => {
    expect(resolveRefundMethod('stripe_card')).toBe('stripe')
    expect(resolveRefundMethod('card')).toBe('stripe')
    expect(resolveRefundMethod('stripe')).toBe('stripe')
  })

  it('resolves bank transfer methods', () => {
    expect(resolveRefundMethod('transfer')).toBe('bank_transfer')
    expect(resolveRefundMethod('bank_transfer')).toBe('bank_transfer')
  })

  it('resolves cash methods', () => {
    expect(resolveRefundMethod('cash')).toBe('cash')
    expect(resolveRefundMethod('cash_on_delivery')).toBe('cash')
  })

  it('falls back to other for unknown or missing methods', () => {
    expect(resolveRefundMethod('mercado_pago')).toBe('other')
    expect(resolveRefundMethod(null)).toBe('other')
    expect(resolveRefundMethod(undefined)).toBe('other')
  })
})
