import { notFound } from 'next/navigation'
import { getProductBySlug, listProducts, listVariants } from '@/lib/supabase/queries/products'
import { ProductDetailClient } from './ProductDetailClient'
import type { Product, ProductVariant } from '@/types'

export const revalidate = 60

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

  return (
    <ProductDetailClient
      initialProduct={product}
      initialVariants={variants}
      initialVariantsError={variantsError}
      initialRelated={related}
    />
  )
}
