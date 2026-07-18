import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resendSend: vi.fn(),
  maybeSingle: vi.fn(),
}))

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mocks.resendSend }
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  }),
}))

vi.mock('@/lib/utils/resolve-origin', () => ({
  resolvePublicUrl: () => 'https://www.nurei.mx',
}))

vi.mock('@/lib/server/checkout-session-store', () => ({
  getCheckoutOrder: () => null,
}))

import { sendOrderStatusEmail } from '@/lib/email/send-order-emails'

describe('sendOrderStatusEmail', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', 're_test_only')
    vi.stubEnv('EMAIL_FROM', 'Nurei <pedidos@nurei.mx>')
    mocks.maybeSingle.mockResolvedValue({
      data: {
        short_id: 'NR-1042',
        public_access_token: 'public-token',
        customer_email: 'cliente@example.com',
        customer_name: 'María',
        delivery_address: 'Roma Norte, CDMX',
        tracking_number: 'TRACK-123',
        carrier: 'Estafeta',
        total: 45900,
        created_at: '2026-07-18T12:00:00.000Z',
      },
      error: null,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    mocks.resendSend.mockReset()
    mocks.maybeSingle.mockReset()
  })

  it('awaits Resend and uses an idempotency key for a status notification', async () => {
    mocks.resendSend.mockResolvedValue({ data: { id: 'email-id' }, error: null })

    await expect(sendOrderStatusEmail('order-uuid', 'shipped')).resolves.toEqual({ sent: true })

    expect(mocks.resendSend).toHaveBeenCalledOnce()
    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Nurei <pedidos@nurei.mx>',
        to: ['cliente@example.com'],
        subject: expect.stringContaining('NR-1042'),
        html: expect.stringContaining('TRACK-123'),
      }),
      { idempotencyKey: 'order-status-order-uuid-shipped' },
    )
  })

  it('reports a Resend API rejection instead of claiming success', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.resendSend.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'Sender domain is not verified' },
    })

    await expect(sendOrderStatusEmail('order-uuid', 'delivered')).resolves.toEqual({
      sent: false,
      reason: 'resend_failed',
    })
  })

  it('does not touch Supabase or Resend when the API key is absent', async () => {
    vi.stubEnv('RESEND_API_KEY', '')

    await expect(sendOrderStatusEmail('order-uuid', 'preparing')).resolves.toEqual({
      sent: false,
      reason: 'no_api_key',
    })
    expect(mocks.maybeSingle).not.toHaveBeenCalled()
    expect(mocks.resendSend).not.toHaveBeenCalled()
  })
})
