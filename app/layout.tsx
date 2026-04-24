import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { Toaster } from '@/components/ui/sonner'
import { createServiceClient } from '@/lib/supabase/server'
import './globals.css'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

async function getAppearanceSettings(): Promise<{ logo_url?: string; favicon_url?: string; store_name?: string }> {
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
    }
  } catch {
    return {}
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { logo_url, favicon_url, store_name } = await getAppearanceSettings()

  const title = store_name ? `${store_name} — Premium Asian Snacks` : 'nurei — Premium Asian Snacks'
  const faviconUrl = favicon_url || '/favicon.ico'
  const logoUrl = logo_url || '/logo.png'

  return {
    title,
    description:
      'Curaduría premium de snacks asiáticos importados. De Tokyo a tu puerta en CDMX. Real-time stock sync.',
    keywords: ['snacks asiáticos', 'importación', 'japonés', 'coreano', 'premium', 'CDMX', 'nurei'],
    manifest: '/manifest.json',
    icons: {
      icon: [
        { url: faviconUrl, sizes: 'any' },
        { url: logoUrl, type: 'image/png', sizes: '64x64' },
      ],
      apple: [{ url: logoUrl, sizes: '180x180', type: 'image/png' }],
      shortcut: faviconUrl,
    },
    openGraph: {
      title,
      description: 'Curaduría premium de snacks asiáticos. De Tokyo a CDMX.',
      type: 'website',
      images: logo_url ? [{ url: logo_url }] : [],
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
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        {children}
        <Toaster position="top-center" richColors theme="light" />
        <Analytics />
      </body>
    </html>
  )
}
