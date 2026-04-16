'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Ticket, Trash2, Edit2, X, Copy, ToggleLeft, ToggleRight,
  Calendar, Info, Tag, Percent, DollarSign, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Coupon, CouponType } from '@/types'

const MOCK_COUPONS: Coupon[] = [
  {
    id: '1', code: 'BIENVENIDO10', type: 'percentage', value: 10,
    min_order_amount: 20000, max_uses: 100, used_count: 23,
    expires_at: '2026-06-01T00:00:00Z', is_active: true,
    description: 'Descuento de bienvenida',
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2', code: 'ENVIOGRATIS', type: 'fixed', value: 9900,
    min_order_amount: 30000, max_uses: 50, used_count: 12,
    expires_at: null, is_active: true,
    description: 'Envío gratis en compras mayores a $300',
    created_at: '2024-02-01T00:00:00Z', updated_at: '2024-02-01T00:00:00Z',
  },
  {
    id: '3', code: 'SNACK20', type: 'percentage', value: 20,
    min_order_amount: 50000, max_uses: 30, used_count: 30,
    expires_at: '2025-12-31T00:00:00Z', is_active: false,
    description: 'Campaña navideña 2025',
    created_at: '2024-11-01T00:00:00Z', updated_at: '2024-11-01T00:00:00Z',
  },
]

interface CouponForm {
  code: string
  type: CouponType
  value: string
  min_order_amount: string
  max_uses: string
  expires_at: string
  description: string
}

const EMPTY_FORM: CouponForm = {
  code: '', type: 'percentage', value: '', min_order_amount: '',
  max_uses: '', expires_at: '', description: '',
}

