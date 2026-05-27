import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'

async function getAppearance(): Promise<{ logo_url?: string; favicon_url?: string; store_name?: string; slogan?: string }> {
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
      favicon_url: appearance?.favicon_url || undefined,
      store_name: storeInfo?.name || undefined,
      slogan: storeInfo?.slogan || undefined,
    }
  } catch {
    return {}
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { logo_url, favicon_url, store_name, slogan } = await getAppearance()
  const name = store_name ?? 'nurei'

  return {
    name,
    short_name: name,
    description: slogan || 'Premium Asian Snacks',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
