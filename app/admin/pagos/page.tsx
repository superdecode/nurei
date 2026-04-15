'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard, Banknote, Building, Wallet, Smartphone,
  Settings, Check, Loader2, ArrowUpRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { PaymentMethod } from '@/types'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  CreditCard, Banknote, Building, Wallet, Smartphone,
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className={cn('w-10 h-6 rounded-full transition-colors relative flex-shrink-0', enabled ? 'bg-primary-cyan' : 'bg-gray-200')}>
      <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform', enabled ? 'left-5' : 'left-1')} />
    </button>
  )
}

export default function PagosPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [editMethod, setEditMethod] = useState<PaymentMethod | null>(null)
  const [editConfig, setEditConfig] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/admin/payment-methods')
      .then((r) => r.json())
      .then(({ data }) => setMethods(data ?? []))
      .catch(() => toast.error('Error al cargar métodos de pago'))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (method: PaymentMethod) => {
    const updated = { ...method, is_active: !method.is_active }
    setMethods((prev) => prev.map((m) => (m.id === method.id ? updated : m)))
    try {
      await fetch('/api/admin/payment-methods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: method.id, is_active: !method.is_active }),
      })
      toast.success(`${method.name} ${!method.is_active ? 'activado' : 'desactivado'}`)
    } catch {
      setMethods((prev) => prev.map((m) => (m.id === method.id ? method : m)))
      toast.error('Error al actualizar')
    }
  }

  const handleSaveConfig = async () => {
    if (!editMethod) return
    try {
      await fetch('/api/admin/payment-methods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editMethod.id, config: editConfig }),
      })
      setMethods((prev) =>
        prev.map((m) => (m.id === editMethod.id ? { ...m, config: editConfig } : m))
      )
      setEditMethod(null)
      toast.success('Configuración guardada')
    } catch {
      toast.error('Error al guardar')
    }
  }

  const openConfig = (method: PaymentMethod) => {
    setEditMethod(method)
    const cfg: Record<string, string> = {}
    for (const [k, v] of Object.entries(method.config)) {
      cfg[k] = String(v ?? '')
    }
    setEditConfig(cfg)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-cyan animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-primary-dark flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-primary-cyan" />
          Métodos de pago
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Activa y configura los métodos de pago de tu tienda</p>
      </motion.div>

      <div className="space-y-3">
        {methods.map((method, i) => {
          const IconComp = ICON_MAP[method.icon ?? ''] ?? CreditCard
          const hasConfig = Object.keys(method.config).filter((k) => k !== 'provider').length > 0
          return (
            <motion.div
              key={method.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                  method.is_active ? 'bg-primary-cyan/10' : 'bg-gray-100'
                )}>
                  <IconComp className={cn('w-6 h-6', method.is_active ? 'text-primary-cyan' : 'text-gray-400')} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-primary-dark">{method.name}</h3>
                    <Badge variant="secondary" className={cn('text-[10px]', method.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400')}>
                      {method.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{method.description}</p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {hasConfig && (
                    <button onClick={() => openConfig(method)} className="p-2 rounded-lg text-gray-400 hover:text-primary-cyan hover:bg-primary-cyan/10 transition-colors">
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                  <Toggle enabled={method.is_active} onToggle={() => handleToggle(method)} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {methods.length === 0 && (
        <div className="text-center py-16">
          <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-200" />
          <p className="text-gray-400">No hay métodos de pago configurados</p>
        </div>
      )}

      {/* Config dialog */}
      <Dialog open={!!editMethod} onOpenChange={() => setEditMethod(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary-cyan" />
              Configurar {editMethod?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {Object.entries(editConfig)
              .filter(([key]) => key !== 'provider')
              .map(([key, value]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block capitalize">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <Input
                    value={value}
                    onChange={(e) => setEditConfig((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="h-10"
                    placeholder={`Ingresa ${key.replace(/_/g, ' ')}`}
                  />
                </div>
              ))}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditMethod(null)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-semibold" onClick={handleSaveConfig}>
                <Check className="w-4 h-4 mr-1" /> Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
