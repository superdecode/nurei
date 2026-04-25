const COUNTRY_ISO: Record<string, string> = {
  // East Asia
  japon: 'JP', japón: 'JP', japan: 'JP',
  corea: 'KR', korea: 'KR', 'corea del sur': 'KR', 'south korea': 'KR',
  china: 'CN', taiwan: 'TW', 'hong kong': 'HK',
  // Southeast Asia
  tailandia: 'TH', thailand: 'TH',
  vietnam: 'VN', 'viet nam': 'VN',
  filipinas: 'PH', philippines: 'PH',
  indonesia: 'ID', malasia: 'MY', malaysia: 'MY',
  singapur: 'SG', singapore: 'SG',
  // South Asia
  india: 'IN',
  // Americas
  mexico: 'MX', méxico: 'MX',
  usa: 'US', 'estados unidos': 'US', 'united states': 'US',
  canada: 'CA', canadá: 'CA',
  // Europe
  españa: 'ES', spain: 'ES',
  italia: 'IT', italy: 'IT',
  francia: 'FR', france: 'FR',
  alemania: 'DE', germany: 'DE',
  reino_unido: 'GB', uk: 'GB',
}

function isoToFlag(code: string): string {
  return Array.from(code.toUpperCase())
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

export function countryToFlag(country: string): string {
  if (!country) return ''
  const iso = COUNTRY_ISO[country.toLowerCase().trim()]
  return iso ? isoToFlag(iso) : ''
}
