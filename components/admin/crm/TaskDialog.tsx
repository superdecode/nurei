'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EntityPicker, fetchCustomerOptions, fetchCompanyOptions, type PickerOption } from './EntityPicker'
import type { CrmTask, CrmTaskPriority } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  task?: CrmTask | null
}

const PRIORITIES: { value: CrmTaskPriority; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

export function TaskDialog({ open, onClose, onSaved, task }: Props) {
  const editing = Boolean(task)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<CrmTaskPriority>('medium')
  const [dueAt, setDueAt] = useState('')
  const [customer, setCustomer] = useState<PickerOption | null>(null)
  const [company, setCompany] = useState<PickerOption | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setPriority(task?.priority ?? 'medium')
    // datetime-local wants "YYYY-MM-DDTHH:mm"
    setDueAt(task?.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : '')
    setCustomer(
      task?.customer
        ? { id: task.customer.id, label: task.customer.full_name || task.customer.email || 'Cliente', sublabel: task.customer.email }
        : null,
    )
    setCompany(task?.company ? { id: task.company.id, label: task.company.name } : null)
  }, [open, task])

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('El título es requerido')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        customer_id: customer?.id ?? null,
        company_id: company?.id ?? null,
      }
      const url = editing ? `/api/admin/crm/tasks/${task!.id}` : '/api/admin/crm/tasks'
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Error al guardar')
      }
      toast.success(editing ? 'Tarea actualizada' : 'Tarea creada')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Título *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Llamar para seguimiento" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Prioridad</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as CrmTaskPriority)}
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary-cyan"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Vence</label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>

          <EntityPicker
            label="Cliente"
            placeholder="Buscar cliente"
            value={customer}
            onChange={setCustomer}
            fetchOptions={fetchCustomerOptions}
          />
          <EntityPicker
            label="Empresa"
            placeholder="Buscar empresa"
            value={company}
            onChange={setCompany}
            fetchOptions={fetchCompanyOptions}
          />

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Descripción</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
