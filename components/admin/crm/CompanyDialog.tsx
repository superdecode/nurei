'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CrmCompany } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  company?: CrmCompany | null
}

const EMPTY = {
  name: '',
  industry: '',
  domain: '',
  phone: '',
  email: '',
  city: '',
  website: '',
  tax_id: '',
  notes: '',
}

export function CompanyDialog({ open, onClose, onSaved, company }: Props) {
  const editing = Boolean(company)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      company
        ? {
            name: company.name ?? '',
            industry: company.industry ?? '',
            domain: company.domain ?? '',
            phone: company.phone ?? '',
            email: company.email ?? '',
            city: company.city ?? '',
            website: company.website ?? '',
            tax_id: company.tax_id ?? '',
            notes: company.notes ?? '',
          }
        : EMPTY,
    )
  }, [open, company])

  const set = (key: keyof typeof EMPTY, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/admin/crm/companies/${company!.id}` : '/api/admin/crm/companies'
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Error al guardar')
      }
      toast.success(editing ? 'Empresa actualizada' : 'Empresa creada')
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
          <DialogTitle>{editing ? 'Editar empresa' : 'Nueva empresa'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Nombre *">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Restaurante Sakura" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Industria">
              <Input value={form.industry} onChange={(e) => set('industry', e.target.value)} placeholder="Restaurantes" />
            </Field>
            <Field label="Ciudad">
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="CDMX" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono">
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sitio web">
              <Input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
            </Field>
            <Field label="RFC">
              <Input value={form.tax_id} onChange={(e) => set('tax_id', e.target.value)} />
            </Field>
          </div>
          <Field label="Notas">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
          </Field>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  )
}
