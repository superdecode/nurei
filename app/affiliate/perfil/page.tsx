'use client'

import { useEffect, useState } from 'react'
import { Save, Edit2, X, Copy, ExternalLink, Check, Bell, CreditCard, Phone, User } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAffiliateAuthStore } from '@/lib/stores/affiliateAuth'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfileData {
  handle: string
  bio: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  referral_slug: string | null
  payment_method: string | null
  bank_name: string | null
  bank_clabe: string | null
  bank_account: string | null
  bank_holder: string | null
  payment_notes: string | null
  notify_on_sale: boolean
  notify_on_payment: boolean
  notify_weekly_summary: boolean
}

interface PaymentForm {
  payment_method: string
  bank_name: string
  bank_clabe: string
  bank_account: string
  bank_holder: string
  payment_notes: string
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-gray-100', className)} />
}

// ── Toggle component ──────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
        checked ? 'bg-primary-cyan' : 'bg-gray-200'
      )}
    >
      <span className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-6' : 'translate-x-1'
      )} />
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AffiliatePerfilPage() {
  const { user } = useAffiliateAuthStore()
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  // Identity edit
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [savingIdentity, setSavingIdentity] = useState(false)

  // Bio edit
  const [bioValue, setBioValue] = useState('')
  const [savingBio, setSavingBio] = useState(false)

  // Payment info edit
  const [editingPayment, setEditingPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    payment_method: '', bank_name: '', bank_clabe: '',
    bank_account: '', bank_holder: '', payment_notes: '',
  })
  const [savingPayment, setSavingPayment] = useState(false)

  // Notifications
  const [notifyOnSale, setNotifyOnSale] = useState(false)
  const [notifyOnPayment, setNotifyOnPayment] = useState(false)
  const [notifyWeekly, setNotifyWeekly] = useState(false)
  const [savingNotif, setSavingNotif] = useState(false)

  // Referral link copy
  const [copied, setCopied] = useState(false)

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nurei.mx'

  useEffect(() => {
    fetch('/api/affiliate/profile')
      .then((r) => r.json())
      .then(({ data }) => {
        if (!data) return
        setProfileData(data)
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
      .finally(() => setLoading(false))
  }, [])

  const referralUrl = profileData?.referral_slug ? `${siteUrl}/?ref=${profileData.referral_slug}` : null

  const copyLink = () => {
    if (!referralUrl) return
    navigator.clipboard.writeText(referralUrl)
    toast.success('Link copiado al portapapeles')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveIdentity = async () => {
    if (!phone.trim()) { toast.error('El teléfono es requerido'); return }
    setSavingIdentity(true)
    const res = await fetch('/api/affiliate/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName.trim() || null, last_name: lastName.trim() || null, phone: phone.trim() }),
    })
    if (res.ok) {
      toast.success('Información actualizada')
      setProfileData((prev) => prev ? { ...prev, first_name: firstName.trim() || null, last_name: lastName.trim() || null, phone: phone.trim() } : prev)
      setEditingIdentity(false)
    } else {
      toast.error('Error al guardar')
    }
    setSavingIdentity(false)
  }

  const saveBio = async () => {
    setSavingBio(true)
    const res = await fetch('/api/affiliate/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: bioValue }),
    })
    if (res.ok) toast.success('Bio actualizada')
    else toast.error('Error al guardar')
    setSavingBio(false)
  }

  const savePayment = async () => {
    if (paymentForm.bank_clabe && !/^\d{18}$/.test(paymentForm.bank_clabe)) {
      toast.error('La CLABE debe tener exactamente 18 dígitos numéricos')
      return
    }
    setSavingPayment(true)
    const res = await fetch('/api/affiliate/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentForm),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); setSavingPayment(false); return }
    toast.success('Datos de pago guardados')
    setProfileData((prev) => prev ? { ...prev, ...paymentForm } : prev)
    setEditingPayment(false)
    setSavingPayment(false)
  }

  const saveNotifications = async (field: string, value: boolean) => {
    setSavingNotif(true)
    const res = await fetch('/api/affiliate/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) toast.error('No se pudo guardar preferencia')
    setSavingNotif(false)
  }

  const hasPaymentInfo = profileData?.bank_holder || profileData?.bank_clabe || profileData?.bank_name

  return (
    <div className="space-y-6 pb-10 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-primary-dark">Perfil</h1>
        <p className="text-sm text-gray-400 mt-0.5">Tu información y preferencias como afiliado</p>
      </div>

      {/* ── Identity ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Información de cuenta</h2>
          {!loading && !editingIdentity && (
            <button
              type="button" onClick={() => setEditingIdentity(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Edit2 className="w-3 h-3" /> Editar
            </button>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-cyan/10 flex items-center justify-center text-lg font-black text-primary-cyan">
                {user?.handle?.slice(0, 1).toUpperCase() ?? '?'}
              </div>
              <div>
                {(profileData?.first_name || profileData?.last_name) && (
                  <p className="font-bold text-primary-dark">{[profileData.first_name, profileData.last_name].filter(Boolean).join(' ')}</p>
                )}
                <p className="font-black text-primary-dark text-lg">@{user?.handle ?? profileData?.handle}</p>
                <p className="text-sm text-gray-400">{user?.email}</p>
                {profileData?.phone && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" />{profileData.phone}
                  </p>
                )}
              </div>
            </div>

            {editingIdentity && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Nombre</label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Tu nombre" className="h-10" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Apellido</label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Tu apellido" className="h-10" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+52 55 1234 5678" className="h-10" inputMode="tel"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={saveIdentity} disabled={savingIdentity}
                    className="bg-primary-dark text-white rounded-xl h-9 px-5 font-bold"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {savingIdentity ? 'Guardando...' : 'Guardar'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditingIdentity(false)} className="rounded-xl h-9">
                    <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Bio */}
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">Bio</label>
              <textarea
                value={bioValue}
                onChange={(e) => setBioValue(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-cyan/30 focus:border-primary-cyan"
                placeholder="Cuéntale a Nurei sobre ti..."
              />
              <Button
                onClick={saveBio} disabled={savingBio}
                size="sm"
                className="mt-2 bg-primary-dark text-white rounded-xl h-9 px-5 font-bold"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {savingBio ? 'Guardando...' : 'Guardar bio'}
              </Button>
            </div>

            {/* Referral link */}
            {referralUrl && (
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Tu link de referido</label>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-mono text-primary-dark flex-1 truncate">{referralUrl}</span>
                  <button
                    type="button" onClick={copyLink}
                    className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary-cyan text-primary-dark text-xs font-bold hover:bg-primary-cyan/90 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? '¡Copiado!' : 'Copiar'}
                  </button>
                  <a
                    href={referralUrl} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Payment info ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-400" />
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Datos de pago</h2>
          </div>
          {!editingPayment && !loading && (
            <button
              type="button" onClick={() => setEditingPayment(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Edit2 className="w-3 h-3" /> Editar
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
        ) : !hasPaymentInfo && !editingPayment ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
            <CreditCard className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">Sin datos de pago registrados</p>
            <p className="text-xs text-gray-400 mt-1">Agrega tus datos para recibir tus comisiones</p>
            <button
              type="button" onClick={() => setEditingPayment(true)}
              className="mt-3 h-9 px-5 rounded-xl bg-primary-dark text-white text-sm font-bold hover:bg-primary-dark/90 transition-colors"
            >
              Agregar datos de pago
            </button>
          </div>
        ) : !editingPayment ? (
          <dl className="space-y-3">
            {[
              { label: 'Titular', value: profileData?.bank_holder },
              { label: 'Banco', value: profileData?.bank_name },
              { label: 'CLABE', value: profileData?.bank_clabe ? `••••••••••••${profileData.bank_clabe.slice(-4)}` : null },
              { label: 'Cuenta', value: profileData?.bank_account },
              { label: 'Método', value: profileData?.payment_method },
              { label: 'Notas', value: profileData?.payment_notes },
            ].filter(({ value }) => value).map(({ label, value }) => (
              <div key={label} className="flex items-start gap-4">
                <dt className="text-xs font-semibold text-gray-400 w-20 shrink-0">{label}</dt>
                <dd className="text-sm text-primary-dark">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Titular de cuenta *</label>
                <Input
                  value={paymentForm.bank_holder}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bank_holder: e.target.value })}
                  placeholder="Nombre completo del titular"
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Banco</label>
                <Input
                  value={paymentForm.bank_name}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bank_name: e.target.value })}
                  placeholder="Ej. BBVA, Santander..."
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">CLABE (18 dígitos)</label>
                <Input
                  value={paymentForm.bank_clabe}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bank_clabe: e.target.value.replace(/\D/g, '').slice(0, 18) })}
                  placeholder="000000000000000000"
                  className="h-10 font-mono"
                  inputMode="numeric"
                />
                {paymentForm.bank_clabe && paymentForm.bank_clabe.length !== 18 && paymentForm.bank_clabe.length > 0 && (
                  <p className="text-[11px] text-amber-600 mt-0.5">{paymentForm.bank_clabe.length}/18 dígitos</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Número de cuenta</label>
                <Input
                  value={paymentForm.bank_account}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bank_account: e.target.value })}
                  placeholder="Opcional"
                  className="h-10 font-mono"
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
                className="h-10"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={savePayment} disabled={savingPayment}
                className="bg-primary-dark text-white rounded-xl h-10 px-5 font-bold"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {savingPayment ? 'Guardando...' : 'Guardar datos'}
              </Button>
              <Button
                type="button" variant="ghost" onClick={() => setEditingPayment(false)}
                className="rounded-xl h-10 px-4"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Notifications ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-gray-400" />
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Notificaciones por email</h2>
          {savingNotif && <span className="text-[10px] text-gray-400">Guardando...</span>}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {[
              {
                label: 'Nueva venta generada',
                description: 'Recibe un email cada vez que se genera una comisión para ti',
                value: notifyOnSale,
                field: 'notify_on_sale',
                setter: setNotifyOnSale,
              },
              {
                label: 'Pago procesado',
                description: 'Notificación cuando se procese un pago de comisiones',
                value: notifyOnPayment,
                field: 'notify_on_payment',
                setter: setNotifyOnPayment,
              },
              {
                label: 'Resumen semanal',
                description: 'Recibe cada semana un resumen de tu desempeño como afiliado',
                value: notifyWeekly,
                field: 'notify_weekly_summary',
                setter: setNotifyWeekly,
              },
            ].map(({ label, description, value, field, setter }) => (
              <div key={field} className="flex items-center justify-between gap-4 py-1">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary-dark">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                </div>
                <Toggle
                  checked={value}
                  onChange={(v) => {
                    setter(v)
                    void saveNotifications(field, v)
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
