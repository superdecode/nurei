import { describe, it, expect } from 'vitest'
import { centavosToPesos } from '../../lib/tracking/currency'

describe('centavosToPesos', () => {
  it('converts centavos to pesos', () => {
    expect(centavosToPesos(15000)).toBe(150)
  })

  it('handles zero', () => {
    expect(centavosToPesos(0)).toBe(0)
  })

  it('handles non-round centavos', () => {
    expect(centavosToPesos(12550)).toBe(125.5)
  })
})
