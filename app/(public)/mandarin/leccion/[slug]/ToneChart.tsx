'use client'

import { motion } from 'framer-motion'
import { AudioButton } from './AudioButton'

interface Tone {
  number: number
  hanzi: string
  pinyin: string
  label: string
  path: string
  audioUrl: string
}

const TONES: Tone[] = [
  {
    number: 1,
    hanzi: '妈',
    pinyin: 'mā',
    label: 'Alto y plano',
    path: 'M10 20 L90 20',
    audioUrl: 'https://jotoxalbyvbppvgtdbee.supabase.co/storage/v1/object/public/mandarin-audio/ma-tono1.mp3',
  },
  {
    number: 2,
    hanzi: '麻',
    pinyin: 'má',
    label: 'Ascendente',
    path: 'M10 65 Q50 65 90 20',
    audioUrl: 'https://jotoxalbyvbppvgtdbee.supabase.co/storage/v1/object/public/mandarin-audio/ma-tono2.mp3',
  },
  {
    number: 3,
    hanzi: '马',
    pinyin: 'mǎ',
    label: 'Baja y luego sube',
    path: 'M10 55 Q40 95 50 95 Q75 95 90 35',
    audioUrl: 'https://jotoxalbyvbppvgtdbee.supabase.co/storage/v1/object/public/mandarin-audio/ma-tono3.mp3',
  },
  {
    number: 4,
    hanzi: '骂',
    pinyin: 'mà',
    label: 'Cae con fuerza',
    path: 'M10 20 L90 95',
    audioUrl: 'https://jotoxalbyvbppvgtdbee.supabase.co/storage/v1/object/public/mandarin-audio/ma-tono4.mp3',
  },
]

export function ToneChart() {
  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl bg-nurei-cta/10 p-4 text-center"
      >
        <p className="text-sm text-nurei-black">
          ¿Ves la marca sobre la vocal en <span className="font-semibold">mā</span>, <span className="font-semibold">má</span>,{' '}
          <span className="font-semibold">mǎ</span> y <span className="font-semibold">mà</span>? Esa marca{' '}
          <span className="font-semibold text-nurei-cta-hover">es el tono</span> — el pinyin ya lo indica, no hay que
          adivinarlo.
        </p>
        <p className="mt-1 text-xs text-nurei-muted">
          También se puede escribir con números: ma1, ma2, ma3, ma4 — significan exactamente lo mismo.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TONES.map((tone, index) => (
          <div
            key={tone.number}
            className="flex flex-col items-center gap-2 rounded-2xl border border-nurei-border bg-white p-4"
          >
            <span className="text-xs font-semibold text-nurei-muted">Tono {tone.number}</span>
            <svg viewBox="0 0 100 100" className="h-16 w-full" aria-hidden>
              <line x1="10" y1="95" x2="90" y2="95" stroke="currentColor" strokeWidth="1" className="text-nurei-border" />
              <motion.path
                d={tone.path}
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                className="text-nurei-cta"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: index * 0.15, ease: 'easeInOut' }}
              />
            </svg>
            <div className="flex items-center gap-1">
              <span className="font-[family-name:var(--font-hanzi)] text-2xl font-bold text-nurei-black">{tone.hanzi}</span>
              <AudioButton src={tone.audioUrl} />
            </div>
            <span className="text-sm text-nurei-muted">{tone.pinyin}</span>
            <span className="text-center text-xs text-nurei-muted">{tone.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
