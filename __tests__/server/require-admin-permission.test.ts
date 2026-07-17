import { describe, it, expect } from 'vitest'
import { hasSufficientPermission } from '../../lib/server/require-admin-permission'

describe('hasSufficientPermission', () => {
  it('total satisfies every minimum level', () => {
    expect(hasSufficientPermission('total', 'total')).toBe(true)
    expect(hasSufficientPermission('total', 'escritura')).toBe(true)
    expect(hasSufficientPermission('total', 'lectura')).toBe(true)
    expect(hasSufficientPermission('total', 'sin_acceso')).toBe(true)
  })

  it('escritura satisfies escritura and lower, not total', () => {
    expect(hasSufficientPermission('escritura', 'escritura')).toBe(true)
    expect(hasSufficientPermission('escritura', 'lectura')).toBe(true)
    expect(hasSufficientPermission('escritura', 'total')).toBe(false)
  })

  it('lectura does not satisfy escritura', () => {
    expect(hasSufficientPermission('lectura', 'escritura')).toBe(false)
    expect(hasSufficientPermission('lectura', 'lectura')).toBe(true)
  })

  it('sin_acceso never satisfies anything above sin_acceso', () => {
    expect(hasSufficientPermission('sin_acceso', 'lectura')).toBe(false)
    expect(hasSufficientPermission('sin_acceso', 'sin_acceso')).toBe(true)
  })

  it('treats an undefined level (module missing from a custom role) as sin_acceso', () => {
    expect(hasSufficientPermission(undefined, 'lectura')).toBe(false)
    expect(hasSufficientPermission(undefined, 'sin_acceso')).toBe(true)
  })
})
