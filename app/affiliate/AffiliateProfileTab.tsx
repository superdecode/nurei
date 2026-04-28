'use client'

import { useState, useEffect } from 'react'
import { Copy, ExternalLink, Bell, CreditCard, Phone, Save, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAffiliateAuthStore } from '@/lib/stores/affiliateAuth'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none
        ${checked ? 'bg-primary-cyan' : 'bg-gray-200'}
      `}
    >
      <span className={`
        inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform
        ${checked ? 'translate-x-5' : 'translate-x-1'}
      `} />
    </button>
  )
}

export default function AffiliateProfileTab() {
  const { user } = useAffiliateAuthStore()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [bioValue, setBioValue] = useState('')
  const [paymentForm, setPaymentForm] = useState({
    payment_method: '', bank_name: '', bank_clabe: '',
    bank_account: '', bank_holder: '', payment_notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [notifyOnSale, setNotifyOnSale] = useState(false)
  const [notifyOnPayment, setNotifyOnPayment] = useState(false)
  const [notifyWeekly, setNotifyWeekly] = useState(false)

  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim() || (typeof window !== 'undefined' ? window.location.origin.trim() : '')

  useEffect(() => {
    fetch('/api/affiliate/profile')
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) return
        setFirstName(data.first_name ?? '')
        setLastName(data.last_name ?? '')
        setPhone(data.phone ?? '')
        setBioValue(data.bio ?? '')
        setPaymentForm({
          payment_method: data.payment_method ?? '',
          bank_name: data.bank_name ?? '',
          bank_clabe: data.bank_clabe ?? '',
          bank_account: data.bank_account ?? '',
          bank_holder: data.bank_holder ?? '',
          payment_notes: data.payment_notes ?? '',
        })
        setNotifyOnSale(data.notify_on_sale ?? false)
        setNotifyOnPayment(data.notify_on_payment ?? false)
        setNotifyWeekly(data.notify_weekly_summary ?? false)
      })
  }, [])

  const referralUrl = user?.handle ? `${siteUrl}/r/${user.handle}` : null

  const copyLink = () => {
    if (!referralUrl) return
    void navigator.clipboard.writeText(referralUrl)
    toast.success('Link copiado al portapapeles')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSave = async () => {
    if (!phone.trim()) {
      toast.error('El teléfono es requerido')
      return
    }
    if (paymentForm.bank_clabe && paymentForm.bank_clabe.length > 0 && !/^\d{18}$/.test(paymentForm.bank_clabe)) {
      toast.error('La CLABE debe tener exactamente 18 dígitos numéricos')
      return
    }
    setSaving(true)
    const res = await fetch('/api/affiliate/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone: phone.trim(),
        bio: bioValue,
        ...paymentForm,
        notify_on_sale: notifyOnSale,
        notify_on_payment: notifyOnPayment,
        notify_weekly_summary: notifyWeekly,
      }),
    })
    if (res.ok) {
      toast.success('Cambios guardados')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      toast.error('Error al guardar cambios')
    }
    setSaving(false)
  }

  const hasPaymentInfo = Boolean(paymentForm.bank_holder || paymentForm.bank_clabe || paymentForm.bank_name)

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-indigo-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-indigo-900 mb-4">Información básica</h2>
        <p className="text-sm text-indigo-700 mb-4">
          Completa esta información para recibir tus comisiones correctamente
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Nombre</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Tu nombre"
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Apellido</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Tu apellido"
                className="h-10 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              Teléfono <span className="text-red-500">*</span>
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+52 55 1234 5678"
              className="h-10 text-sm"
              inputMode="tel"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Bio</label>
            <textarea
              value={bioValue}
              onChange={(e) => setBioValue(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-indigo-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-cyan/30 focus:border-primary-cyan"
              placeholder="Cuéntale a Nurei sobre ti..."
            />
          </div>

          {referralUrl && (
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Tu link de referido</label>
              <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-indigo-200">
                <span className="text-xs font-mono text-primary-dark flex-1 truncate">{referralUrl}</span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary-cyan text-primary-dark text-xs font-bold hover:bg-primary-cyan/90 transition-colors"
                >
                  {saved ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {saved ? '¡Copiado!' : 'Copiar'}
                </button>
                <a
                  href={referralUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Comparte este link para ganar comisiones por referidos
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-bold h-10 px-8 rounded-xl"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-gray-400" />
          Datos de pago
        </h2>

        {hasPaymentInfo ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Titular de cuenta *</label>
                <Input
                  value={paymentForm.bank_holder}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bank_holder: e.target.value })}
                  placeholder="Nombre completo del titular"
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Banco</label>
                <Input
                  value={paymentForm.bank_name}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bank_name: e.target.value })}
                  placeholder="Ej. BBVA, Santander..."
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">CLABE (18 dígitos)</label>
                <Input
                  value={paymentForm.bank_clabe}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bank_clabe: e.target.value.replace(/\D/g, '').slice(0, 18) })}
                  placeholder="000000000000000000"
                  className="h-10 text-sm font-mono"
                  inputMode="numeric"
                />
                {paymentForm.bank_clabe && paymentForm.bank_clabe.length !== 18 && paymentForm.bank_clabe.length > 0 && (
                  <p className="text-[11px] text-red-500 mt-0.5">{paymentForm.bank_clabe.length}/18 dígitos</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Número de cuenta</label>
                <Input
                  value={paymentForm.bank_account}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bank_account: e.target.value })}
                  placeholder="Opcional"
                  className="h-10 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Método de pago</label>
              <select
                value={paymentForm.payment_method}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm"
              >
                <option value="">Seleccionar...</option>
                <option value="bank_transfer">Transferencia bancaria</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Notas adicionales</label>
              <Input
                value={paymentForm.payment_notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_notes: e.target.value })}
                placeholder="Instrucciones especiales de pago (opcional)"
                className="h-10 text-sm"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-amber-300 p-6 text-center">
            <CreditCard className="w-12 h-12 text-amber-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-amber-700">Sin datos de pago registrados</p>
            <p className="text-xs text-amber-600 mt-1">
              Agrega tus datos bancarios para recibir tus comisiones
            </p>
            <Button
              type="button"
              onClick={() => {
                document.getElementById('bank_holder')?.focus()
              }}
              className="mt-3 h-10 px-6 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors"
            >
              Agregar datos de pago
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-400" />
          Notificaciones por email
        </h2>

        <div className="space-y-4">
          {[
            {
              label: 'Nueva venta generada',
              description: 'Recibe un email cada vez que se genera una comisión para ti',
              value: notifyOnSale,
              setter: setNotifyOnSale,
            },
            {
              label: 'Pago procesado',
              description: 'Notificación cuando se procesa un pago de comisiones',
              value: notifyOnPayment,
              setter: setNotifyOnPayment,
            },
            {
              label: 'Resumen semanal',
              description: 'Recibe cada semana un resumen de tu desempeño como afiliado',
              value: notifyWeekly,
              setter: setNotifyWeekly,
            },
          ].map(({ label, description, value, setter }) => (
            <div key={label} className="flex items-center justify-between py-2">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
              <Toggle checked={value} onChange={setter} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
