import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'

async function getAppearance(): Promise<{ logo_url?: string; store_name?: string }> {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['appearance', 'store_info'])
    const rows = data ?? []
    const appearance = rows.find((r) => r.key === 'appearance')?.value as Record<string, string> | undefined
    const storeInfo = rows.find((r) => r.key === 'store_info')?.value as Record<string, string> | undefined
    return {
      logo_url: appearance?.logo_url || undefined,
      store_name: storeInfo?.name || undefined,
    }
  } catch {
    return {}
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { logo_url, store_name } = await getAppearance()
  const name = store_name ?? 'nurei'
  const iconUrl = logo_url ?? '/logo.png'

  return {
    name,
    short_name: name,
    description: 'Premium Asian Snacks',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: iconUrl, sizes: '192x192', type: 'image/png' },
      { src: iconUrl, sizes: '512x512', type: 'image/png' },
    ],
  }
}
