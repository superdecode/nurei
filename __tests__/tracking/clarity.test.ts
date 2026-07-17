import { describe, it, expect, vi, afterEach } from 'vitest'
import { identifyClarityUser } from '../../lib/tracking/clarity'

describe('identifyClarityUser', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when window.clarity is unavailable', () => {
    vi.stubGlobal('window', {})
    expect(() => identifyClarityUser('user-1')).not.toThrow()
  })

  it('calls window.clarity with identify', () => {
    const clarity = vi.fn()
    vi.stubGlobal('window', { clarity })
    identifyClarityUser('user-1')
    expect(clarity).toHaveBeenCalledWith('identify', 'user-1')
  })
})
