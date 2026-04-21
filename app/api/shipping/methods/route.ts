import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/supabase/queries/settings'
import { normalizeShippingFromConfig } from '@/lib/store/normalize-checkout-settings'

type ShippingMethod = {
  id: string
  label: string
  description: string
  price: number
  etaLabel: string
  estimatedDate: string
}

function addBusinessDays(base: Date, businessDays: number) {
  const date = new Date(base)
  let remaining = businessDays

  while (remaining > 0) {
    date.setDate(date.getDate() + 1)
    const day = date.getDay()
    if (day !== 0 && day !== 6) {
      remaining -= 1
    }
  }

  return date
}

function formatEstimatedDate(date: Date) {
  return date.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const country = (searchParams.get('country') ?? 'MX').toUpperCase()
    const state = (searchParams.get('state') ?? '').toLowerCase()
    const subtotal = Number(searchParams.get('subtotal') ?? 0)

    const supabase = await createServerSupabaseClient()
    const raw = await getSettings(supabase)
    const cfg = normalizeShippingFromConfig(raw.shipping)

    const isMexico = country === 'MX' || country === 'MÉXICO' || country === 'MEXICO'
    const isCdmxLike =
      state.includes('cdmx') ||
      state.includes('ciudad de mexico') ||
      state.includes('ciudad de méxico') ||
      state.includes('mexico city')

    const baseDate = new Date()

    const freeMin = cfg.free_shipping_min_cents
    const qualifiesFree =
      typeof freeMin === 'number' && freeMin > 0 ? subtotal >= freeMin : false

    const standardPrice = qualifiesFree ? 0 : cfg.standard_fee_cents
    const expressPrice = cfg.express_fee_cents

    const methods: ShippingMethod[] = [
      {
        id: 'standard',
        label: 'Envío estándar',
        description: `Entrega en ${cfg.standard_estimated_time || cfg.legacy_estimated_time}.`,
        price: standardPrice,
        etaLabel: isMexico && isCdmxLike ? 'Llega entre 1 y 2 días' : 'Llega entre 2 y 5 días',
        estimatedDate: formatEstimatedDate(addBusinessDays(baseDate, isMexico && isCdmxLike ? 2 : 4)),
      },
      {
        id: 'express',
        label: 'Envío express',
        description: `Prioridad alta · ${cfg.express_estimated_time}.`,
        price: expressPrice,
        etaLabel: isMexico && isCdmxLike ? 'Llega mañana' : 'Llega en 1 o 2 días',
        estimatedDate: formatEstimatedDate(addBusinessDays(baseDate, isMexico && isCdmxLike ? 1 : 2)),
      },
    ]

    return NextResponse.json({ data: methods })
  } catch {
    return NextResponse.json(
      { error: 'No pudimos cargar los métodos de envío' },
      { status: 500 }
    )
  }
}
