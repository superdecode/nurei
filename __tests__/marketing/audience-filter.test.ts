import { describe, it, expect } from 'vitest'
import { buildAudienceFilter } from '../../lib/marketing/audience-filter'

describe('buildAudienceFilter', () => {
  it('always includes the hard compliance guard', () => {
    const filter = buildAudienceFilter({ segments: [], tags: [] })
    expect(filter.acceptsEmailMarketing).toBe(true)
    expect(filter.isActive).toBe(true)
    expect(filter.excludeSegments).toContain('blacklist')
  })

  it('passes through requested segments unchanged', () => {
    const filter = buildAudienceFilter({ segments: ['vip', 'regular'], tags: [] })
    expect(filter.segments).toEqual(['vip', 'regular'])
  })

  it('drops blacklist even if explicitly requested', () => {
    const filter = buildAudienceFilter({ segments: ['vip', 'blacklist'], tags: [] })
    expect(filter.segments).toEqual(['vip'])
  })

  it('passes through tags unchanged', () => {
    const filter = buildAudienceFilter({ segments: [], tags: ['newsletter', 'vip-club'] })
    expect(filter.tags).toEqual(['newsletter', 'vip-club'])
  })

  it('deduplicates segments and tags', () => {
    const filter = buildAudienceFilter({ segments: ['vip', 'vip'], tags: ['a', 'a'] })
    expect(filter.segments).toEqual(['vip'])
    expect(filter.tags).toEqual(['a'])
  })
})
