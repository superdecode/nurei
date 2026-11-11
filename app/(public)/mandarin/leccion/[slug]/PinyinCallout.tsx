'use client'

import { motion } from 'framer-motion'
import { AudioButton } from './AudioButton'

interface PinyinCalloutProps {
  hanzi: string
  pinyin: string
  es: string
  caption: string
  audioUrl?: string | null
}

export function PinyinCallout({ hanzi, pinyin, es, caption, audioUrl }: PinyinCalloutProps) {
  return (
    <div className="mx-auto flex flex-col items-center gap-2 py-2 text-center">
      <div className="relative" style={{ width: 280, height: 110 }}>
        <svg viewBox="0 0 280 110" className="pointer-events-none absolute inset-0 size-full overflow-visible">
          <defs>
            <marker id="pinyin-arrowhead" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path
                d="M1.5,1.5 L8,6 L1.5,10.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-nurei-cta"
              />
            </marker>
          </defs>
          <motion.ellipse
            cx="140"
            cy="68"
            rx="115"
            ry="30"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-nurei-cta"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.8, ease: 'easeInOut' }}
          />
          <motion.path
            d="M 182 44 Q 210 22 172 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="text-nurei-cta"
            markerEnd="url(#pinyin-arrowhead)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 1, duration: 0.5, ease: 'easeInOut' }}
          />
        </svg>

        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.35 }}
          className="absolute rounded-2xl bg-nurei-cta/15 px-3 py-1.5 text-sm font-bold whitespace-nowrap text-nurei-cta-hover"
          style={{ right: 116, top: -8 }}
        >
          Pinyin
        </motion.div>

        <p
          className="absolute inset-x-0 text-center text-3xl font-semibold text-nurei-black"
          style={{ top: '62%', transform: 'translateY(-50%)' }}
        >
          {pinyin}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <p className="font-[family-name:var(--font-hanzi)] text-5xl font-bold text-nurei-black">{hanzi}</p>
        {audioUrl && <AudioButton src={audioUrl} />}
      </div>
      <p className="text-lg font-medium text-nurei-cta-hover">{es}</p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.4 }}
        className="mt-1 text-sm text-nurei-muted"
      >
        {caption}
      </motion.p>
    </div>
  )
}
