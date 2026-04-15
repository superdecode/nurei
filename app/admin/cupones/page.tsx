'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Ticket, Trash2, Edit2, X, Copy, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils/format'
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
          <p className="text-sm text-gray-400 mt-1">{coupons.length} cupones</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-cyan text-primary-dark rounded-xl font-bold text-sm hover:bg-primary-cyan-hover transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo cupón
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cupones..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-cyan/50"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 font-bold text-gray-400 text-xs uppercase">Código</th>
                <th className="text-left py-3 px-4 font-bold text-gray-400 text-xs uppercase">Tipo</th>
                <th className="text-left py-3 px-4 font-bold text-gray-400 text-xs uppercase">Valor</th>
                <th className="text-left py-3 px-4 font-bold text-gray-400 text-xs uppercase hidden sm:table-cell">Mín. orden</th>
                <th className="text-left py-3 px-4 font-bold text-gray-400 text-xs uppercase hidden md:table-cell">Usos</th>
                <th className="text-left py-3 px-4 font-bold text-gray-400 text-xs uppercase hidden lg:table-cell">Expira</th>
                <th className="text-left py-3 px-4 font-bold text-gray-400 text-xs uppercase">Estado</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((coupon) => (
                <tr key={coupon.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-primary-cyan" />
                      <span className="font-mono font-bold text-gray-900">{coupon.code}</span>
                      <button onClick={() => copyCode(coupon.code)} className="text-gray-300 hover:text-gray-500">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    {coupon.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{coupon.description}</p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                      coupon.type === 'percentage' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {coupon.type === 'percentage' ? '%' : '$'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-gray-900">
                    {coupon.type === 'percentage' ? `${coupon.value}%` : formatPrice(coupon.value)}
                  </td>
                  <td className="py-3 px-4 text-gray-500 hidden sm:table-cell">
                    {formatPrice(coupon.min_order_amount)}
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span className="text-gray-900 font-bold">{coupon.used_count}</span>
                    <span className="text-gray-400">/{coupon.max_uses ?? '∞'}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 hidden lg:table-cell">
                    {coupon.expires_at
                      ? new Date(coupon.expires_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Sin expiración'}
                  </td>
                  <td className="py-3 px-4">
                    <button onClick={() => toggleActive(coupon.id)}>
                      {coupon.is_active ? (
                        <ToggleRight className="w-6 h-6 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-300" />
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(coupon)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteCoupon(coupon.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    No se encontraron cupones
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="fixed inset-x-4 top-[8%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-xl z-50 bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Gradient header */}
              <div className="bg-gradient-to-r from-primary-dark to-[#0D3050] px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary-cyan/20 flex items-center justify-center">
                      <Ticket className="w-4.5 h-4.5 text-primary-cyan" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">
                        {editingId ? 'Editar cupón' : 'Nuevo cupón'}
                      </h2>
                      <p className="text-xs text-white/50 mt-0.5">
                        {editingId ? 'Modifica los datos del cupón' : 'Define el descuento y sus condiciones'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Code */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Código *</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="RAMEN15, DUMPLING20..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-cyan/40 focus:border-primary-cyan/50 shadow-sm"
                  />
                </div>

                {/* Discount section */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Descuento</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo</label>
                      <select
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-cyan/40 shadow-sm"
                      >
                        <option value="percentage">Porcentaje (%)</option>
                        <option value="fixed">Monto fijo ($)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Valor {form.type === 'percentage' ? '(%)' : '(MXN)'}
                      </label>
                      <input
                        type="number"
                        value={form.value}
                        onChange={(e) => setForm({ ...form, value: e.target.value })}
                        placeholder={form.type === 'percentage' ? '15' : '99'}
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-cyan/40 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Conditions section */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Condiciones</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Mín. orden (MXN)</label>
                      <input
                        type="number"
                        value={form.min_order_amount}
                        onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                        placeholder="200"
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-cyan/40 shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Máx. usos</label>
                      <input
                        type="number"
                        value={form.max_uses}
                        onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                        placeholder="Ilimitado"
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-cyan/40 shadow-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha expiración</label>
                    <input
                      type="date"
                      value={form.expires_at}
                      onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-cyan/40 shadow-sm"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Descripción</label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Ej: Campaña de apertura, descuento de verano..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-cyan/40 focus:border-primary-cyan/50 shadow-sm"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 py-2.5 text-sm font-bold text-primary-dark bg-primary-cyan rounded-xl hover:bg-primary-cyan-hover transition-colors"
                  >
                    {editingId ? 'Guardar cambios' : 'Crear cupón'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
