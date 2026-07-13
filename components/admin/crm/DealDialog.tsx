'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EntityPicker, fetchCustomerOptions, fetchCompanyOptions, type PickerOption } from './EntityPicker'
import type { CrmDeal, CrmStage } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  stages: CrmStage[]
  deal?: CrmDeal | null
  defaultStageId?: string
}

export function DealDialog({ open, onClose, onSaved, stages, deal, defaultStageId }: Props) {
  const editing = Boolean(deal)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [stageId, setStageId] = useState('')
  const [expectedClose, setExpectedClose] = useState('')
  const [description, setDescription] = useState('')
  const [customer, setCustomer] = useState<PickerOption | null>(null)
  const [company, setCompany] = useState<PickerOption | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(deal?.title ?? '')
    setAmount(deal ? String((deal.amount_cents ?? 0) / 100) : '')
    setStageId(deal?.stage_id ?? defaultStageId ?? stages.find((s) => s.stage_type === 'open')?.id ?? stages[0]?.id ?? '')
    setExpectedClose(deal?.expected_close_date ?? '')
    setDescription(deal?.description ?? '')
    setCustomer(
      deal?.customer
        ? { id: deal.customer.id, label: deal.customer.full_name || deal.customer.email || 'Cliente', sublabel: deal.customer.email }
        : null,
    )
    setCompany(deal?.company ? { id: deal.company.id, label: deal.company.name } : null)
  }, [open, deal, defaultStageId, stages])

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('El título es requerido')
      return
    }
    setSaving(true)
    try {
      const amountCents = Math.round((parseFloat(amount) || 0) * 100)
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        amount_cents: amountCents,
        stage_id: stageId || undefined,
        expected_close_date: expectedClose || null,
        customer_id: customer?.id ?? null,
        company_id: company?.id ?? null,
      }
      const url = editing ? `/api/admin/crm/deals/${deal!.id}` : '/api/admin/crm/deals'
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Error al guardar')
      }
      toast.success(editing ? 'Oportunidad actualizada' : 'Oportunidad creada')
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
          <DialogTitle>{editing ? 'Editar oportunidad' : 'Nueva oportunidad'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Título *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Pedido mayorista Restaurante X" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Valor (MXN)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Etapa</label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary-cyan"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <EntityPicker
            label="Cliente"
            placeholder="Buscar cliente por nombre, email o teléfono"
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
            <label className="text-xs font-medium text-gray-600">Cierre estimado</label>
            <Input type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Notas</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Detalles de la oportunidad..." />
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
