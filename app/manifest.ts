import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['appearance', 'store_info'])

    const rows = data ?? []
    const appearance = rows.find((r) => r.key === 'appearance')?.value as Record<string, string> | undefined
    const storeInfo = rows.find((r) => r.key === 'store_info')?.value as Record<string, string> | undefined

    const iconUrl = appearance?.favicon_url || '/icon-192.png'
    const storeName = storeInfo?.name || 'nurei'
    const description = storeInfo?.description || 'Curaduría premium de snacks asiáticos importados. De Tokyo a CDMX.'

    return {
      name: `${storeName} — Premium Asian Snacks`,
      short_name: storeName,
      description,
      start_url: '/',
      display: 'standalone',
      background_color: '#FFFFFF',
      theme_color: '#FFFFFF',
      orientation: 'portrait-primary',
      icons: [
        {
          src: iconUrl,
          sizes: '192x192',
          type: appearance?.favicon_url ? undefined : 'image/png',
        },
        {
          src: appearance?.logo_url || '/icon-512.png',
          sizes: '512x512',
          type: appearance?.logo_url ? undefined : 'image/png',
        },
      ],
    }
  } catch {
    return {
      name: 'nurei — Premium Asian Snacks',
      short_name: 'nurei',
      description: 'Curaduría premium de snacks asiáticos importados. De Tokyo a CDMX.',
      start_url: '/',
      display: 'standalone',
      background_color: '#FFFFFF',
      theme_color: '#FFFFFF',
      orientation: 'portrait-primary',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    }
  }
}
