import { NextRequest, NextResponse } from 'next/server'
import { FREE_SHIPPING_THRESHOLD } from '@/lib/utils/constants'

type ShippingMethod = {
  id: 'standard' | 'express' | 'same_day'
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
    const postalCode = searchParams.get('postalCode') ?? ''
    const totalWeight = Number(searchParams.get('totalWeight') ?? 0)
    const subtotal = Number(searchParams.get('subtotal') ?? 0)

    const isMexico = country === 'MX' || country === 'MEXICO'
    const isCdmxLike =
      state.includes('cdmx') ||
      state.includes('ciudad de mexico') ||
      state.includes('mexico city') ||
      postalCode.startsWith('0') ||
      postalCode.startsWith('1')

    const weightKg = Math.max(0.25, totalWeight / 1000)
    const zoneMultiplier = isMexico ? (isCdmxLike ? 1 : 1.22) : 1.85
    const baseDate = new Date()

    const standardPriceRaw = Math.round((7900 + weightKg * 1300) * zoneMultiplier)
    const expressPriceRaw = Math.round((12900 + weightKg * 1800) * zoneMultiplier)
    const sameDayPriceRaw = Math.round((17900 + weightKg * 2500) * Math.max(1, zoneMultiplier - 0.12))

    const standardPrice = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : standardPriceRaw

    const methods: ShippingMethod[] = [
      {
        id: 'standard',
        label: 'Envío estándar',
        description: 'Entrega segura en 2 a 5 días hábiles.',
        price: standardPrice,
        etaLabel: isCdmxLike ? 'Llega entre 1 y 2 días' : 'Llega entre 2 y 5 días',
        estimatedDate: formatEstimatedDate(addBusinessDays(baseDate, isCdmxLike ? 2 : 4)),
      },
      {
        id: 'express',
        label: 'Envío express',
        description: 'Prioridad alta para que llegue más rápido.',
        price: expressPriceRaw,
        etaLabel: isCdmxLike ? 'Llega mañana' : 'Llega en 1 o 2 días',
        estimatedDate: formatEstimatedDate(addBusinessDays(baseDate, isCdmxLike ? 1 : 2)),
      },
    ]

    if (isMexico && isCdmxLike) {
      methods.push({
        id: 'same_day',
        label: 'Entrega mismo día',
        description: 'Disponible para pedidos confirmados antes de las 3:00 pm.',
        price: sameDayPriceRaw,
        etaLabel: 'Llega hoy',
        estimatedDate: formatEstimatedDate(baseDate),
      })
    }

    return NextResponse.json({ data: methods })
  } catch {
    return NextResponse.json(
      { error: 'No pudimos cargar los métodos de envío' },
      { status: 500 }
    )
  }
}
