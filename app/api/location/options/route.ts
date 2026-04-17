import { NextRequest, NextResponse } from 'next/server'

type LocationRecord = {
  country: string
  states: Array<{
    code: string
    name: string
    cities: string[]
  }>
}

const LOCATION_DATA: LocationRecord[] = [
  {
    country: 'México',
    states: [
      { code: 'CDMX', name: 'Ciudad de México', cities: ['Cuauhtémoc', 'Coyoacán', 'Benito Juárez', 'Miguel Hidalgo'] },
      { code: 'MEX', name: 'Estado de México', cities: ['Naucalpan', 'Tlalnepantla', 'Toluca', 'Ecatepec'] },
      { code: 'JAL', name: 'Jalisco', cities: ['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Puerto Vallarta'] },
      { code: 'NL', name: 'Nuevo León', cities: ['Monterrey', 'San Pedro Garza García', 'Guadalupe', 'Apodaca'] },
      { code: 'PUE', name: 'Puebla', cities: ['Puebla', 'San Andrés Cholula', 'Tehuacán'] },
    ],
  },
  {
    country: 'Estados Unidos',
    states: [
      { code: 'CA', name: 'California', cities: ['Los Angeles', 'San Diego', 'San Francisco'] },
      { code: 'TX', name: 'Texas', cities: ['Houston', 'Dallas', 'Austin'] },
      { code: 'FL', name: 'Florida', cities: ['Miami', 'Orlando', 'Tampa'] },
    ],
  },
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type')
  const country = (searchParams.get('country') ?? '').trim()
  const state = (searchParams.get('state') ?? '').trim()
  const query = (searchParams.get('query') ?? '').trim().toLowerCase()

  if (type !== 'states' && type !== 'cities') {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  const countryRecord =
    LOCATION_DATA.find((entry) => entry.country.toLowerCase() === country.toLowerCase()) ??
    LOCATION_DATA[0]

  if (type === 'states') {
    const options = countryRecord.states
      .filter((entry) => !query || entry.name.toLowerCase().includes(query))
      .map((entry) => ({ value: entry.name, code: entry.code }))

    return NextResponse.json({ data: options })
  }

  const stateRecord = countryRecord.states.find(
    (entry) => entry.name.toLowerCase() === state.toLowerCase()
  )
  if (!stateRecord) {
    return NextResponse.json({ data: [] })
  }

  const options = stateRecord.cities
    .filter((city) => !query || city.toLowerCase().includes(query))
    .map((city) => ({ value: city }))

  return NextResponse.json({ data: options })
}