export default function CuponesPage() {
  const [coupons, setCoupons] = useState<Coupon[]>(MOCK_COUPONS)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM)

  const filtered = coupons.filter((c) =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (coupon: Coupon) => {
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.type === 'percentage' ? String(coupon.value) : String(coupon.value / 100),
      min_order_amount: String(coupon.min_order_amount / 100),
      max_uses: coupon.max_uses ? String(coupon.max_uses) : '',
      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
      description: coupon.description || '',
    })
    setEditingId(coupon.id)
    setShowForm(true)
  }

  const handleSave = () => {
    if (!form.code || !form.value) {
      toast.error('Código y valor son obligatorios')
      return
    }
    const now = new Date().toISOString()
    const value = form.type === 'percentage'
      ? parseInt(form.value, 10)
      : Math.round(parseFloat(form.value) * 100)

    if (editingId) {
      setCoupons((prev) => prev.map((c) =>
        c.id === editingId
          ? {
              ...c,
              code: form.code.toUpperCase(),
              type: form.type,
              value,
              min_order_amount: Math.round(parseFloat(form.min_order_amount || '0') * 100),
              max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
              expires_at: form.expires_at ? `${form.expires_at}T00:00:00Z` : null,
              description: form.description || null,
              updated_at: now,
            }
          : c
      ))
      toast.success('Cupón actualizado')
    } else {
      const newCoupon: Coupon = {
        id: `coupon-${Date.now()}`,
        code: form.code.toUpperCase(),
        type: form.type,
        value,
        min_order_amount: Math.round(parseFloat(form.min_order_amount || '0') * 100),
        max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
        used_count: 0,
        expires_at: form.expires_at ? `${form.expires_at}T00:00:00Z` : null,
        is_active: true,
        description: form.description || null,
        created_at: now,
        updated_at: now,
      }
      setCoupons((prev) => [newCoupon, ...prev])
      toast.success('Cupón creado')
    }
    setShowForm(false)
  }

  const toggleActive = (id: string) => {
    setCoupons((prev) => prev.map((c) =>
      c.id === id ? { ...c, is_active: !c.is_active, updated_at: new Date().toISOString() } : c
    ))
  }

  const deleteCoupon = (id: string) => {
    setCoupons((prev) => prev.filter((c) => c.id !== id))
    toast.success('Cupón eliminado')
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success('Código copiado', { icon: '📋' })
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Cupones</h1>
          <p className="text-sm text-gray-400 mt-1">{coupons.length} cupones configurados</p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-bold rounded-xl h-10 px-5 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" /> Nuevo cupón
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cupones por código o descripción..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm h-11"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="text-left py-3.5 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-wider">Código</th>
                <th className="text-left py-3.5 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-wider">Tipo</th>
                <th className="text-left py-3.5 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-wider">Valor</th>
                <th className="text-left py-3.5 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-wider hidden sm:table-cell">Mín. orden</th>
                <th className="text-left py-3.5 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-wider hidden md:table-cell">Usos</th>
                <th className="text-left py-3.5 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-wider hidden lg:table-cell">Expira</th>
                <th className="text-left py-3.5 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-wider">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((coupon) => (
                <tr key={coupon.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors group">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-cyan/10 flex items-center justify-center">
                        <Ticket className="w-4 h-4 text-primary-cyan" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary-dark">{coupon.code}</span>
                          <button onClick={() => copyCode(coupon.code)} className="text-gray-300 hover:text-primary-cyan opacity-0 group-hover:opacity-100 transition-all">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        {coupon.description && (
                          <p className="text-[11px] text-gray-400 mt-0.5 max-w-[150px] truncate">{coupon.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={cn(
                      'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-tight',
                      coupon.type === 'percentage' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    )}>
                      {coupon.type === 'percentage' ? 'Porcentual' : 'Fijo'}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-bold text-primary-dark">
                    {coupon.type === 'percentage' ? `${coupon.value}%` : formatPrice(coupon.value)}
                  </td>
                  <td className="py-4 px-4 text-gray-500 hidden sm:table-cell">
                    {formatPrice(coupon.min_order_amount)}
                  </td>
                  <td className="py-4 px-4 hidden md:table-cell">
                    <div className="flex items-baseline gap-1">
                      <span className="text-primary-dark font-bold">{coupon.used_count}</span>
                      <span className="text-gray-300 text-xs">/ {coupon.max_uses ?? '∞'}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-500 hidden lg:table-cell">
                    {coupon.expires_at ? (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>{new Date(coupon.expires_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    ) : (
                      <span className="text-gray-300 italic">Nunca</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <button 
                      onClick={() => toggleActive(coupon.id)}
                      className={cn(
                        'w-10 h-5.5 rounded-full relative transition-colors duration-200',
                        coupon.is_active ? 'bg-emerald-500' : 'bg-gray-200'
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200',
                        coupon.is_active && 'translate-x-[18px]'
                      )} />
                    </button>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon-xs" onClick={() => openEdit(coupon)} className="text-gray-400 hover:text-primary-cyan">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => deleteCoupon(coupon.id)} className="text-gray-400 hover:text-error">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                        <Ticket className="w-6 h-6 text-gray-200" />
                      </div>
                      <p className="text-sm font-medium text-gray-500">No se encontraron cupones</p>
                      <p className="text-xs text-gray-400 mt-1">Intenta con otros términos de búsqueda</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create/Edit Dialog ────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent size="lg" className="p-0 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header Fixed */}
          <div className="bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#f59e0bb3] px-8 py-5 relative overflow-hidden flex-shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-black/10 backdrop-blur-md flex items-center justify-center border border-black/5">
                <Ticket className="w-5 h-5 text-gray-900" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">
                  {editingId ? 'Editar Cupón' : 'Nuevo Cupón'}
                </DialogTitle>
                <p className="text-xs text-gray-900/60 font-medium">
                  {editingId ? `Modificando: ${form.code}` : 'Define el descuento y sus condiciones de uso'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            {/* Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3 h-3" />
                Código del Cupón *
              </label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="PROMO2024, BIENVENIDO..."
                className="h-10 text-base font-mono uppercase tracking-widest font-bold focus:ring-amber-500"
              />
              <p className="text-[10px] text-gray-400">Los clientes ingresarán este código en el checkout.</p>
            </div>

            {/* Discount Configuration */}
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Percent className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold text-primary-dark uppercase">Configuración de Descuento</h4>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Tipo de Descuento</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}
                    className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all font-medium"
                  >
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="fixed">Monto fijo (MXN)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">
                    Valor {form.type === 'percentage' ? '(%)' : '(MXN)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">
                      {form.type === 'percentage' ? '%' : '$'}
                    </span>
                    <Input
                      type="number"
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      placeholder={form.type === 'percentage' ? '15' : '99'}
                      className="h-10 pl-8 font-bold text-primary-dark"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Restrictions */}
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Info className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-bold text-primary-dark uppercase">Restricciones y Límites</h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Mínimo de Compra (MXN)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">$</span>
                    <Input
                      type="number"
                      value={form.min_order_amount}
                      onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                      placeholder="0.00"
                      className="h-10 pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Limite de Usos Totales</label>
                  <Input
                    type="number"
                    value={form.max_uses}
                    onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                    placeholder="Ejem: 100"
                    className="h-10"
                  />
                  <p className="text-[10px] text-gray-400 italic">Dejar vacío para ilimitado</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  Fecha de Expiración
                </label>
                <Input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                  className="h-10"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción Interna</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ej: Solo para nuevos clientes, campaña verano..."
                className="h-10"
              />
            </div>
          </div>

          <div className="p-6 flex justify-end gap-3 border-t bg-gray-50/50 flex-shrink-0">
            <Button
              variant="ghost"
              onClick={() => setShowForm(false)}
              className="rounded-xl h-10 font-bold text-gray-500 hover:bg-gray-100 px-6"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-primary-dark text-white hover:bg-black font-bold rounded-xl h-10 px-8 shadow-md"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {editingId ? 'Guardar Cambios' : 'Crear Cupón'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
