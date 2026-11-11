'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { AudioButton } from './AudioButton'
import { HanziWithPinyin } from './HanziWithPinyin'
import { usePinyinVisibility } from './usePinyinVisibility'
import type { MandarinVocabItem } from '@/types/mandarin'

interface VocabExampleModalProps {
  item: MandarinVocabItem
  onClose: () => void
  lessonSlug: string
}

export function VocabExampleModal({ item, onClose, lessonSlug }: VocabExampleModalProps) {
  const { showPinyin } = usePinyinVisibility(lessonSlug)
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          onClick={(event) => event.stopPropagation()}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-nurei-black p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-nurei-cta/20 blur-2xl"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute top-4 right-4 text-white/50 transition-colors hover:text-white"
          >
            <X className="size-5" />
          </button>
          <div className="relative flex items-center gap-2">
            <HanziWithPinyin
              hanzi={item.hanzi}
              pinyin={item.pinyin}
              showPinyin={showPinyin}
              variant="dark"
              className="text-2xl font-bold"
            />
            {item.audio_url && <AudioButton src={item.audio_url} variant="dark" />}
          </div>
          <p className="relative mt-1 text-sm text-white/60">{item.es}</p>

          {item.example_hanzi ? (
            <div className="relative mt-5 rounded-2xl bg-white/10 p-4">
              <HanziWithPinyin
                hanzi={item.example_hanzi}
                pinyin={item.example_pinyin ?? ''}
                showPinyin={showPinyin && Boolean(item.example_pinyin)}
                variant="dark"
                className="text-lg font-medium"
              />
              {item.example_es && <p className="mt-1 text-sm font-medium text-nurei-cta">{item.example_es}</p>}
            </div>
          ) : (
            <p className="relative mt-5 text-sm text-white/50">Aún no hay un ejemplo de uso para esta palabra.</p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
