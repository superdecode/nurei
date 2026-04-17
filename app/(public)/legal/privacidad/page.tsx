import Link from 'next/link'
import { Container } from '@/components/layout/Container'

export const metadata = {
  title: 'Aviso de privacidad | nurei',
  description: 'Aviso de privacidad y tratamiento de datos personales.',
}

export default function PrivacidadPage() {
  return (
    <Container className="py-12 sm:py-16 max-w-2xl">
      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">Aviso de privacidad</h1>
      <p className="text-sm text-gray-500 mb-8">
        Documento orientativo. Sustituye este texto por el aviso de privacidad conforme a la LFPDPPP y
        normativa aplicable.
      </p>
      <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
        <p>
          Los datos personales que nos proporcionas (identificación, contacto, dirección de envío y
          preferencias de comunicación) se utilizan para operar tu cuenta, procesar pedidos, cumplir
          obligaciones legales y, cuando lo autorices, enviarte información comercial.
        </p>
        <p>
          Puedes ejercer tus derechos de acceso, rectificación, cancelación u oposición según la ley,
          contactando al responsable del tratamiento a través de los medios publicados en el sitio.
        </p>
        <p>
          Las preferencias de marketing pueden actualizarse en cualquier momento desde la sección
          &quot;Cuenta&quot; de tu perfil.
        </p>
      </div>
      <p className="mt-10 text-sm">
        <Link href="/legal/terminos" className="font-bold text-nurei-cta hover:underline">
          Ver términos y condiciones
        </Link>
        {' · '}
        <Link href="/perfil" className="text-gray-500 hover:text-gray-800">
          Volver a mi cuenta
        </Link>
      </p>
    </Container>
  )
}
