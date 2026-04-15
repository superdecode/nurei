'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Store, Clock, MapPin, DollarSign, Bell,
  Smartphone, Save, Truck, CreditCard, MessageSquare,
  Palette, Upload, CheckCircle, Mail, Volume2, Banknote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface DaySchedule {
  enabled: boolean
  start: string
  end: string
}

interface ConfigState {
  storeName: string
  phone: string
  address: string
  whatsapp: string
  schedule: Record<string, DaySchedule>
  openNow: boolean
  deliveryFee: number
  freeDeliveryMin: number
  estimatedTime: string
  maxRadius: string
  deliveryZoneRomaCondesa: boolean
  paymentCash: boolean
  paymentCard: boolean
  paymentTransfer: boolean
  notifWhatsappCustomer: boolean
  notifEmailAdmin: boolean
  notifSoundAlerts: boolean
  adminEmail: string
  primaryColor: string
  storeDescription: string
}

const DAYS = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
]

const DEFAULT_SCHEDULE: Record<string, DaySchedule> = Object.fromEntries(
  DAYS.map((d) => [d.key, { enabled: true, start: '17:00', end: '23:00' }])
)

const COLOR_OPTIONS = ['#00E5FF', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6', '#0A1F2F', '#DC2626', '#6B7280']

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-10 h-6 rounded-full transition-colors relative flex-shrink-0',
        enabled ? 'bg-primary-cyan' : 'bg-gray-200'
      )}
    >
      <span
        className={cn(
          'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
          enabled ? 'left-5' : 'left-1'
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

export default function ConfigPage() {
  const [saved, setSaved] = useState(false)
  const [config, setConfig] = useState<ConfigState>({
    storeName: 'Nurei - Premium Asian Snacks',
    phone: '+52 55 1234 5678',
    address: 'Col. Roma Norte, Cuauhtémoc, CDMX',
    whatsapp: '+52 55 1234 5678',
    schedule: DEFAULT_SCHEDULE,
    openNow: true,
    deliveryFee: 29,
    freeDeliveryMin: 500,
    estimatedTime: '20-35 min',
    maxRadius: '3 km',
    deliveryZoneRomaCondesa: true,
    paymentCash: true,
    paymentCard: true,
    paymentTransfer: false,
    notifWhatsappCustomer: true,
    notifEmailAdmin: true,
    notifSoundAlerts: true,
    adminEmail: 'admin@nurei.mx',
    primaryColor: '#00E5FF',
    storeDescription: 'Snacks asiáticos premium importados. De Tokyo a tu puerta en CDMX.',
  })

  const updateConfig = <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const updateScheduleDay = (dayKey: string, field: keyof DaySchedule, value: string | boolean) => {
    setConfig((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [dayKey]: { ...prev.schedule[dayKey], [field]: value },
      },
    }))
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

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
          <p className="text-sm text-gray-400 mt-0.5">
            Ajustes generales de la tienda
          </p>
        </div>
        <Button
          onClick={handleSave}
          className={cn(
            'font-semibold gap-2 transition-all',
            saved
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover'
          )}
        >
          {saved ? (
            <>
              <CheckCircle className="w-4 h-4" />
              ¡Guardado!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Guardar cambios
            </>
          )}
        </Button>
      </motion.div>

      {/* Store Info */}
      <SectionCard icon={Store} title="Información de la tienda" index={0}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nombre de la tienda</label>
            <Input
              value={config.storeName}
              onChange={(e) => updateConfig('storeName', e.target.value)}
              placeholder="Nombre de la tienda"
              className="h-10"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                <Smartphone className="w-3 h-3 inline mr-1" />
                Teléfono
              </label>
              <Input
                value={config.phone}
                onChange={(e) => updateConfig('phone', e.target.value)}
                placeholder="+52 55 ..."
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                <MessageSquare className="w-3 h-3 inline mr-1" />
                WhatsApp para notificaciones
              </label>
              <Input
                value={config.whatsapp}
                onChange={(e) => updateConfig('whatsapp', e.target.value)}
                placeholder="+52 55 ..."
                className="h-10"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              <MapPin className="w-3 h-3 inline mr-1" />
              Dirección
            </label>
            <Input
              value={config.address}
              onChange={(e) => updateConfig('address', e.target.value)}
              placeholder="Dirección de la tienda"
              className="h-10"
            />
          </div>
        </div>
      </SectionCard>

      {/* Operating Hours */}
      <SectionCard icon={Clock} title="Horario de operación" index={1}>
        <div className="space-y-3">
          {/* Open Now toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <div>
              <p className="text-sm font-medium text-primary-dark">Abierto ahora</p>
              <p className="text-xs text-gray-400">Activa o pausa las entregas manualmente</p>
            </div>
            <Toggle
              enabled={config.openNow}
              onToggle={() => updateConfig('openNow', !config.openNow)}
            />
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            {DAYS.map((day) => {
              const sched = config.schedule[day.key]
              return (
                <div
                  key={day.key}
                  className="flex items-center gap-3 py-2"
                >
                  <Toggle
                    enabled={sched.enabled}
                    onToggle={() => updateScheduleDay(day.key, 'enabled', !sched.enabled)}
                  />
                  <span className={cn(
                    'text-sm w-24 font-medium',
                    sched.enabled ? 'text-primary-dark' : 'text-gray-300'
                  )}>
                    {day.label}
                  </span>
                  {sched.enabled ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={sched.start}
                        onChange={(e) => updateScheduleDay(day.key, 'start', e.target.value)}
                        className="h-8 w-28 text-xs"
                      />
                      <span className="text-xs text-gray-400">a</span>
                      <Input
                        type="time"
                        value={sched.end}
                        onChange={(e) => updateScheduleDay(day.key, 'end', e.target.value)}
                        className="h-8 w-28 text-xs"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">Cerrado</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </SectionCard>

      {/* Delivery Settings */}
      <SectionCard icon={Truck} title="Configuración de entrega" index={2}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                <DollarSign className="w-3 h-3 inline mr-1" />
                Costo de envío (MXN)
              </label>
              <Input
                type="number"
                value={config.deliveryFee}
                onChange={(e) => updateConfig('deliveryFee', Number(e.target.value))}
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                <DollarSign className="w-3 h-3 inline mr-1" />
                Envío gratis a partir de (MXN)
              </label>
              <Input
                type="number"
                value={config.freeDeliveryMin}
                onChange={(e) => updateConfig('freeDeliveryMin', Number(e.target.value))}
                className="h-10"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tiempo estimado de entrega</label>
              <Input
                value={config.estimatedTime}
                onChange={(e) => updateConfig('estimatedTime', e.target.value)}
                placeholder="20-35 min"
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Radio máximo de entrega</label>
              <Input
                value={config.maxRadius}
                onChange={(e) => updateConfig('maxRadius', e.target.value)}
                placeholder="3 km"
                className="h-10"
              />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <div>
              <p className="text-sm font-medium text-primary-dark">Zona de entrega: Roma/Condesa</p>
              <p className="text-xs text-gray-400">Limitar entregas a la zona Roma y Condesa</p>
            </div>
            <Toggle
              enabled={config.deliveryZoneRomaCondesa}
              onToggle={() => updateConfig('deliveryZoneRomaCondesa', !config.deliveryZoneRomaCondesa)}
            />
          </div>
        </div>
      </SectionCard>

      {/* Payment Methods */}
      <SectionCard icon={CreditCard} title="Métodos de pago" index={3}>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <Banknote className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-dark">Efectivo</p>
                <p className="text-xs text-gray-400">Pago en efectivo al momento de la entrega</p>
              </div>
            </div>
            <Toggle
              enabled={config.paymentCash}
              onToggle={() => updateConfig('paymentCash', !config.paymentCash)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-dark">Tarjeta (Stripe)</p>
                <p className="text-xs text-gray-400">Pago con tarjeta de crédito o débito</p>
              </div>
            </div>
            <Toggle
              enabled={config.paymentCard}
              onToggle={() => updateConfig('paymentCard', !config.paymentCard)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-dark">Transferencia bancaria</p>
                <p className="text-xs text-gray-400">Transferencia SPEI o depósito bancario</p>
              </div>
            </div>
            <Toggle
              enabled={config.paymentTransfer}
              onToggle={() => updateConfig('paymentTransfer', !config.paymentTransfer)}
            />
          </div>
        </div>
      </SectionCard>

      {/* Notifications */}
      <SectionCard icon={Bell} title="Notificaciones" index={4}>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-sm font-medium text-primary-dark">WhatsApp al cliente</p>
                <p className="text-xs text-gray-400">Enviar actualizaciones del pedido por WhatsApp</p>
              </div>
            </div>
            <Toggle
              enabled={config.notifWhatsappCustomer}
              onToggle={() => updateConfig('notifWhatsappCustomer', !config.notifWhatsappCustomer)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-primary-dark">Email al administrador</p>
                <p className="text-xs text-gray-400">Recibir notificación por email de nuevos pedidos</p>
              </div>
            </div>
            <Toggle
              enabled={config.notifEmailAdmin}
              onToggle={() => updateConfig('notifEmailAdmin', !config.notifEmailAdmin)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-primary-dark">Alertas de sonido</p>
                <p className="text-xs text-gray-400">Sonido al recibir un nuevo pedido</p>
              </div>
            </div>
            <Toggle
              enabled={config.notifSoundAlerts}
              onToggle={() => updateConfig('notifSoundAlerts', !config.notifSoundAlerts)}
            />
          </div>

          <div className="pt-2">
            <label className="text-xs text-gray-500 mb-1 block">
              <Mail className="w-3 h-3 inline mr-1" />
              Email del administrador
            </label>
            <Input
              type="email"
              value={config.adminEmail}
              onChange={(e) => updateConfig('adminEmail', e.target.value)}
              placeholder="admin@nurei.mx"
              className="h-10"
            />
          </div>
        </div>
      </SectionCard>

      {/* Appearance */}
      <SectionCard icon={Palette} title="Apariencia" index={5}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Color principal</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  onClick={() => updateConfig('primaryColor', color)}
                  className={cn(
                    'w-8 h-8 rounded-lg border-2 transition-all',
                    config.primaryColor === color ? 'border-primary-dark scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Logo de la tienda</label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:border-primary-cyan/50 transition-colors cursor-pointer">
              <Upload className="w-6 h-6 text-gray-300" />
              <p className="text-xs text-gray-400">Arrastra una imagen o haz clic para subir</p>
              <p className="text-[10px] text-gray-300">PNG, JPG hasta 2MB</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Descripción de la tienda</label>
            <textarea
              value={config.storeDescription}
              onChange={(e) => updateConfig('storeDescription', e.target.value)}
              placeholder="Describe tu tienda en pocas palabras..."
              rows={3}
              className="w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-cyan focus-visible:ring-offset-2 resize-none"
            />
          </div>
        </div>
      </SectionCard>

      {/* Bottom save bar for mobile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="sm:hidden sticky bottom-4 z-10"
      >
        <Button
          onClick={handleSave}
          className={cn(
            'w-full font-semibold gap-2 h-12 rounded-xl shadow-lg transition-all',
            saved
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover'
          )}
        >
          {saved ? (
            <>
              <CheckCircle className="w-4 h-4" />
              ¡Guardado!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Guardar cambios
            </>
          )}
        </Button>
      </motion.div>
    </div>
  )
}
