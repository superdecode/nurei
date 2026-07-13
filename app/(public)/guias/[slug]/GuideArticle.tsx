import Link from 'next/link'
import { Container } from '@/components/layout/Container'
import { CLUSTER_META, type Guide } from '@/lib/content/guias'
import { renderRich } from '@/lib/content/guias/rich-text'

interface GuideArticleProps {
  guide: Guide
  related: Guide[]
}

const UPDATED_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatUpdated(iso: string): string {
  // Parse as local date to avoid TZ off-by-one from the ISO midnight-UTC default.
  const [y, m, d] = iso.split('-').map(Number)
  return UPDATED_FORMATTER.format(new Date(y, (m ?? 1) - 1, d ?? 1))
}

export function GuideArticle({ guide, related }: GuideArticleProps) {
  const cluster = CLUSTER_META[guide.cluster]

  return (
    <article className="pb-20">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-gray-100 bg-nurei-warm pt-10 pb-14">
        <div className="absolute -top-24 left-1/2 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-nurei-cta/10 blur-[120px]" />
        <Container>
          {/* Breadcrumb */}
          <nav aria-label="Ruta de navegación" className="mb-6 text-sm">
            <ol className="flex flex-wrap items-center gap-1.5 text-gray-400">
              <li>
                <Link href="/" className="hover:text-gray-700">
                  Inicio
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href="/guias" className="hover:text-gray-700">
                  Guías
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-medium text-gray-600" aria-current="page">
                {cluster.label}
              </li>
            </ol>
          </nav>

          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-nurei-cta shadow-sm">
              <span aria-hidden>{cluster.emoji}</span>
              {cluster.label}
            </span>
            <h1 className="mt-5 text-3xl font-black leading-[1.1] text-gray-900 md:text-5xl">
              <span aria-hidden className="mr-2">
                {guide.emoji}
              </span>
              {guide.title}
            </h1>
            <div className="mt-5 space-y-4 text-lg leading-relaxed text-gray-600">
              {guide.intro.map((p, i) => (
                <p key={i}>{renderRich(p)}</p>
              ))}
            </div>
            <p className="mt-6 text-xs font-medium uppercase tracking-wider text-gray-400">
              Actualizado el {formatUpdated(guide.updated)}
            </p>
          </div>
        </Container>
      </header>

      {/* Body */}
      <Container className="mt-14 max-w-3xl">
        <div className="space-y-12">
          {guide.sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-2xl font-black text-gray-900 md:text-3xl">{section.heading}</h2>
              <div className="mt-4 space-y-4 text-base leading-relaxed text-gray-600 md:text-lg">
                {section.body.map((p, j) => (
                  <p key={j}>{renderRich(p)}</p>
                ))}
              </div>
              {section.list && (
                <ul className="mt-5 space-y-3">
                  {section.list.map((item, j) => (
                    <li
                      key={j}
                      className="flex gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-base leading-relaxed text-gray-600 shadow-sm"
                    >
                      <span aria-hidden className="mt-1 text-nurei-cta">
                        ▸
                      </span>
                      <span>{renderRich(item)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Inline CTA */}
        <div className="my-14 overflow-hidden rounded-3xl bg-gray-900 p-8 text-center md:p-12">
          <h2 className="text-2xl font-black text-white md:text-3xl">
            ¿Se te antojó? Pídelo en nurei 🧧
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-gray-300">
            Snacks asiáticos premium importados, con stock real y entrega el mismo día en CDMX.
          </p>
          <Link
            href="/menu"
            className="mt-6 inline-flex h-14 items-center rounded-2xl bg-nurei-cta px-8 text-lg font-black text-gray-900 shadow-lg shadow-nurei-cta/20 transition-all hover:bg-white"
          >
            Explorar el menú
          </Link>
        </div>

        {/* FAQ */}
        {guide.faqs.length > 0 && (
          <section className="mt-4">
            <h2 className="text-2xl font-black text-gray-900 md:text-3xl">Preguntas frecuentes</h2>
            <dl className="mt-6 divide-y divide-gray-100 rounded-3xl border border-gray-100 bg-white">
              {guide.faqs.map((faq, i) => (
                <div key={i} className="px-6 py-5">
                  <dt className="text-lg font-bold text-gray-900">{faq.question}</dt>
                  <dd className="mt-2 leading-relaxed text-gray-600">{renderRich(faq.answer)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl font-black text-gray-900">Sigue leyendo</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/guias/${r.slug}`}
                  className="group flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-nurei-cta/40 hover:shadow-md"
                >
                  <span aria-hidden className="text-2xl">
                    {r.emoji}
                  </span>
                  <span>
                    <span className="block font-bold leading-snug text-gray-900 group-hover:text-nurei-cta">
                      {r.title}
                    </span>
                    <span className="mt-1 block text-sm text-gray-400">
                      {CLUSTER_META[r.cluster].label}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </Container>
    </article>
  )
}
