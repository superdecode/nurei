import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/supabase/queries/settings'
import { normalizeShippingFromConfig } from '@/lib/store/normalize-checkout-settings'

export async function GET() {
  try {
    const supabase = createServiceClient()
    const raw = await getSettings(supabase)
    const shipping = normalizeShippingFromConfig(raw.shipping)

    const storeInfoRaw =
      raw.store_info && typeof raw.store_info === 'object'
        ? (raw.store_info as Record<string, unknown>)
        : {}

    const store_info = {
      name: typeof storeInfoRaw.name === 'string' ? storeInfoRaw.name : '',
      slogan: typeof storeInfoRaw.slogan === 'string' ? storeInfoRaw.slogan : '',
      phone: typeof storeInfoRaw.phone === 'string' ? storeInfoRaw.phone : '',
      whatsapp: typeof storeInfoRaw.whatsapp === 'string' ? storeInfoRaw.whatsapp : '',
      email: typeof storeInfoRaw.support_email === 'string'
        ? storeInfoRaw.support_email
        : typeof storeInfoRaw.email === 'string'
          ? storeInfoRaw.email
          : '',
      notes: typeof storeInfoRaw.notes === 'string' ? storeInfoRaw.notes : '',
    }

    const response = NextResponse.json({ data: { store_info, shipping } })
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
    return response
  } catch {
    return NextResponse.json({ data: null, error: 'No se pudo cargar configuración pública' }, { status: 500 })
  }
}
