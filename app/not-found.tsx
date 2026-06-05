'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Home, UtensilsCrossed } from 'lucide-react'

const FLOATING_SNACKS = [
  { emoji: '🍜', x: '8%',  y: '18%', delay: 0,    size: 'text-4xl' },
  { emoji: '🍡', x: '88%', y: '12%', delay: 0.4,  size: 'text-3xl' },
  { emoji: '🌶️', x: '5%',  y: '68%', delay: 0.8,  size: 'text-2xl' },
  { emoji: '🍜', x: '91%', y: '72%', delay: 0.2,  size: 'text-4xl' },
  { emoji: '🍵', x: '82%', y: '40%', delay: 0.6,  size: 'text-3xl' },
  { emoji: '🥢', x: '14%', y: '45%', delay: 1.0,  size: 'text-3xl' },
  { emoji: '🍙', x: '50%', y: '6%',  delay: 0.3,  size: 'text-2xl' },
  { emoji: '🫙', x: '28%', y: '88%', delay: 0.7,  size: 'text-3xl' },
  { emoji: '🍬', x: '70%', y: '85%', delay: 0.5,  size: 'text-2xl' },
]

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-dvh flex flex-col bg-white overflow-hidden">

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-yellow-50/70 blur-[140px]" />
        <div className="absolute bottom-[-5%] left-1/4 w-[500px] h-[400px] rounded-full bg-amber-50/50 blur-[120px]" />
      </div>

      {/* Floating snacks */}
      {FLOATING_SNACKS.map((s, i) => (
        <motion.span
          key={i}
          className={`pointer-events-none fixed select-none ${s.size} opacity-20`}
          style={{ left: s.x, top: s.y }}
          initial={{ opacity: 0, y: 10, rotate: -8 }}
          animate={{
            opacity: [0, 0.2, 0.15, 0.2],
            y: [10, 0, -6, 0],
            rotate: [-8, 0, 4, 0],
          }}
          transition={{
            delay: s.delay,
            duration: 5,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'easeInOut',
          }}
        >
          {s.emoji}
        </motion.span>
      ))}

      {/* Minimal nav */}
      <header className="sticky top-0 z-40 h-14 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2 group">
          <img
            src="/logo.png"
            alt="nurei"
            className="w-7 h-7 object-contain group-hover:scale-110 transition-transform duration-200"
          />
          <span className="text-base font-black tracking-tight text-gray-900 hidden sm:block">nurei</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Inicio</span>
          </Link>
          <Link
            href="/menu"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Menú</span>
          </Link>
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full text-center">

          {/* 404 number */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="relative inline-block mb-2"
          >
            <span
              className="text-[clamp(7rem,22vw,10rem)] font-black leading-none tracking-tighter text-gray-900 select-none"
              style={{ WebkitTextStroke: '3px #FFC107' }}
            >
              404
            </span>
            <motion.span
              className="absolute -top-3 -right-3 text-3xl"
              animate={{ rotate: [0, 15, -10, 15, 0], scale: [1, 1.2, 1] }}
              transition={{ delay: 0.6, duration: 1.2, ease: 'easeInOut' }}
            >
              🍜
            </motion.span>
          </motion.div>

          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="space-y-3 mb-10"
          >
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
              Esta página se perdió en tránsito
            </h1>
            <p className="text-gray-400 text-sm sm:text-base max-w-sm mx-auto leading-relaxed">
              Como esos snacks que quedan agotados antes de que llegues. La ruta que buscas no existe o fue movida.
            </p>
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver atrás
            </button>

            <Link
              href="/menu"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-nurei-cta text-gray-900 text-sm font-bold shadow-lg shadow-nurei-cta/30 hover:shadow-xl hover:brightness-95 active:scale-95 transition-all duration-200"
            >
              <UtensilsCrossed className="w-4 h-4" />
              Ver snacks disponibles
            </Link>
          </motion.div>

          {/* Subtle divider */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-14 flex items-center gap-4"
          >
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-300 font-medium tracking-wider uppercase">o explora</span>
            <div className="flex-1 h-px bg-gray-100" />
          </motion.div>

          {/* Quick links */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.45 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-2"
          >
            {[
              { href: '/',          label: 'Inicio',       emoji: '🏠' },
              { href: '/menu',      label: 'Menú',         emoji: '🍜' },
              { href: '/nosotros',  label: 'Nosotros',     emoji: '🫶' },
              { href: '/favoritos', label: 'Favoritos',    emoji: '❤️' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gray-50 border border-gray-100 text-xs font-semibold text-gray-500 hover:text-gray-900 hover:border-nurei-cta/50 hover:bg-nurei-cta/5 transition-all duration-200"
              >
                <span className="text-sm leading-none">{link.emoji}</span>
                {link.label}
              </Link>
            ))}
          </motion.div>

        </div>
      </main>

      {/* Minimal footer */}
      <footer className="py-5 text-center border-t border-gray-50">
        <p className="text-[11px] text-gray-300 font-medium">
          &copy; {new Date().getFullYear()} nurei &middot; snacks asiáticos premium
        </p>
      </footer>

    </div>
  )
}
