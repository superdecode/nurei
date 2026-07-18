import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'

const PRIVATE_ANALYTICS_CACHE = {
  'Cache-Control': 'private, max-age=300, stale-while-revalidate=900',
}

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const supabase = createServiceClient()

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, description, images, slug')
    .limit(1000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, description, slug')
    .limit(200)

  const { data: configRows } = await supabase
    .from('app_config')
    .select('key, value')
    .eq('key', 'appearance')
  const appearance = configRows?.[0]?.value as Record<string, string> | undefined
  const hasLogo = Boolean(appearance?.logo_url)

  const total = products?.length ?? 0
  const withDesc    = products?.filter((p) => p.description && String(p.description).trim().length > 30).length ?? 0
  const withImages  = products?.filter((p) => Array.isArray(p.images) && p.images.length > 0).length ?? 0
  const withSlug    = products?.filter((p) => p.slug && String(p.slug).trim().length > 0).length ?? 0
  const missingDesc = (products ?? []).filter((p) => !p.description || String(p.description).trim().length <= 30).map((p) => ({ id: p.id, name: p.name })).slice(0, 30)

  const catTotal        = categories?.length ?? 0
  const catWithDesc     = categories?.filter((c) => c.description && String(c.description).trim().length > 10).length ?? 0

  const score = Math.round(
    (withDesc / Math.max(total, 1)) * 40 +
    (withImages / Math.max(total, 1)) * 30 +
    (withSlug / Math.max(total, 1)) * 20 +
    (catWithDesc / Math.max(catTotal, 1)) * 10,
  )

  return NextResponse.json({
    data: {
      score,
      products: {
        total,
        with_description: withDesc,
        with_images: withImages,
        with_slug: withSlug,
        missing_description: missingDesc,
      },
      categories: {
        total: catTotal,
        with_description: catWithDesc,
      },
      checklist: [
        { label: 'Productos con descripcion (>30 chars)', passed: withDesc === total, value: `${withDesc}/${total}` },
        { label: 'Productos con imagen', passed: withImages === total, value: `${withImages}/${total}` },
        { label: 'Productos con slug URL', passed: withSlug === total, value: `${withSlug}/${total}` },
        { label: 'Categorias con descripcion', passed: catWithDesc === catTotal, value: `${catWithDesc}/${catTotal}` },
        { label: 'Open Graph configurado (logo_url)', passed: hasLogo, value: hasLogo ? 'Configurado' : 'Falta logo en Configuracion' },
        { label: 'Sitemap.xml y robots.txt', passed: true, value: 'Generados automaticamente' },
        { label: 'Metadata y JSON-LD por producto', passed: true, value: 'Activo' },
      ],
    },
  }, { headers: PRIVATE_ANALYTICS_CACHE })
}
