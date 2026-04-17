import Link from 'next/link'
import { Container } from '@/components/layout/Container'

export const metadata = {
  title: 'Términos y condiciones | nurei',
  description: 'Términos de uso del sitio y servicios nurei.',
}

export default function TerminosPage() {
  return (
    <Container className="py-12 sm:py-16 max-w-2xl">
      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">Términos y condiciones</h1>
      <p className="text-sm text-gray-500 mb-8">
        Documento orientativo. Sustituye este texto por los términos legales definitivos de tu negocio.
      </p>
      <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
        <p>
          Al usar este sitio y realizar pedidos, aceptas las condiciones comerciales vigentes (precios,
          disponibilidad, tiempos de entrega y políticas de cambios o devoluciones) publicadas en el
          momento de la compra.
        </p>
        <p>
          El contenido del sitio (textos, imágenes y marcas) pertenece a sus respectivos titulares. No
          está permitido el uso indebido, copia o redistribución sin autorización.
        </p>
        <p>
          Para dudas sobre pedidos o facturación, contáctanos por los canales indicados en el sitio.
        </p>
      </div>
      <p className="mt-10 text-sm">
        <Link href="/legal/privacidad" className="font-bold text-nurei-cta hover:underline">
          Ver aviso de privacidad
        </Link>
        {' · '}
        <Link href="/perfil" className="text-gray-500 hover:text-gray-800">
          Volver a mi cuenta
        </Link>
      </p>
    </Container>
  )
}
