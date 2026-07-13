import type { Guide, GuideCluster } from './types'
import { comprarGuides } from './data/comprar'
import { queEsAGuides } from './data/que-es-a'
import { queEsBGuides } from './data/que-es-b'
import { comoGuides } from './data/como'
import { listasGuides } from './data/listas'
import { comparativaGuides } from './data/comparativa'
import { ocasionGuides } from './data/ocasion'
import { extraAGuides } from './data/extra-a'
import { extraBGuides } from './data/extra-b'
import { extraCGuides } from './data/extra-c'
import { extraDGuides } from './data/extra-d'
import { extraEGuides } from './data/extra-e'
import { extraFGuides } from './data/extra-f'

export type { Guide, GuideCluster, GuideSection, GuideFAQ } from './types'
export { CLUSTER_META } from './types'

// Single source of truth for every guide. Order here also defines the default
// listing order on the /guias hub.
const ALL_GUIDES: Guide[] = [
  ...comprarGuides,
  ...listasGuides,
  ...queEsAGuides,
  ...queEsBGuides,
  ...comoGuides,
  ...comparativaGuides,
  ...ocasionGuides,
  ...extraAGuides,
  ...extraBGuides,
  ...extraCGuides,
  ...extraDGuides,
  ...extraEGuides,
  ...extraFGuides,
]

// Guard against duplicate slugs at module load (fails the build early if any
// two guides collide, which would break routing and the sitemap).
const seen = new Set<string>()
for (const g of ALL_GUIDES) {
  if (seen.has(g.slug)) {
    throw new Error(`[guias] Duplicate guide slug: "${g.slug}"`)
  }
  seen.add(g.slug)
}

export function getAllGuides(): Guide[] {
  return ALL_GUIDES
}

export function getGuideSlugs(): string[] {
  return ALL_GUIDES.map((g) => g.slug)
}

export function getGuideBySlug(slug: string): Guide | undefined {
  return ALL_GUIDES.find((g) => g.slug === slug)
}

export function getGuidesByCluster(cluster: GuideCluster): Guide[] {
  return ALL_GUIDES.filter((g) => g.cluster === cluster)
}

/** Resolves a guide's relatedSlugs into full Guide objects, skipping any misses. */
export function getRelatedGuides(guide: Guide): Guide[] {
  return guide.relatedSlugs
    .map((slug) => getGuideBySlug(slug))
    .filter((g): g is Guide => Boolean(g))
}

/** Clusters in display order, each with its guides, for the hub page. */
export function getGuidesGroupedByCluster(): Array<{ cluster: GuideCluster; guides: Guide[] }> {
  const order: GuideCluster[] = ['comprar', 'listas', 'que-es', 'como', 'comparativa', 'ocasion']
  return order
    .map((cluster) => ({ cluster, guides: getGuidesByCluster(cluster) }))
    .filter((group) => group.guides.length > 0)
}
