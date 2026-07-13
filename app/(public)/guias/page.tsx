import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/layout/Container'
import {
  CLUSTER_META,
  getAllGuides,
  getGuidesGroupedByCluster,
} from '@/lib/content/guias'
import { resolvePublicUrl } from '@/lib/utils/resolve-origin'

export const revalidate = 604800 // 7 days — static content hub

const TITLE = 'Guías de snacks asiáticos | nurei'
const DESCRIPTION =
  'Todo sobre snacks asiáticos: qué es el ramen Buldak, dónde comprar dulces japoneses y coreanos en CDMX, recetas, comparativas y los mejores snacks virales.'

export function generateMetadata(): Metadata {
  const base = resolvePublicUrl()
  const url = base ? `${base}/guias` : undefined
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', url },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  }
}

export default function GuiasHubPage() {
  const groups = getGuidesGroupedByCluster()
  const all = getAllGuides()
  const base = resolvePublicUrl()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: TITLE,
    description: DESCRIPTION,
    inLanguage: 'es-MX',
    url: base ? `${base}/guias` : undefined,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: all.length,
      itemListElement: all.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: g.title,
        url: base ? `${base}/guias/${g.slug}` : undefined,
      })),
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gray-100 bg-nurei-warm py-16">
        <div className="absolute -top-20 left-1/2 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-nurei-cta/10 blur-[120px]" />
        <Container>
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-nurei-cta shadow-sm">
              📖 Guías nurei
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.1] text-gray-900 md:text-6xl">
              Todo sobre <span className="text-nurei-cta">snacks asiáticos</span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              Resolvemos las dudas más buscadas: qué es el ramen Buldak, dónde comprar dulces
              japoneses y coreanos en CDMX, recetas, comparativas y los snacks más virales de TikTok.
            </p>
          </div>
        </Container>
      </section>

      {/* Clusters */}
      <Container className="py-16">
        <div className="space-y-16">
          {groups.map(({ cluster, guides }) => {
            const meta = CLUSTER_META[cluster]
            return (
              <section key={cluster}>
                <div className="flex items-baseline gap-3">
                  <h2 className="text-2xl font-black text-gray-900 md:text-3xl">
                    <span aria-hidden className="mr-2">
                      {meta.emoji}
                    </span>
                    {meta.label}
                  </h2>
                </div>
                <p className="mt-2 max-w-2xl text-gray-500">{meta.description}</p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {guides.map((g) => (
                    <Link
                      key={g.slug}
                      href={`/guias/${g.slug}`}
                      className="group flex h-full flex-col rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-nurei-cta/40 hover:shadow-md"
                    >
                      <span aria-hidden className="text-3xl">
                        {g.emoji}
                      </span>
                      <h3 className="mt-4 font-black leading-snug text-gray-900 group-hover:text-nurei-cta">
                        {g.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-500">
                        {g.metaDescription}
                      </p>
                      <span className="mt-4 text-sm font-bold text-nurei-cta">Leer guía →</span>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {/* CTA */}
        <div className="mt-20 overflow-hidden rounded-3xl bg-gray-900 p-10 text-center md:p-14">
          <h2 className="text-3xl font-black text-white md:text-4xl">
            De la guía al antojo, en el mismo día 🧧
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-gray-300">
            Explora el catálogo de snacks asiáticos premium con entrega el mismo día en CDMX.
          </p>
          <Link
            href="/menu"
            className="mt-6 inline-flex h-14 items-center rounded-2xl bg-nurei-cta px-8 text-lg font-black text-gray-900 shadow-lg shadow-nurei-cta/20 transition-all hover:bg-white"
          >
            Ir al menú
          </Link>
        </div>
      </Container>
    </>
  )
}
