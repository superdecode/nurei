import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePublicUrl } from '@/lib/utils/resolve-origin'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = resolvePublicUrl() || 'http://localhost:3500'

  const staticEntries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/menu`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/nosotros`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/legal/terminos`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/legal/privacidad`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  try {
    const supabase = createServiceClient()
    const { data: products } = await supabase
      .from('products')
      .select('slug, updated_at')
      .eq('status', 'active')
      .not('slug', 'is', null)
      .limit(2000)

    const productEntries: MetadataRoute.Sitemap = (products ?? [])
      .filter((p) => p.slug)
      .map((p) => ({
        url: `${base}/producto/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))

    return [...staticEntries, ...productEntries]
  } catch {
    return staticEntries
  }
}
