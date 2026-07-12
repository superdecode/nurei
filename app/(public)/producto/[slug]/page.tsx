import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getProductBySlug, listProducts, listVariants } from '@/lib/supabase/queries/products'
import { resolvePublicUrl } from '@/lib/utils/resolve-origin'
import { ProductDetailClient } from './ProductDetailClient'
import type { Product, ProductVariant } from '@/types'

export const revalidate = 60

// Empty list + revalidate enables ISR for product pages: each slug is
// rendered on first request, then served from cache for 60s (Vercel cost).
export async function generateStaticParams() {
  return []
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  let product: Product
  try {
    product = await getProductBySlug(slug)
  } catch {
    return { title: 'Producto no encontrado' }
  }

  const base = resolvePublicUrl()
  const description = product.description
    ? stripHtml(product.description).slice(0, 160)
    : `Compra ${product.name} en nurei — snacks asiáticos premium con envío en CDMX.`
  const image = product.images?.[0]

  return {
    title: `${product.name} | nurei`,
    description,
    alternates: base ? { canonical: `${base}/producto/${product.slug}` } : undefined,
    openGraph: {
      title: product.name,
      description,
      type: 'website',
      url: base ? `${base}/producto/${product.slug}` : undefined,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: product.name,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let product: Product
  try {
    product = await getProductBySlug(slug)
  } catch {
    notFound()
  }

  let variants: ProductVariant[] = product.variants ?? []
  let variantsError = false
  if (product.has_variants) {
    try {
      variants = await listVariants(product.id)
    } catch {
      variantsError = true
    }
  }

  let related: Product[] = []
  try {
    const categoryProducts = await listProducts({ category: product.category, status: 'active' })
    related = categoryProducts.filter((p) => p.id !== product.id).slice(0, 4)
  } catch {
    related = []
  }

  const base = resolvePublicUrl()
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description ? stripHtml(product.description).slice(0, 300) : undefined,
    image: product.images?.length ? product.images : undefined,
    url: base ? `${base}/producto/${product.slug}` : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'MXN',
      price: (product.price / 100).toFixed(2),
      availability:
        product.status === 'active' && (product.stock_quantity ?? 0) > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <ProductDetailClient
        initialProduct={product}
        initialVariants={variants}
        initialVariantsError={variantsError}
        initialRelated={related}
      />
    </>
  )
}
