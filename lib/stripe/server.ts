import Stripe from 'stripe'

/**
 * Lazy-initialised singleton Stripe server client.
 *
 * Do NOT instantiate at module scope — `STRIPE_SECRET_KEY` may be absent during
 * `next build` which would crash the build.  Call `getStripeServer()` inside each
 * route handler instead.
 */
let _stripe: Stripe | null = null

export function getStripeServer(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key || key === 'sk_test_placeholder') {
      throw new Error(
        'STRIPE_SECRET_KEY is not configured. Add it to .env.local and restart the dev server.'
      )
    }
    _stripe = new Stripe(key, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    })
  }
  return _stripe
}
