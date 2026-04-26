import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/supabase/queries/settings'
import { normalizeShippingFromConfig } from '@/lib/store/normalize-checkout-settings'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const raw = await getSettings(supabase)
    const shipping = normalizeShippingFromConfig(raw.shipping)

    const storeInfoRaw =
      raw.store_info && typeof raw.store_info === 'object'
        ? (raw.store_info as Record<string, unknown>)
        : {}

    const store_info = {
      name: typeof storeInfoRaw.name === 'string' ? storeInfoRaw.name : '',
      phone: typeof storeInfoRaw.phone === 'string' ? storeInfoRaw.phone : '',
      whatsapp: typeof storeInfoRaw.whatsapp === 'string' ? storeInfoRaw.whatsapp : '',
      email: typeof storeInfoRaw.support_email === 'string'
        ? storeInfoRaw.support_email
        : typeof storeInfoRaw.email === 'string'
          ? storeInfoRaw.email
          : '',
    }

    return NextResponse.json({ data: { store_info, shipping } })
  } catch {
    return NextResponse.json({ data: null, error: 'No se pudo cargar configuración pública' }, { status: 500 })
  }
}
