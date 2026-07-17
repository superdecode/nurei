'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Grid2x2, Grid3x3, List, X } from 'lucide-react'

const VIEWS = [
  { id: 'list', label: 'Lista', icon: List },
  { id: 'grid', label: 'Normal', icon: Grid2x2 },
  { id: 'compact', label: 'Compacta', icon: Grid3x3 },
] as const

export type ViewMode = 'list' | 'grid' | 'compact'

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  layoutId?: string
}

const HINT_SHOWN_KEY = 'nurei-view-hint-shown-at'
const HINT_NEVER_KEY = 'nurei-view-hint-never'
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function shouldShowHint(): boolean {
  try {
    if (localStorage.getItem(HINT_NEVER_KEY) === 'true') return false
    const shownAt = localStorage.getItem(HINT_SHOWN_KEY)
    if (!shownAt) return true
    return Date.now() - Number(shownAt) >= THIRTY_DAYS_MS
  } catch {
    return false
  }
}

function markHintShown() {
  try { localStorage.setItem(HINT_SHOWN_KEY, String(Date.now())) } catch {}
}

function markHintNever() {
  try {
    localStorage.setItem(HINT_NEVER_KEY, 'true')
    localStorage.removeItem(HINT_SHOWN_KEY)
  } catch {}
}

export function ViewToggle({ value, onChange, layoutId = 'nurei-view-toggle-pill' }: ViewToggleProps) {
  const [showHint, setShowHint] = useState(false)
  const shownRef = useRef(false)

  useEffect(() => {
    if (shownRef.current) return
    const timer = setTimeout(() => {
      if (shouldShowHint()) {
        setShowHint(true)
        markHintShown()
        shownRef.current = true
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  const handleChange = (mode: ViewMode) => {
    setShowHint(false)
    onChange(mode)
  }

  const handleDismiss = () => setShowHint(false)

  const handleNever = () => {
    markHintNever()
    setShowHint(false)
  }

  return (
    <div className="relative">
      <div className="relative flex items-center gap-0.5 rounded-full bg-gray-100/90 p-[3px] shadow-inner shrink-0">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleChange(id)}
            className={`relative flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150 ${
              value === id ? 'text-gray-900' : 'text-gray-400 active:text-gray-600'
            }`}
            title={label}
            aria-label={label}
          >
            {value === id && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-white shadow-[0_6px_16px_-8px_rgba(15,23,42,0.45)]"
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              />
            )}
            <span className="relative z-10">
              <Icon className="h-[11px] w-[11px]" />
            </span>
          </button>
        ))}

        {showHint && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-nurei-cta">
            <span className="absolute inset-0 rounded-full bg-nurei-cta animate-ping opacity-60" />
          </span>
        )}
      </div>

      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-[calc(100%+12px)] z-50 w-56 rounded-2xl bg-white shadow-xl overflow-visible"
            style={{ border: '1px solid rgba(0,0,0,0.07)' }}
          >
            {/* Arrow */}
            <div
              className="absolute -top-[5px] right-4 w-2.5 h-2.5 bg-white rotate-45"
              style={{ border: '1px solid rgba(0,0,0,0.07)', borderBottom: 'none', borderRight: 'none' }}
            />

            <div className="px-4 pt-3.5 pb-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-nurei-cta/15 flex items-center justify-center flex-shrink-0">
                    <Grid2x2 size={13} className="text-nurei-cta" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-nurei-cta">
                    Vista del menú
                  </p>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0"
                  aria-label="Cerrar"
                >
                  <X size={13} />
                </button>
              </div>

              <p className="text-xs leading-relaxed text-gray-500">
                Elige entre <span className="font-semibold text-gray-700">lista, normal o compacta</span> para explorar el menú como prefieras.
              </p>

              <div className="mt-3 pt-2.5 border-t border-gray-50 flex justify-end">
                <button
                  onClick={handleNever}
                  className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  No volver a mostrar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
