'use client'

import { motion } from 'framer-motion'
import { List, LayoutGrid, Columns3 } from 'lucide-react'

const VIEWS = [
  { id: 'list', label: 'Lista', icon: List },
  { id: 'grid', label: 'Cuadrícula', icon: LayoutGrid },
  { id: 'compact', label: 'Compacta', icon: Columns3 },
] as const

export type ViewMode = 'list' | 'grid' | 'compact'

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="relative flex gap-0.5 items-center bg-gray-100/80 p-1 rounded-xl shrink-0">
      {VIEWS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`relative p-1.5 rounded-lg transition-colors duration-150 ${
            value === id ? 'text-gray-900' : 'text-gray-400 active:text-gray-600'
          }`}
          title={label}
          aria-label={label}
        >
          {value === id && (
            <motion.span
              layoutId="nurei-view-toggle-pill"
              className="absolute inset-0 rounded-lg bg-white shadow-sm"
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            />
          )}
          <span className="relative z-10">
            <Icon className="w-3.5 h-3.5" />
          </span>
        </button>
      ))}
    </div>
  )
}
