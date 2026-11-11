'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X } from 'lucide-react'

interface SentenceOrderProps {
  prompt: string
  tokens: string[]
  onSubmit: (response: { order: number[] }) => void
  result: boolean | null
}

export function SentenceOrder({ prompt, tokens, onSubmit, result }: SentenceOrderProps) {
  const [picked, setPicked] = useState<number[]>([])
  const [displayOrder, setDisplayOrder] = useState<number[]>(() => tokens.map((_, index) => index))

  useEffect(() => {
    setDisplayOrder((current) => {
      const shuffled = [...current]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return shuffled
    })
  }, [])

  const remaining = displayOrder.filter((index) => !picked.includes(index))
  const locked = result !== null

  return (
    <div className="rounded-3xl border border-nurei-border bg-white p-6 shadow-[0_4px_24px_rgba(17,24,39,0.06)]">
      <p className="text-lg font-semibold text-nurei-black">{prompt}</p>

      <div className="mt-4 flex min-h-14 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-nurei-border bg-nurei-surface p-3">
        {picked.length === 0 && (
          <span className="px-1 text-sm text-nurei-muted">Toca las palabras en orden.</span>
        )}
        {picked.map((index, position) => (
          <motion.button
            key={index}
            type="button"
            disabled={locked}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => !locked && setPicked(picked.filter((_, i) => i !== position))}
            className="font-[family-name:var(--font-hanzi)] rounded-xl bg-nurei-black px-3 py-1.5 text-lg font-medium text-white shadow-[0_2px_10px_rgba(0,0,0,0.25)] drop-shadow-[0_0_8px_rgba(255,193,7,0.35)] disabled:cursor-not-allowed"
          >
            {tokens[index]}
          </motion.button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {remaining.map((index) => (
          <button
            key={index}
            type="button"
            disabled={locked}
            onClick={() => setPicked([...picked, index])}
            className="font-[family-name:var(--font-hanzi)] rounded-xl border-2 border-nurei-border px-3 py-1.5 text-lg font-medium text-nurei-black transition-all hover:border-nurei-black/40 hover:shadow-[0_4px_14px_rgba(255,193,7,0.2)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tokens[index]}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        {result === null && (
          <button
            type="button"
            disabled={picked.length !== tokens.length}
            onClick={() => onSubmit({ order: picked })}
            className="rounded-full bg-nurei-cta px-6 py-2.5 font-semibold text-nurei-black shadow-[0_4px_16px_rgba(255,193,7,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(255,193,7,0.5)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            Responder
          </button>
        )}

        <AnimatePresence>
          {result !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center gap-2 rounded-full px-4 py-2 font-semibold ${
                result
                  ? 'bg-nurei-stock/10 text-nurei-stock shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                  : 'bg-nurei-promo/10 text-nurei-promo shadow-[0_0_20px_rgba(239,68,68,0.25)]'
              }`}
            >
              {result ? <Check className="size-4" /> : <X className="size-4" />}
              {result ? 'Correcto' : 'Incorrecto'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
