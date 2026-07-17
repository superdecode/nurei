export interface AudienceFilterInput {
  segments: string[]
  tags: string[]
}

export interface AudienceFilter {
  segments: string[]
  tags: string[]
  excludeSegments: string[]
  acceptsEmailMarketing: true
  isActive: true
}

export function buildAudienceFilter(input: AudienceFilterInput): AudienceFilter {
  const segments = [...new Set(input.segments)].filter((s) => s !== 'blacklist')
  const tags = [...new Set(input.tags)]

  return {
    segments,
    tags,
    excludeSegments: ['blacklist'],
    acceptsEmailMarketing: true,
    isActive: true,
  }
}
