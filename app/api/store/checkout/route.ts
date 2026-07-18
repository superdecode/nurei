import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/supabase/queries/settings'
import { getPaymentMethods } from '@/lib/supabase/queries/paymentMethods'
import {
  normalizeShippingFromConfig,
  type CheckoutBootstrapResponse,
} from '@/lib/store/normalize-checkout-settings'

export async function GET() {
  try {
    // This payload contains only public storefront configuration. Avoid the
    // cookie-aware client so Vercel can serve the same CDN response to every
    // visitor instead of invoking a function and Supabase on each page load.
    const supabase = createServiceClient()
    const raw = await getSettings(supabase)

    const shipping = normalizeShippingFromConfig(raw.shipping)

    const checkoutRaw = raw.checkout && typeof raw.checkout === 'object' ? (raw.checkout as Record<string, unknown>) : {}
    const checkout = {
      require_account: Boolean(checkoutRaw.require_account),
      guest_checkout: checkoutRaw.guest_checkout !== false,
      min_order_cents: typeof checkoutRaw.min_order_cents === 'number' ? checkoutRaw.min_order_cents : 0,
      max_items_per_order:
        typeof checkoutRaw.max_items_per_order === 'number' ? checkoutRaw.max_items_per_order : 50,
    }

    const payment_methods = await getPaymentMethods(supabase, true)

    const payload: CheckoutBootstrapResponse = {
      shipping,
      checkout,
      payment_methods,
    }

    const response = NextResponse.json({ data: payload })
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al cargar la tienda'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
