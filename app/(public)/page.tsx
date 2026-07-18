import { createServiceClient } from '@/lib/supabase/server'
import { listProducts } from '@/lib/supabase/queries/products'
import { listCategories } from '@/lib/supabase/queries/categories'
import { getSettings } from '@/lib/supabase/queries/settings'
import { HomeClient, type HomeCategory } from './HomeClient'

export const revalidate = 300

export default async function LandingPage() {
  // Service client (no cookies()) keeps this page ISR-cacheable — reading
  // cookies would force dynamic rendering on every request (Vercel cost).
  const supabase = createServiceClient()

  const [products, dbCategories, settings] = await Promise.all([
    listProducts({ status: 'active' }),
    listCategories(supabase),
    getSettings(supabase),
  ])

  const usedSlugs = new Set(products.map((p) => p.category))
  const categories: HomeCategory[] = [
    { value: 'all', label: 'Todo', emoji: '✨' },
    ...dbCategories
      .filter((c) => usedSlugs.has(c.slug))
      .map((c) => ({ value: c.slug, label: c.name, emoji: c.emoji || '🍜' })),
  ]

  const storeInfoRaw =
    settings.store_info && typeof settings.store_info === 'object'
      ? (settings.store_info as Record<string, unknown>)
      : {}
  const storeName = typeof storeInfoRaw.name === 'string' ? storeInfoRaw.name : ''
  const storeSlogan = typeof storeInfoRaw.slogan === 'string' ? storeInfoRaw.slogan : ''

  return (
    <HomeClient
      initialProducts={products}
      initialCategories={categories}
      storeName={storeName}
      storeSlogan={storeSlogan}
    />
  )
}
