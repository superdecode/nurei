'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Store, Save, Truck, Bell, Smartphone,
  MessageSquare, Palette, Upload, Mail,
  Volume2, DollarSign, MapPin, ShoppingCart, Search,
  Scale, X, Link2, Globe, Image as ImageIcon,
  Loader2, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoreSettings {
  store_info: {
    name: string
    slogan: string
    phone: string
    whatsapp: string
    email: string
    address: string
    description: string
  }
  shipping: {
    standard_fee_cents: number
    express_fee_cents: number
    free_shipping_min_cents: number
    standard_estimated_time: string
    express_estimated_time: string
    estimated_time: string
    enabled: boolean
    zones: string[]
  }
  checkout: {
    require_account: boolean
    guest_checkout: boolean
    min_order_cents: number
    max_items_per_order: number
  }
  notifications: {
    email_admin: string
    email_on_new_order: boolean
    email_on_payment: boolean
    whatsapp_customer: boolean
    sound_alerts: boolean
  }
  appearance: {
    primary_color: string
    logo_url: string
    favicon_url: string
    social_links: { instagram: string; facebook: string; tiktok: string }
  }
  seo: {
    meta_title: string
    meta_description: string
    og_image: string
  }
  legal: {
    terms_url: string
    privacy_url: string
    return_policy: string
    tax_rate: number
  }
}

const DEFAULT_SETTINGS: StoreSettings = {
  store_info: {
    name: '',
    slogan: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    description: '',
  },
  shipping: {
    standard_fee_cents: 2900,
    express_fee_cents: 5900,
    free_shipping_min_cents: 50000,
    standard_estimated_time: '3-5 días hábiles',
    express_estimated_time: '24-48 horas',
    estimated_time: '3-5 días hábiles',
    enabled: true,
    zones: [],
  },
  checkout: {
    require_account: false,
    guest_checkout: true,
    min_order_cents: 0,
    max_items_per_order: 50,
  },
  notifications: {
    email_admin: '',
    email_on_new_order: true,
    email_on_payment: true,
    whatsapp_customer: true,
    sound_alerts: true,
  },
  appearance: {
    primary_color: '#00E5FF',
    logo_url: '',
    favicon_url: '',
    social_links: { instagram: '', facebook: '', tiktok: '' },
  },
  seo: {
    meta_title: '',
    meta_description: '',
    og_image: '',
  },
  legal: {
    terms_url: '',
    privacy_url: '',
    return_policy: '',
    tax_rate: 16,
  },
}

const COLOR_OPTIONS = [
  '#00E5FF', '#F59E0B', '#EF4444', '#10B981',
  '#8B5CF6', '#0A1F2F', '#DC2626', '#EC4899',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const centsToMxn = (cents: number) => (cents / 100).toFixed(2)
const mxnToCents = (mxn: string) => Math.round(parseFloat(mxn || '0') * 100)

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-10 h-6 rounded-full transition-colors relative flex-shrink-0',
        enabled ? 'bg-primary-cyan' : 'bg-gray-200',
      )}
    >
      <span
        className={cn(
          'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
          enabled ? 'left-5' : 'left-1',
        )}
      />
    </button>
  )
}

function SectionCard({
  icon: Icon,
  title,
  index,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  index: number
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6"
    >
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg bg-primary-cyan/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary-cyan" />
        </div>
        <h2 className="text-base font-semibold text-primary-dark">{title}</h2>
      </div>
      {children}
    </motion.div>
  )
}

function ToggleRow({
  icon: Icon,
  iconColor,
  label,
  description,
  enabled,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  label: string
  description: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
      <div className="flex items-center gap-3">
        <Icon className={cn('w-4 h-4', iconColor)} />
        <div>
          <p className="text-sm font-medium text-primary-dark">{label}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
      </div>
      <Toggle enabled={enabled} onToggle={onToggle} />
    </div>
  )
}

function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
}: {
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState('')
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
      e.preventDefault()
      onAdd(draft.trim())
      setDraft('')
    }
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 text-xs bg-primary-cyan/10 text-primary-dark px-2 py-1 rounded-lg"
          >
            {t}
            <button type="button" onClick={() => onRemove(t)} className="hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className="h-10"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PaymentMethodItem {
  id: string
  name: string
  slug: string
  icon: string | null
  is_active: boolean
}

const LOCAL_COLOR_KEY = 'nurei_admin_primary_color'

