import type { MetadataRoute } from 'next'
import { resolvePublicUrl } from '@/lib/utils/resolve-origin'

export default function robots(): MetadataRoute.Robots {
  const base = resolvePublicUrl() || 'http://localhost:3500'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api/',
          '/affiliate',
          '/affiliates',
          '/checkout',
          '/perfil',
          '/pedido/',
          '/login',
          '/registro',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
