'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

type SnackWaitStage = 'creating' | 'paying' | 'confirming' | 'loading'

const STAGE_COPY: Record<SnackWaitStage, { title: string; subtitle: string }> = {
  creating: {
    title: 'Armando tu pedido',
    subtitle: 'Revisando productos, envío y promociones.',
  },
  paying: {
    title: 'Procesando pago',
    subtitle: 'Stripe está confirmando tu compra de forma segura.',
  },
  confirming: {
    title: 'Confirmando pedido',
    subtitle: 'Estamos actualizando tu orden para que quede lista.',
  },
  loading: {
    title: 'Cargando pedido',
    subtitle: 'Dame un momento mientras revisamos tu información.',
  },
}

const SNACKS = [
  {
    emoji: '🍘',
    label: 'Rice cracker',
    tilt: -8,
    delay: 0,
    y: 0,
  },
  {
    emoji: '🍜',
    label: 'Ramen cup',
    tilt: 4,
    delay: 0.18,
    y: 4,
  },
  {
    emoji: '🍿',
    label: 'Crunch mix',
    tilt: -3,
    delay: 0.36,
    y: 2,
  },
] as const

export function SnackWaitAnimation({ stage }: { stage: SnackWaitStage }) {
  const copy = STAGE_COPY[stage]

  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-amber-200/70 bg-gradient-to-b from-white via-amber-50/60 to-white p-6 sm:p-7 shadow-[0_24px_70px_-24px_rgba(245,158,11,0.45)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,193,7,0.2),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_32%)]" />
      <div className="absolute left-6 top-6 h-24 w-24 rounded-full bg-amber-200/20 blur-2xl" />
      <div className="absolute right-8 bottom-6 h-20 w-20 rounded-full bg-emerald-200/20 blur-2xl" />

      <div className="relative z-10 text-center">
        <motion.div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.2)]"
          animate={{ rotate: [-2, 2, -2], y: [0, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Sparkles className="h-6 w-6 text-amber-500" />
        </motion.div>

        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700/80">
          Nurei snack loading
        </p>
        <h2 className="mt-2 text-xl sm:text-2xl font-black text-primary-dark">{copy.title}</h2>
        <p className="mt-1 text-sm text-gray-500">{copy.subtitle}</p>

        <div className="mt-6 rounded-[24px] border border-amber-100 bg-white/85 px-4 py-4 shadow-inner">
          <div className="relative mx-auto flex h-36 max-w-[280px] items-end justify-between px-2">
            <motion.div
              className="absolute bottom-6 left-1/2 h-1 w-[82%] -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200"
              animate={{ opacity: [0.55, 1, 0.55], scaleX: [0.96, 1, 0.96] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />

            {SNACKS.map((snack) => (
              <motion.div
                key={snack.label}
                className="relative flex flex-col items-center"
                animate={{
                  y: [0, -10 - snack.y, 0],
                  rotate: [snack.tilt, snack.tilt * -0.4, snack.tilt],
                }}
                transition={{
                  duration: 2.2 + snack.delay,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: snack.delay,
                }}
              >
                <motion.div
                  className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/70 bg-gradient-to-b from-white to-amber-50 text-4xl shadow-[0_16px_30px_-16px_rgba(0,0,0,0.25)]"
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: snack.delay,
                  }}
                >
                  <span aria-hidden="true">{snack.emoji}</span>
                </motion.div>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                  {snack.label}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            {SNACKS.map((snack) => (
              <motion.span
                key={snack.label}
                className="h-2.5 w-2.5 rounded-full bg-amber-400/80"
                animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: snack.delay,
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-amber-100">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-400"
            animate={{ x: ['-10%', '95%', '-10%'] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: '28%' }}
          />
        </div>
      </div>
    </div>
  )
}
