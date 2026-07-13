import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getGuideBySlug, getGuideSlugs, getRelatedGuides, CLUSTER_META } from '@/lib/content/guias'
import { resolvePublicUrl } from '@/lib/utils/resolve-origin'
import { GuideArticle } from './GuideArticle'

// Guides are static content: pre-render every slug at build for the best SEO
// (fully static HTML) and revalidate weekly so copy edits ship without a rebuild.
export const revalidate = 604800 // 7 days
export const dynamicParams = false

export function generateStaticParams() {
  return getGuideSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuideBySlug(slug)
  if (!guide) return { title: 'Guía no encontrada | nurei' }

  const base = resolvePublicUrl()
  const url = base ? `${base}/guias/${guide.slug}` : undefined

  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    keywords: guide.keywords,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title: guide.metaTitle,
      description: guide.metaDescription,
      type: 'article',
      url,
      publishedTime: guide.updated,
      modifiedTime: guide.updated,
    },
    twitter: {
      card: 'summary_large_image',
      title: guide.metaTitle,
      description: guide.metaDescription,
    },
  }
}

export default async function GuiaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = getGuideBySlug(slug)
  if (!guide) notFound()

  const related = getRelatedGuides(guide)
  const base = resolvePublicUrl()
  const url = base ? `${base}/guias/${guide.slug}` : undefined

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: guide.title,
        description: guide.metaDescription,
        inLanguage: 'es-MX',
        datePublished: guide.updated,
        dateModified: guide.updated,
        mainEntityOfPage: url,
        author: { '@type': 'Organization', name: 'nurei' },
        publisher: { '@type': 'Organization', name: 'nurei' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: guide.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            // Strip our inline [label](href) / **bold** markup for the schema text.
            text: faq.answer.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, ''),
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: base || undefined },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Guías',
            item: base ? `${base}/guias` : undefined,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: CLUSTER_META[guide.cluster].label,
            item: url,
          },
        ],
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <GuideArticle guide={guide} related={related} />
    </>
  )
}
