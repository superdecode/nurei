'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CalendarDays } from 'lucide-react'

export interface DateRange {
  dateFrom: string
  dateTo: string
}

interface Preset {
  label: string
  value: string
  getRange: () => DateRange
}

const presets: Preset[] = [
  {
    label: 'Hoy',
    value: 'today',
    getRange: () => {
      const d = new Date().toISOString().slice(0, 10)
      return { dateFrom: d, dateTo: d }
    },
  },
  {
    label: 'Ayer',
    value: 'yesterday',
    getRange: () => {
      const d = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      return { dateFrom: d, dateTo: d }
    },
  },
  {
    label: '7 días',
    value: '7d',
    getRange: () => ({
      dateFrom: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      dateTo: new Date().toISOString().slice(0, 10),
    }),
  },
  {
    label: '30 días',
    value: '30d',
    getRange: () => ({
      dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      dateTo: new Date().toISOString().slice(0, 10),
    }),
  },
  {
    label: '90 días',
    value: '90d',
    getRange: () => ({
      dateFrom: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
      dateTo: new Date().toISOString().slice(0, 10),
    }),
  },
  {
    label: 'MTD',
    value: 'mtd',
    getRange: () => {
      const now = new Date()
      return {
        dateFrom: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
        dateTo: now.toISOString().slice(0, 10),
      }
    },
  },
  {
    label: 'YTD',
    value: 'ytd',
    getRange: () => ({
      dateFrom: `${new Date().getFullYear()}-01-01`,
      dateTo: new Date().toISOString().slice(0, 10),
    }),
  },
  {
    label: 'Custom',
    value: 'custom',
    getRange: () => ({
      dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      dateTo: new Date().toISOString().slice(0, 10),
    }),
  },
]

interface PeriodSelectorProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

export function PeriodSelector({ value, onChange, className }: PeriodSelectorProps) {
  const [activePreset, setActivePreset] = useState('30d')
  const [showCustom, setShowCustom] = useState(false)

  const handlePreset = (preset: Preset) => {
    setActivePreset(preset.value)
    if (preset.value === 'custom') {
      setShowCustom(true)
    } else {
      setShowCustom(false)
      onChange(preset.getRange())
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              activePreset === p.value
                ? 'bg-amber-400 text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-gray-400" />
          <input
            type="date"
            value={value.dateFrom}
            max={value.dateTo}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
          />
          <span className="text-gray-400 text-xs">a</span>
          <input
            type="date"
            value={value.dateTo}
            min={value.dateFrom}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
          />
        </div>
      )}
    </div>
  )
}
