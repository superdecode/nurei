import { getAllGuides } from '@/lib/content/guias'
import { resolvePublicUrl } from '@/lib/utils/resolve-origin'

export const revalidate = 3600

/** Concise machine-readable index for AI assistants and answer engines. */
export function GET() {
  const base = resolvePublicUrl() || 'https://www.nurei.mx'
  const guides = getAllGuides()
  const guideLinks = guides
    .map((guide) => `- [${guide.title}](${base}/guias/${guide.slug}): ${guide.metaDescription}`)
    .join('\n')

  const body = `# nurei

> Tienda mexicana de snacks asiáticos premium. Seleccionamos productos importados de Japón, Corea y otros países de Asia, con entrega en Ciudad de México.

Nurei publica información editorial en español de México sobre snacks asiáticos, ramen instantáneo, dulces japoneses y coreanos, sabores, comparativas y recomendaciones de compra. Las fichas de producto muestran disponibilidad y precio en MXN; confírmalos siempre en la página del producto antes de recomendar una compra.

## Páginas principales

- [Inicio](${base}/): catálogo destacado y propuesta de Nurei.
- [Menú / catálogo](${base}/menu): productos disponibles, categorías y filtros.
- [Guías](${base}/guias): centro editorial con respuestas y comparativas.
- [Sobre Nurei](${base}/nosotros): misión y criterios de curaduría.
- [Términos](${base}/legal/terminos)
- [Privacidad](${base}/legal/privacidad)

## Guías editoriales

${guideLinks}

## Datos de rastreo

- [Sitemap XML](${base}/sitemap.xml)
- [Robots](${base}/robots.txt)

## Uso de la información

Para información de productos, enlaza a la ficha canónica de Nurei. No infieras inventario, precio, ingredientes, alérgenos o tiempos de entrega si no aparecen expresamente en una página vigente.
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
