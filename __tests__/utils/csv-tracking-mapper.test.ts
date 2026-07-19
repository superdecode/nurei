import { describe, it, expect } from 'vitest'
import { mapTrackingCsvRow, isValidTrackingUrl } from '@/lib/utils/csv-tracking-mapper'

describe('isValidTrackingUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isValidTrackingUrl('http://example.com/track')).toBe(true)
    expect(isValidTrackingUrl('https://rastreo.estafeta.com/ESF123')).toBe(true)
  })

  it('rejects non-http(s) schemes', () => {
    expect(isValidTrackingUrl('javascript:alert(1)')).toBe(false)
    expect(isValidTrackingUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isValidTrackingUrl('ftp://example.com')).toBe(false)
  })

  it('rejects malformed strings', () => {
    expect(isValidTrackingUrl('not a url')).toBe(false)
    expect(isValidTrackingUrl('')).toBe(false)
  })
})

describe('mapTrackingCsvRow', () => {
  it('maps the documented Spanish header names', () => {
    const row = mapTrackingCsvRow({
      folio: 'NUR-11001',
      transportadora: 'Estafeta',
      numero_guia: 'ESF123456789',
      url_tracking: 'https://rastreo.estafeta.com/ESF123456789',
    })
    expect(row).toEqual({
      folio: 'NUR-11001',
      carrier: 'Estafeta',
      tracking_number: 'ESF123456789',
      tracking_url: 'https://rastreo.estafeta.com/ESF123456789',
    })
  })

  it('accepts alternate header spellings (pedido/carrier/tracking)', () => {
    const row = mapTrackingCsvRow({
      pedido: 'NUR-22002',
      carrier: 'DHL',
      tracking: 'DHL999',
    })
    expect(row).toEqual({
      folio: 'NUR-22002',
      carrier: 'DHL',
      tracking_number: 'DHL999',
      tracking_url: undefined,
    })
  })

  it('is case-insensitive and trims header whitespace', () => {
    const row = mapTrackingCsvRow({
      ' Folio ': 'NUR-33003',
      'Transportadora': 'Coordinadora',
      'Numero_Guia': 'COOR456',
    })
    expect(row?.folio).toBe('NUR-33003')
    expect(row?.carrier).toBe('Coordinadora')
    expect(row?.tracking_number).toBe('COOR456')
  })

  it('returns null when folio is missing', () => {
    expect(mapTrackingCsvRow({ transportadora: 'DHL', numero_guia: '123' })).toBeNull()
  })

  it('returns null when carrier is missing', () => {
    expect(mapTrackingCsvRow({ folio: 'NUR-1', numero_guia: '123' })).toBeNull()
  })

  it('returns null when tracking_number is missing', () => {
    expect(mapTrackingCsvRow({ folio: 'NUR-1', transportadora: 'DHL' })).toBeNull()
  })

  it('drops an invalid tracking_url instead of failing the whole row', () => {
    const row = mapTrackingCsvRow({
      folio: 'NUR-1',
      transportadora: 'DHL',
      numero_guia: '123',
      url_tracking: 'javascript:alert(1)',
    })
    expect(row).toEqual({
      folio: 'NUR-1',
      carrier: 'DHL',
      tracking_number: '123',
      tracking_url: undefined,
    })
  })
})