export default function ConfigPage() {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([])
  const [togglingPayment, setTogglingPayment] = useState<string | null>(null)
  const [localColor, setLocalColor] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LOCAL_COLOR_KEY) ?? '#00E5FF'
    }
    return '#00E5FF'
  })

  useEffect(() => {
    const settingsP = fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.data && typeof data.data === 'object') {
          setSettings((prev) => ({
            store_info: { ...prev.store_info, ...(data.data.store_info ?? {}) },
            shipping: { ...prev.shipping, ...(data.data.shipping ?? {}) },
            checkout: { ...prev.checkout, ...(data.data.checkout ?? {}) },
            notifications: { ...prev.notifications, ...(data.data.notifications ?? {}) },
            appearance: {
              ...prev.appearance,
              ...(data.data.appearance ?? {}),
              social_links: { ...prev.appearance.social_links, ...(data.data.appearance?.social_links ?? {}) },
            },
            seo: { ...prev.seo, ...(data.data.seo ?? {}) },
            legal: { ...prev.legal, ...(data.data.legal ?? {}) },
          }))
        }
      })
    const methodsP = fetch('/api/admin/payment-methods')
      .then((r) => r.json())
      .then((data) => { if (data.data) setPaymentMethods(data.data) })
      .catch(() => {})
    Promise.all([settingsP, methodsP])
      .catch(() => toast.error('Error al cargar configuración'))
      .finally(() => setLoading(false))
  }, [])

  const handleTogglePayment = async (id: string, current: boolean) => {
    setTogglingPayment(id)
    try {
      const res = await fetch('/api/admin/payment-methods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !current }),
      })
      if (!res.ok) throw new Error()
      setPaymentMethods((prev) => prev.map((m) => m.id === id ? { ...m, is_active: !current } : m))
    } catch {
      toast.error('No se pudo cambiar el estado del método de pago')
    } finally {
      setTogglingPayment(null)
    }
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      if (!res.ok) throw new Error()
      toast.success('Configuración guardada')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [settings])

  // Immutable updaters
  const updateInfo = (field: keyof StoreSettings['store_info'], value: string) =>
    setSettings((prev) => ({ ...prev, store_info: { ...prev.store_info, [field]: value } }))

  const updateShipping = <K extends keyof StoreSettings['shipping']>(field: K, value: StoreSettings['shipping'][K]) =>
    setSettings((prev) => ({ ...prev, shipping: { ...prev.shipping, [field]: value } }))

  const updateCheckout = <K extends keyof StoreSettings['checkout']>(field: K, value: StoreSettings['checkout'][K]) =>
    setSettings((prev) => ({ ...prev, checkout: { ...prev.checkout, [field]: value } }))

  const updateNotif = <K extends keyof StoreSettings['notifications']>(field: K, value: StoreSettings['notifications'][K]) =>
    setSettings((prev) => ({ ...prev, notifications: { ...prev.notifications, [field]: value } }))

  const updateAppearance = <K extends keyof StoreSettings['appearance']>(field: K, value: StoreSettings['appearance'][K]) =>
    setSettings((prev) => ({ ...prev, appearance: { ...prev.appearance, [field]: value } }))

  const updateSocial = (field: keyof StoreSettings['appearance']['social_links'], value: string) =>
    setSettings((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        social_links: { ...prev.appearance.social_links, [field]: value },
      },
    }))

  const updateSeo = (field: keyof StoreSettings['seo'], value: string) =>
    setSettings((prev) => ({ ...prev, seo: { ...prev.seo, [field]: value } }))

  const updateLegal = <K extends keyof StoreSettings['legal']>(field: K, value: StoreSettings['legal'][K]) =>
    setSettings((prev) => ({ ...prev, legal: { ...prev.legal, [field]: value } }))

  const addZone = (zone: string) => {
    if (!settings.shipping.zones.includes(zone)) {
      updateShipping('zones', [...settings.shipping.zones, zone])
    }
  }
  const removeZone = (zone: string) =>
    updateShipping('zones', settings.shipping.zones.filter((z) => z !== zone))

  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-cyan" />
      </div>
    )
  }

  let sectionIdx = 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-primary-dark flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary-cyan" />
            Configuración
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Ajustes generales de la tienda</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'font-semibold gap-2 transition-all',
            'bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover',
          )}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </motion.div>

      {/* ── Store Info ── */}
      <SectionCard icon={Store} title="Información de la tienda" index={sectionIdx++}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nombre de la tienda</label>
              <Input value={settings.store_info.name} onChange={(e) => updateInfo('name', e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Slogan</label>
              <Input value={settings.store_info.slogan} onChange={(e) => updateInfo('slogan', e.target.value)} placeholder="Tu mejor aliado en…" className="h-10" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                <Smartphone className="w-3 h-3 inline mr-1" />Teléfono
              </label>
              <Input value={settings.store_info.phone} onChange={(e) => updateInfo('phone', e.target.value)} placeholder="+52 55 ..." className="h-10" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                <MessageSquare className="w-3 h-3 inline mr-1" />WhatsApp
              </label>
              <Input value={settings.store_info.whatsapp} onChange={(e) => updateInfo('whatsapp', e.target.value)} placeholder="+52 55 ..." className="h-10" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                <Mail className="w-3 h-3 inline mr-1" />Email
              </label>
              <Input type="email" value={settings.store_info.email} onChange={(e) => updateInfo('email', e.target.value)} placeholder="contacto@tienda.mx" className="h-10" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                <MapPin className="w-3 h-3 inline mr-1" />Dirección
              </label>
              <Input value={settings.store_info.address} onChange={(e) => updateInfo('address', e.target.value)} className="h-10" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Descripción</label>
            <textarea
              value={settings.store_info.description}
              onChange={(e) => updateInfo('description', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-cyan focus-visible:ring-offset-2 resize-none"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Shipping ── */}
      <SectionCard icon={Truck} title="Envío" index={sectionIdx++}>
        <div className="space-y-4">
          <ToggleRow
            icon={Truck}
            iconColor="text-primary-cyan"
            label="Envíos habilitados"
            description="Activa o desactiva los envíos de la tienda"
            enabled={settings.shipping.enabled}
            onToggle={() => updateShipping('enabled', !settings.shipping.enabled)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                <DollarSign className="w-3 h-3 inline mr-1" />Envío estándar (MXN)
              </label>
              <Input
                type="number"
                step="0.01"
                value={centsToMxn(settings.shipping.standard_fee_cents)}
                onChange={(e) => updateShipping('standard_fee_cents', mxnToCents(e.target.value))}
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                <DollarSign className="w-3 h-3 inline mr-1" />Envío express (MXN)
              </label>
              <Input
                type="number"
                step="0.01"
                value={centsToMxn(settings.shipping.express_fee_cents)}
                onChange={(e) => updateShipping('express_fee_cents', mxnToCents(e.target.value))}
                className="h-10"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">
                <DollarSign className="w-3 h-3 inline mr-1" />Envío gratis desde (MXN)
              </label>
              <Input
                type="number"
                step="0.01"
                value={centsToMxn(settings.shipping.free_shipping_min_cents)}
                onChange={(e) => updateShipping('free_shipping_min_cents', mxnToCents(e.target.value))}
                className="h-10"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tiempo estimado de entrega</label>
            <Input
              value={settings.shipping.standard_estimated_time}
              onChange={(e) => {
                updateShipping('standard_estimated_time', e.target.value)
                updateShipping('estimated_time', e.target.value)
              }}
              placeholder="Estándar: 3-5 días hábiles"
              className="h-10"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tiempo estimado de entrega express</label>
            <Input
              value={settings.shipping.express_estimated_time}
              onChange={(e) => updateShipping('express_estimated_time', e.target.value)}
              placeholder="Express: 24-48 horas"
              className="h-10"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Zonas de envío</label>
            <TagInput
              tags={settings.shipping.zones}
              onAdd={addZone}
              onRemove={removeZone}
              placeholder="Escribe una zona y presiona Enter"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Checkout ── */}
      <SectionCard icon={ShoppingCart} title="Checkout" index={sectionIdx++}>
        <div className="space-y-4">
          <ToggleRow
            icon={ShoppingCart}
            iconColor="text-primary-cyan"
            label="Compra como invitado"
            description="Permitir comprar sin crear cuenta"
            enabled={settings.checkout.guest_checkout}
            onToggle={() => updateCheckout('guest_checkout', !settings.checkout.guest_checkout)}
          />
          <ToggleRow
            icon={ShoppingCart}
            iconColor="text-amber-500"
            label="Requerir cuenta"
            description="Obligar a registrarse antes de comprar"
            enabled={settings.checkout.require_account}
            onToggle={() => updateCheckout('require_account', !settings.checkout.require_account)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Pedido mínimo (MXN)</label>
              <Input
                type="number"
                step="0.01"
                value={centsToMxn(settings.checkout.min_order_cents)}
                onChange={(e) => updateCheckout('min_order_cents', mxnToCents(e.target.value))}
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Máx. productos por pedido</label>
              <Input
                type="number"
                value={settings.checkout.max_items_per_order}
                onChange={(e) => updateCheckout('max_items_per_order', parseInt(e.target.value || '0', 10))}
                className="h-10"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Payment Methods ── */}
      <SectionCard icon={DollarSign} title="Métodos de pago" index={sectionIdx++}>
        {paymentMethods.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No hay métodos de pago configurados.</p>
        ) : (
          <div className="space-y-2">
            {paymentMethods.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  {m.icon ? (
                    <img src={m.icon} alt={m.name} className="w-6 h-6 object-contain" />
                  ) : (
                    <DollarSign className="w-4 h-4 text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-primary-dark">{m.name}</p>
                    <p className="text-xs text-gray-400">{m.slug}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={togglingPayment === m.id}
                  onClick={() => handleTogglePayment(m.id, m.is_active)}
                  className="shrink-0"
                  title={m.is_active ? 'Desactivar' : 'Activar'}
                >
                  {m.is_active
                    ? <ToggleRight className="w-6 h-6 text-primary-cyan" />
                    : <ToggleLeft className="w-6 h-6 text-gray-300" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Notifications ── */}
      <SectionCard icon={Bell} title="Notificaciones" index={sectionIdx++}>
        <div className="space-y-3">
          <ToggleRow
            icon={MessageSquare}
            iconColor="text-green-500"
            label="WhatsApp al cliente"
            description="Enviar actualizaciones del pedido por WhatsApp"
            enabled={settings.notifications.whatsapp_customer}
            onToggle={() => updateNotif('whatsapp_customer', !settings.notifications.whatsapp_customer)}
          />
          <ToggleRow
            icon={Mail}
            iconColor="text-blue-500"
            label="Email en nuevo pedido"
            description="Recibir email cuando se crea un nuevo pedido"
            enabled={settings.notifications.email_on_new_order}
            onToggle={() => updateNotif('email_on_new_order', !settings.notifications.email_on_new_order)}
          />
          <ToggleRow
            icon={Mail}
            iconColor="text-emerald-500"
            label="Email en pago recibido"
            description="Recibir email cuando se confirma un pago"
            enabled={settings.notifications.email_on_payment}
            onToggle={() => updateNotif('email_on_payment', !settings.notifications.email_on_payment)}
          />
          <ToggleRow
            icon={Volume2}
            iconColor="text-amber-500"
            label="Alertas de sonido"
            description="Sonido al recibir un nuevo pedido"
            enabled={settings.notifications.sound_alerts}
            onToggle={() => updateNotif('sound_alerts', !settings.notifications.sound_alerts)}
          />
          <div className="pt-2">
            <label className="text-xs text-gray-500 mb-1 block">
              <Mail className="w-3 h-3 inline mr-1" />Email del administrador
            </label>
            <Input
              type="email"
              value={settings.notifications.email_admin}
              onChange={(e) => updateNotif('email_admin', e.target.value)}
              placeholder="admin@tienda.mx"
              className="h-10"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Appearance ── */}
      <SectionCard icon={Palette} title="Apariencia" index={sectionIdx++}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Color principal <span className="text-gray-400 font-normal">(solo para este navegador)</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setLocalColor(color)
                    if (typeof window !== 'undefined') localStorage.setItem(LOCAL_COLOR_KEY, color)
                  }}
                  className={cn(
                    'w-7 h-7 rounded-lg border-2 transition-all',
                    localColor === color ? 'border-primary-dark scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Logo de la tienda</label>
            {settings.appearance.logo_url && (
              <img src={settings.appearance.logo_url} alt="Logo" className="h-12 object-contain mb-2 rounded-lg border border-gray-100 p-1 bg-gray-50" />
            )}
            <Input
              value={settings.appearance.logo_url}
              onChange={(e) => updateAppearance('logo_url', e.target.value)}
              placeholder="URL de la imagen (desde Multimedia)"
              className="h-10 mb-2"
            />
            <div className="border-2 border-dashed border-gray-100 rounded-xl p-4 flex flex-col items-center justify-center gap-1 text-gray-300">
              <Upload className="w-5 h-5" />
              <p className="text-[11px]">Sube la imagen en <a href="/admin/media" className="text-primary-cyan underline">Multimedia</a> y pega la URL arriba</p>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Favicon</label>
            {settings.appearance.favicon_url && (
              <img src={settings.appearance.favicon_url} alt="Favicon" className="h-8 w-8 object-contain mb-2 rounded border border-gray-100 bg-gray-50" />
            )}
            <Input
              value={settings.appearance.favicon_url}
              onChange={(e) => updateAppearance('favicon_url', e.target.value)}
              placeholder="URL del favicon (ICO o PNG 32×32)"
              className="h-10 mb-2"
            />
            <div className="border-2 border-dashed border-gray-100 rounded-xl p-3 flex items-center justify-center gap-2 text-gray-300">
              <ImageIcon className="w-4 h-4" />
              <p className="text-[11px]">Sube en <a href="/admin/media" className="text-primary-cyan underline">Multimedia</a> y pega la URL</p>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <label className="text-xs text-gray-500 block">Redes sociales</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">
                  <Globe className="w-3 h-3 inline mr-0.5" />Instagram
                </label>
                <Input
                  value={settings.appearance.social_links.instagram}
                  onChange={(e) => updateSocial('instagram', e.target.value)}
                  placeholder="@tienda"
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">
                  <Globe className="w-3 h-3 inline mr-0.5" />Facebook
                </label>
                <Input
                  value={settings.appearance.social_links.facebook}
                  onChange={(e) => updateSocial('facebook', e.target.value)}
                  placeholder="facebook.com/tienda"
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">TikTok</label>
                <Input
                  value={settings.appearance.social_links.tiktok}
                  onChange={(e) => updateSocial('tiktok', e.target.value)}
                  placeholder="@tienda"
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── SEO ── */}
      <SectionCard icon={Search} title="SEO" index={sectionIdx++}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Meta título</label>
            <Input
              value={settings.seo.meta_title}
              onChange={(e) => updateSeo('meta_title', e.target.value)}
              placeholder="Tienda | Tu marca"
              className="h-10"
              maxLength={70}
            />
            <p className="text-[10px] text-gray-300 mt-0.5">{settings.seo.meta_title.length}/70</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Meta descripción</label>
            <textarea
              value={settings.seo.meta_description}
              onChange={(e) => updateSeo('meta_description', e.target.value)}
              placeholder="Describe tu tienda para los buscadores..."
              rows={2}
              maxLength={160}
              className="w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-cyan focus-visible:ring-offset-2 resize-none"
            />
            <p className="text-[10px] text-gray-300 mt-0.5">{settings.seo.meta_description.length}/160</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Imagen OG (Open Graph)</label>
            {settings.seo.og_image && (
              <img src={settings.seo.og_image} alt="OG" className="h-16 object-cover mb-2 rounded-lg border border-gray-100 bg-gray-50 w-full" />
            )}
            <Input
              value={settings.seo.og_image}
              onChange={(e) => updateSeo('og_image', e.target.value)}
              placeholder="URL de la imagen OG (1200×630)"
              className="h-10 mb-2"
            />
            <div className="border-2 border-dashed border-gray-100 rounded-xl p-4 flex items-center justify-center gap-2 text-gray-300">
              <ImageIcon className="w-4 h-4" />
              <p className="text-[11px]">Sube en <a href="/admin/media" className="text-primary-cyan underline">Multimedia</a> y pega la URL · 1200×630 recomendado</p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Legal ── */}
      <SectionCard icon={Scale} title="Legal" index={sectionIdx++}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                <Link2 className="w-3 h-3 inline mr-1" />URL Términos y condiciones
              </label>
              <Input
                value={settings.legal.terms_url}
                onChange={(e) => updateLegal('terms_url', e.target.value)}
                placeholder="https://..."
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                <Link2 className="w-3 h-3 inline mr-1" />URL Aviso de privacidad
              </label>
              <Input
                value={settings.legal.privacy_url}
                onChange={(e) => updateLegal('privacy_url', e.target.value)}
                placeholder="https://..."
                className="h-10"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Política de devoluciones</label>
            <textarea
              value={settings.legal.return_policy}
              onChange={(e) => updateLegal('return_policy', e.target.value)}
              placeholder="Describe tu política de devoluciones..."
              rows={4}
              className="w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-cyan focus-visible:ring-offset-2 resize-none"
            />
          </div>
          <div className="w-40">
            <label className="text-xs text-gray-500 mb-1 block">Tasa de impuesto (%)</label>
            <Input
              type="number"
              value={settings.legal.tax_rate}
              onChange={(e) => updateLegal('tax_rate', parseFloat(e.target.value || '0'))}
              className="h-10"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Mobile sticky save ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="sm:hidden sticky bottom-4 z-10"
      >
        <Button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'w-full font-semibold gap-2 h-12 rounded-xl shadow-lg transition-all',
            'bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover',
          )}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </motion.div>
    </div>
  )
}
