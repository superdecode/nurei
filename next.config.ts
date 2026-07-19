import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js inline scripts and eval needed for hydration
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com https://www.googletagmanager.com https://connect.facebook.net https://www.clarity.ms",
      "style-src 'self' 'unsafe-inline'",
      // Supabase storage for images, Stripe iframes, GA4/Meta/Clarity beacons
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} https://api.stripe.com wss://*.supabase.co https://*.google-analytics.com https://*.analytics.google.com https://www.facebook.com https://*.clarity.ms`,
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

function supabaseStorageHostname(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname
  } catch {
    return null
  }
}

const supabaseHostname = supabaseStorageHostname()

const nextConfig: NextConfig = {
  turbopack: {
    // The repository is nested under a home directory with another lockfile.
    // Pinning the root avoids scanning that broader workspace on every build.
    root: process.cwd(),
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    remotePatterns: supabaseHostname
      ? [{ protocol: 'https', hostname: supabaseHostname, pathname: '/storage/v1/object/public/**' }]
      : [],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // These pages are useful to visitors but have no search intent. Unlike a
      // robots.txt disallow, noindex can be fetched and honored by search engines.
      {
        source: '/:path(checkout|favoritos|login|registro|perfil|pedido|affiliates)/:rest*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ]
  },
  experimental: {
    workerThreads: false,
    webpackMemoryOptimizations: true,
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'framer-motion',
      '@tiptap/react',
      '@tiptap/starter-kit',
    ],
  },
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
