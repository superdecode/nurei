import { NextRequest, NextResponse } from 'next/server'
import { MX_MUNICIPALITIES, MX_STATE_NAMES } from '@/lib/data/mexico-locations'

type LocationRecord = {
  country: string
  states: Array<{
    code: string
    name: string
    cities: string[]
  }>
}

const NON_MX: LocationRecord[] = [
  {
    country: 'Estados Unidos',
    states: [
      { code: 'CA', name: 'California', cities: ['Los Angeles', 'San Diego', 'San Francisco'] },
      { code: 'TX', name: 'Texas', cities: ['Houston', 'Dallas', 'Austin'] },
      { code: 'FL', name: 'Florida', cities: ['Miami', 'Orlando', 'Tampa'] },
    ],
  },
]

function buildMexicoRecord(): LocationRecord {
  const states = MX_STATE_NAMES.map((name, idx) => ({
    code: `MX-${idx}`,
    name,
    cities: [...(MX_MUNICIPALITIES[name] ?? [])],
  }))
  return { country: 'México', states }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type')
  const country = (searchParams.get('country') ?? '').trim()
  const state = (searchParams.get('state') ?? '').trim()
  const query = (searchParams.get('query') ?? '').trim().toLowerCase()

  if (type !== 'states' && type !== 'cities') {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  const mexicoRecord = buildMexicoRecord()
  const countryRecord =
    NON_MX.find((entry) => entry.country.toLowerCase() === country.toLowerCase()) ??
    mexicoRecord

  if (type === 'states') {
    const options = countryRecord.states
      .filter((entry) => !query || entry.name.toLowerCase().includes(query))
      .map((entry) => ({ value: entry.name, code: entry.code }))

    return NextResponse.json({ data: options })
  }

  const stateRecord = countryRecord.states.find((entry) => entry.name.toLowerCase() === state.toLowerCase())
  if (!stateRecord) {
    return NextResponse.json({ data: [] })
  }

  const options = stateRecord.cities
    .filter((city) => !query || city.toLowerCase().includes(query))
    .map((city) => ({ value: city }))

  return NextResponse.json({ data: options })
}
