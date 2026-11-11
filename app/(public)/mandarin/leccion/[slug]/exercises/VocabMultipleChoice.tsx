'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X } from 'lucide-react'

interface VocabMultipleChoiceProps {
  prompt: string
  options: string[]
  onSubmit: (response: { selected: string }) => void
  result: boolean | null
}

export function VocabMultipleChoice({ prompt, options, onSubmit, result }: VocabMultipleChoiceProps) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="rounded-3xl border border-nurei-border bg-white p-6 shadow-[0_4px_24px_rgba(17,24,39,0.06)]">
      <p className="text-lg font-semibold text-nurei-black">{prompt}</p>
      <div className="mt-4 flex flex-col gap-2.5">
        {options.map((option) => {
          const isSelected = selected === option
          return (
            <button
              key={option}
              type="button"
              disabled={result !== null}
              onClick={() => setSelected(option)}
              className={`rounded-2xl border-2 px-4 py-3 text-left font-medium transition-all disabled:cursor-not-allowed ${
                isSelected
                  ? 'border-nurei-black bg-nurei-black text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)]'
                  : 'border-nurei-border bg-nurei-surface text-nurei-black hover:border-nurei-black/40'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        {result === null && (
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onSubmit({ selected })}
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
