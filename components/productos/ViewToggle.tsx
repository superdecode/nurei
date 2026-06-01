'use client'

import { motion } from 'framer-motion'
import { Grid2x2, Grid3x3, List } from 'lucide-react'

const VIEWS = [
  { id: 'list', label: 'Lista', icon: List },
  { id: 'grid', label: 'Normal', icon: Grid2x2 },
  { id: 'compact', label: 'Compacta', icon: Grid3x3 },
] as const

export type ViewMode = 'list' | 'grid' | 'compact'

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="relative flex items-center gap-0.5 rounded-full bg-gray-100/90 p-[3px] shadow-inner shrink-0">
      {VIEWS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`relative flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150 ${
            value === id ? 'text-gray-900' : 'text-gray-400 active:text-gray-600'
          }`}
          title={label}
          aria-label={label}
        >
          {value === id && (
            <motion.span
              layoutId="nurei-view-toggle-pill"
              className="absolute inset-0 rounded-full bg-white shadow-[0_6px_16px_-8px_rgba(15,23,42,0.45)]"
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            />
          )}
          <span className="relative z-10">
            <Icon className="h-[11px] w-[11px]" />
          </span>
        </button>
      ))}
    </div>
  )
}
