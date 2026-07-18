import type { Metadata } from 'next'
import { resolvePublicUrl } from '@/lib/utils/resolve-origin'

const title = 'Sobre nurei | Snacks asiáticos premium en CDMX'
const description =
  'Conoce nurei: seleccionamos snacks asiáticos importados para acercar los sabores de Japón, Corea y Asia a Ciudad de México.'

export function generateMetadata(): Metadata {
  const base = resolvePublicUrl()
  const url = base ? `${base}/nosotros` : undefined

  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title, description, type: 'website', url },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function NosotrosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
