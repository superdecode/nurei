import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { unstable_cache } from 'next/cache'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/react'
import { Toaster } from '@/components/ui/sonner'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePublicUrl } from '@/lib/utils/resolve-origin'
import { ServiceWorkerCleanup } from './ServiceWorkerCleanup'
import { WebVitalsTracker } from '@/components/performance/WebVitalsTracker'
import './globals.css'

// next/font/google auto-hosts fonts at build time — no runtime Google dependency.
// display:'optional' avoids layout shift: if fonts aren't ready on first paint,
// system fallback is used permanently for that page load (no FOUT).
const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'optional',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'optional',
  preload: false,
  fallback: ['ui-monospace', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
})

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

const getAppearanceSettings = unstable_cache(
  async (): Promise<{ logo_url?: string; favicon_url?: string; store_name?: string; slogan?: string }> => {
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
  },
  ['appearance-settings'],
  { revalidate: 3600 }
)

export async function generateMetadata(): Promise<Metadata> {
  const { logo_url, store_name, slogan } = await getAppearanceSettings()
  const base = resolvePublicUrl()
  const brandName = store_name || 'nurei'

  const displaySlogan = slogan || 'Premium Asian Snacks'
  const title = store_name ? `${store_name} — ${displaySlogan}` : `nurei — ${displaySlogan}`

  return {
    metadataBase: base ? new URL(base) : undefined,
    title,
    applicationName: brandName,
    description:
      slogan || 'Curaduría premium de snacks asiáticos importados. De Tokyo a tu puerta en CDMX. Real-time stock sync.',
    keywords: ['snacks asiáticos', 'importación', 'japonés', 'coreano', 'premium', 'CDMX', 'nurei'],
    alternates: base ? { canonical: '/' } : undefined,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined },
    manifest: '/manifest.json',
    icons: {
      icon: [
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/icon-192.png', sizes: '180x180', type: 'image/png' }],
      shortcut: '/favicon.ico',
    },
    openGraph: {
      title,
      description: slogan || 'Curaduría premium de snacks asiáticos. De Tokyo a CDMX.',
      type: 'website',
      locale: 'es_MX',
      url: base || undefined,
      siteName: brandName,
      images: logo_url ? [{ url: logo_url }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: slogan || 'Curaduría premium de snacks asiáticos. De Tokyo a CDMX.',
      images: logo_url ? [logo_url] : undefined,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: store_name || 'nurei',
    },
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim()
  const base = resolvePublicUrl()
  const organizationSchema = base
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'OnlineStore',
            '@id': `${base}/#organization`,
            name: 'nurei',
            url: base,
            logo: `${base}/logo.png`,
            image: `${base}/logo.png`,
            description: 'Tienda mexicana de snacks asiáticos premium con entrega en Ciudad de México.',
            areaServed: {
              '@type': 'City',
              name: 'Ciudad de México',
              address: { '@type': 'PostalAddress', addressCountry: 'MX' },
            },
          },
          {
            '@type': 'WebSite',
            '@id': `${base}/#website`,
            name: 'nurei',
            url: base,
            inLanguage: 'es-MX',
            publisher: { '@id': `${base}/#organization` },
          },
        ],
      }
    : null

  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {organizationSchema ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema).replace(/</g, '\\u003c') }}
          />
        ) : null}
        {clarityId ? (
          <Script id="clarity-init" strategy="beforeInteractive">
            {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarityId}");`}
          </Script>
        ) : null}
      </head>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground" suppressHydrationWarning>
        {children}
        <Toaster position="top-center" richColors theme="light" />
        <Analytics debug={false} />
        <ServiceWorkerCleanup />
        <WebVitalsTracker />
      </body>
    </html>
  )
}
