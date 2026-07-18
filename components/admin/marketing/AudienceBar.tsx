// components/admin/marketing/AudienceBar.tsx
'use client'

import { useEffect, useState } from 'react'

const SEGMENTS = [
  { value: 'new', label: 'Nuevos' },
  { value: 'regular', label: 'Regulares' },
  { value: 'vip', label: 'VIP' },
  { value: 'at_risk', label: 'En riesgo' },
  { value: 'lost', label: 'Perdidos' },
]

interface AudienceBarProps {
  segments: string[]
  tags: string[]
  onSegmentsChange: (segments: string[]) => void
  onSaveDraft: () => void
  onSend: () => void
  saving: boolean
  sending: boolean
}

export function AudienceBar({ segments, tags, onSegmentsChange, onSaveDraft, onSend, saving, sending }: AudienceBarProps) {
  const [count, setCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)

  useEffect(() => {
    setLoadingCount(true)
    const timeout = setTimeout(() => {
      fetch('/api/admin/marketing/audience-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments, tags }),
      })
        .then((r) => r.json())
        .then((json) => setCount(json.data?.count ?? 0))
        .catch(() => setCount(null))
        .finally(() => setLoadingCount(false))
    }, 350)
    return () => clearTimeout(timeout)
  }, [segments, tags])

  const toggleSegment = (value: string) => {
    onSegmentsChange(segments.includes(value) ? segments.filter((s) => s !== value) : [...segments, value])
  }

  return (
    <div className="sticky bottom-0 rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-1.5">
        {SEGMENTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => toggleSegment(s.value)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
              segments.includes(s.value) ? 'bg-primary-dark text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-500 ml-auto">
        {loadingCount ? 'Calculando…' : count === null ? '—' : (
          <span><span className="font-bold text-gray-900">{count.toLocaleString('es-MX')}</span> destinatarios</span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saving}
          className="h-9 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar borrador'}
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={sending || !count}
          className="h-9 px-4 rounded-xl bg-primary-dark text-white text-sm font-semibold hover:bg-primary-dark/90 disabled:opacity-60"
        >
          {sending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
