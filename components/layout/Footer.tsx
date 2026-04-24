'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Container } from './Container'
import { APP_NAME, SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL } from '@/lib/utils/constants'

export function Footer() {
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        const info = data.data?.store_info as Record<string, string> | undefined
        setNotes(info?.notes ?? '')
      })
      .catch(() => {})
  }, [])

  const brandText = notes.trim() ||
    'Los mejores snacks asiáticos, seleccionados con amor y entregados frescos a tu puerta en CDMX 🇲🇽'

  return (
    <footer className="bg-white border-t border-gray-100 py-16">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="nurei" className="w-8 h-8 object-contain" />
              <span className="text-xl font-black tracking-tight text-gray-900">
                nu<span className="text-nurei-cta">rei</span>
              </span>
            </div>
            <p className="mt-4 text-gray-500 text-sm leading-relaxed max-w-xs">
              {brandText}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="badge-fresh">Pedidos activos</span>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-nurei-muted/40 uppercase tracking-wider">
              Explora
            </span>
            <Link
              href="/menu"
              className="text-gray-500 hover:text-gray-900 font-medium transition-colors text-sm"
            >
              🍘 Menú completo
            </Link>
            <Link
              href="/nosotros"
              className="text-gray-500 hover:text-gray-900 font-medium transition-colors text-sm"
            >
              ✨ Nuestra historia
            </Link>
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-900 font-medium transition-colors text-sm"
            >
              💬 Soporte WhatsApp
            </a>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-nurei-muted/40 uppercase tracking-wider">
              Legal
            </span>
            <Link
              href="#"
              className="text-gray-500 hover:text-gray-900 font-medium transition-colors text-sm"
            >
              Términos y condiciones
            </Link>
            <Link
              href="#"
              className="text-gray-500 hover:text-gray-900 font-medium transition-colors text-sm"
            >
              Política de privacidad
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-gray-500 hover:text-gray-900 font-medium transition-colors text-sm"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-400 text-xs font-medium">
            &copy; {new Date().getFullYear()} {APP_NAME}. Hecho con ❤️ en CDMX.
          </p>
          <p className="text-gray-300 text-xs">
            🍘 🌶️ 🍵 🥤
          </p>
        </div>
      </Container>
    </footer>
  )
}
