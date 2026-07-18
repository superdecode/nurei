'use client'

import { useConsent } from './ConsentProvider'

export function ConsentBanner() {
  const { consent, accept, reject } = useConsent()

  if (consent !== 'pending') return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 bg-white px-4 py-4 sm:px-6 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
        <p className="text-sm text-gray-600 flex-1">
          Ayúdanos a mejorar tu experiencia en Nurei. Usamos cookies para recordar tus preferencias,
          entender qué productos te interesan y ofrecerte una navegación más rápida y relevante.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={reject}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-full bg-primary-cyan px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-primary-cyan-hover transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
