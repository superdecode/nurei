'use client'

import { useEffect, useState } from 'react'
import { Tag, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'

interface TagPickerModalProps {
  open: boolean
  mode: 'add' | 'remove'
  count: number
  onClose: () => void
  onConfirm: (tag: string) => Promise<void>
}

export function TagPickerModal({ open, mode, count, onClose, onConfirm }: TagPickerModalProps) {
  const [catalog, setCatalog] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(null)
    setNewTag('')
    fetchWithCredentials('/api/admin/customers/tags')
      .then((r) => r.json())
      .then((json) => setCatalog(json.data?.tags ?? []))
      .catch(() => setCatalog([]))
  }, [open])

  const chosenTag = selected ?? newTag.trim()

  const handleConfirm = async () => {
    if (!chosenTag) return
    setSaving(true)
    try {
      // Registering a brand-new tag in the shared catalog only makes sense when adding —
      // "remove" only ever targets tags that already exist somewhere.
      if (mode === 'add' && !catalog.includes(chosenTag)) {
        await fetchWithCredentials('/api/admin/customers/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: chosenTag }),
        }).catch(() => {})
      }
      await onConfirm(chosenTag)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary-cyan/10 flex items-center justify-center">
            <Tag className="w-4 h-4 text-primary-dark" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-gray-900">
              {mode === 'add' ? 'Agregar etiqueta' : 'Quitar etiqueta'}
            </DialogTitle>
            <p className="text-xs text-gray-400">{count} cliente{count !== 1 ? 's' : ''} seleccionado{count !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="space-y-3 mt-3">
          {catalog.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Etiquetas existentes</p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {catalog.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setSelected(selected === t ? null : t); setNewTag('') }}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                      selected === t
                        ? 'bg-primary-cyan/10 border-primary-cyan/60 text-primary-dark'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {t}
                    {selected === t && <Check className="h-2.5 w-2.5" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'add' && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">O escribe una nueva</p>
              <Input
                value={newTag}
                onChange={(e) => { setNewTag(e.target.value); setSelected(null) }}
                placeholder="ej. mayorista"
                maxLength={40}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving || !chosenTag}>
            {saving ? 'Guardando…' : mode === 'add' ? 'Agregar' : 'Quitar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
