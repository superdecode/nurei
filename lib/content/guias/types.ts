// Content model for the /guias SEO hub.
// Guides are authored as data (not MDX) so they render through a single ISR
// route, auto-populate the sitemap, and emit consistent JSON-LD.

export type GuideCluster =
  | 'comprar' // commercial intent — "dónde comprar…"
  | 'que-es' // informational — "qué es…"
  | 'como' // how-to — "cómo…"
  | 'listas' // listicles — "mejores…"
  | 'comparativa' // comparison / objection handling
  | 'ocasion' // gifting / culture / occasion

export interface GuideSection {
  /** Rendered as an <h2>. */
  heading: string
  /** Paragraphs. Supports inline **bold** and [label](/href) syntax. */
  body: string[]
  /** Optional bullet list rendered after the paragraphs. */
  list?: string[]
}

export interface GuideFAQ {
  question: string
  /** Supports inline **bold** and [label](/href) syntax. */
  answer: string
}

export interface Guide {
  /** URL slug: /guias/<slug>. Kebab-case, no accents. */
  slug: string
  cluster: GuideCluster
  emoji: string
  /** <h1> and card title. */
  title: string
  /** <title> tag. Keep <60 chars where possible. */
  metaTitle: string
  /** Meta description. 140-160 chars. */
  metaDescription: string
  /** Target keywords (also drives internal search / related). */
  keywords: string[]
  /** Lead paragraphs under the H1. Supports inline syntax. */
  intro: string[]
  sections: GuideSection[]
  faqs: GuideFAQ[]
  /** Slugs of related guides for internal linking. */
  relatedSlugs: string[]
  /** ISO date (YYYY-MM-DD) used for Article schema + sitemap lastmod. */
  updated: string
}

export const CLUSTER_META: Record<GuideCluster, { label: string; emoji: string; description: string }> = {
  comprar: {
    label: 'Dónde comprar',
    emoji: '🛒',
    description: 'Las mejores opciones para comprar snacks asiáticos en CDMX y en línea.',
  },
  'que-es': {
    label: 'Qué es',
    emoji: '📖',
    description: 'Guías rápidas para entender los snacks, dulces y bebidas asiáticas más virales.',
  },
  como: {
    label: 'Cómo se prepara',
    emoji: '🍳',
    description: 'Tutoriales paso a paso para disfrutar tus snacks asiáticos como un experto.',
  },
  listas: {
    label: 'Los mejores',
    emoji: '⭐',
    description: 'Rankings y selecciones de los snacks y bebidas asiáticas que tienes que probar.',
  },
  comparativa: {
    label: 'Comparativas y dudas',
    emoji: '⚖️',
    description: 'Resolvemos las dudas más comunes antes de comprar snacks importados.',
  },
  ocasion: {
    label: 'Regalo y cultura',
    emoji: '🎁',
    description: 'Ideas de regalo y cultura pop asiática alrededor del snacking.',
  },
}
