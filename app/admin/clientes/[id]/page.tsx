'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Mail, Phone, MessageCircle, Building2, MapPin, Plus, User,
  ShoppingBag, DollarSign, Calendar, Edit2, Loader2, Trash2, Pin,
  MessageSquare, Phone as PhoneCall, AlertCircle, ThumbsUp, Send,
  Crown, UserCheck, Tag as TagIcon, StickyNote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'
import { customerDisplayName } from '@/lib/utils/customer-display'
import { toast } from 'sonner'
import type {
  Customer, CustomerAddress, CustomerNoteKind,
  CustomerSegment,
} from '@/types'

const SEGMENT_LABEL: Record<CustomerSegment, string> = {
  new: 'Nuevo', regular: 'Regular', vip: 'VIP',
  at_risk: 'En riesgo', lost: 'Perdido', blacklist: 'Bloqueado',
}

const SEGMENT_STYLE: Record<CustomerSegment, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-100',
  regular: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  vip: 'bg-amber-50 text-amber-700 border-amber-100',
  at_risk: 'bg-orange-50 text-orange-700 border-orange-100',
  lost: 'bg-gray-100 text-gray-500 border-gray-200',
  blacklist: 'bg-red-50 text-red-700 border-red-100',
}

const NOTE_KIND_ICON: Record<CustomerNoteKind, React.ElementType> = {
  note: StickyNote, call: PhoneCall, email: Mail,
  whatsapp: MessageCircle, visit: UserCheck,
  complaint: AlertCircle, compliment: ThumbsUp, system: MessageSquare,
}

const NOTE_KIND_LABEL: Record<CustomerNoteKind, string> = {
  note: 'Nota', call: 'Llamada', email: 'Email', whatsapp: 'WhatsApp',
  visit: 'Visita', complaint: 'Queja', compliment: 'Elogio', system: 'Sistema',
}

const NOTE_KIND_STYLE: Record<CustomerNoteKind, string> = {
  note: 'bg-gray-50 text-gray-600',
  call: 'bg-blue-50 text-blue-700',
  email: 'bg-indigo-50 text-indigo-700',
  whatsapp: 'bg-emerald-50 text-emerald-700',
  visit: 'bg-purple-50 text-purple-700',
  complaint: 'bg-red-50 text-red-600',
  compliment: 'bg-amber-50 text-amber-700',
  system: 'bg-gray-100 text-gray-500',
}

const fmtMXN = (cents: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
    .format((cents ?? 0) / 100)

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const fmtDateTime = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

type AddressForm = {
  label: string
  recipient_name: string
  phone: string
  street: string
  exterior_number: string
  interior_number: string
  colonia: string
  city: string
  state: string
  country: string
  zip_code: string
  instructions: string
  is_default_shipping: boolean
  is_default_billing: boolean
}

const EMPTY_ADDRESS: AddressForm = {
  label: 'Casa', recipient_name: '', phone: '',
  street: '', exterior_number: '', interior_number: '',
  colonia: '', city: '', state: '', country: 'México', zip_code: '',
  instructions: '', is_default_shipping: false, is_default_billing: false,
}

export default function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)

  // Note composer
  const [noteText, setNoteText] = useState('')
  const [noteKind, setNoteKind] = useState<CustomerNoteKind>('note')
  const [noteSaving, setNoteSaving] = useState(false)

  // Address dialog
  const [addrDialogOpen, setAddrDialogOpen] = useState(false)
  const [addrForm, setAddrForm] = useState<AddressForm>(EMPTY_ADDRESS)
  const [editingAddr, setEditingAddr] = useState<CustomerAddress | null>(null)
  const [addrSaving, setAddrSaving] = useState(false)

  const fetchCustomer = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithCredentials(`/api/admin/customers/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setCustomer(json.data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error cargando cliente')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchCustomer() }, [fetchCustomer])

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    setNoteSaving(true)
    try {
      const res = await fetchWithCredentials(`/api/admin/customers/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText.trim(), kind: noteKind, is_pinned: false }),
      })
      if (!res.ok) throw new Error()
      setNoteText('')
      toast.success('Nota añadida')
      fetchCustomer()
    } catch {
      toast.error('Error al añadir nota')
    } finally {
      setNoteSaving(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetchWithCredentials(`/api/admin/customers/${id}/notes/${noteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Nota eliminada')
      fetchCustomer()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const openNewAddress = () => {
    setEditingAddr(null)
    setAddrForm(EMPTY_ADDRESS)
    setAddrDialogOpen(true)
  }

  const openEditAddress = (a: CustomerAddress) => {
    setEditingAddr(a)
    setAddrForm({
      label: a.label ?? 'Casa',
      recipient_name: a.recipient_name ?? '',
      phone: a.phone ?? '',
      street: a.street ?? '',
      exterior_number: a.exterior_number ?? '',
      interior_number: a.interior_number ?? '',
      colonia: a.colonia ?? '',
      city: a.city ?? '',
      state: a.state ?? '',
      country: a.country ?? 'México',
      zip_code: a.zip_code ?? '',
      instructions: a.instructions ?? '',
      is_default_shipping: a.is_default_shipping,
      is_default_billing: a.is_default_billing,
    })
    setAddrDialogOpen(true)
  }

  const handleSaveAddress = async () => {
    if (!addrForm.recipient_name.trim() || !addrForm.street.trim()
      || !addrForm.city.trim() || !addrForm.state.trim() || !addrForm.zip_code.trim()) {
      toast.error('Completa los campos requeridos')
      return
    }
    setAddrSaving(true)
    try {
      const payload = {
        ...addrForm,
        phone: addrForm.phone || undefined,
        exterior_number: addrForm.exterior_number || null,
        interior_number: addrForm.interior_number || null,
        colonia: addrForm.colonia || null,
        instructions: addrForm.instructions || null,
      }
      const url = editingAddr
        ? `/api/admin/customers/${id}/addresses/${editingAddr.id}`
        : `/api/admin/customers/${id}/addresses`
      const method = editingAddr ? 'PATCH' : 'POST'
      const res = await fetchWithCredentials(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success(editingAddr ? 'Dirección actualizada' : 'Dirección añadida')
      setAddrDialogOpen(false)
      fetchCustomer()
    } catch {
      toast.error('Error guardando dirección')
    } finally {
      setAddrSaving(false)
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    try {
      const res = await fetchWithCredentials(`/api/admin/customers/${id}/addresses/${addressId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Dirección eliminada')
      fetchCustomer()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Cliente no encontrado</p>
        <Link href="/admin/clientes">
          <Button variant="ghost" className="mt-4">Volver al listado</Button>
        </Link>
      </div>
    )
  }

  const name = customerDisplayName(customer)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <Link
            href="/admin/clientes"
            className="shrink-0 mt-1 p-2 rounded-xl hover:bg-gray-100 transition-colors"
            title="Volver"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-cyan/30 to-primary-cyan/10 flex items-center justify-center text-lg font-bold text-primary-dark shrink-0">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-primary-dark truncate">{name}</h1>
              <Badge variant="outline" className={cn('text-[11px] font-medium border', SEGMENT_STYLE[customer.segment])}>
                {customer.segment === 'vip' && <Crown className="w-3 h-3 mr-1" />}
                {SEGMENT_LABEL[customer.segment]}
              </Badge>
              {customer.customer_type === 'business' && (
                <Badge variant="outline" className="border-indigo-100 bg-indigo-50 text-indigo-700 text-[11px]">
                  <Building2 className="w-3 h-3 mr-1" />
                  Empresa
                </Badge>
              )}
              {!customer.is_active && (
                <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-200 text-[11px]">
                  Inactivo
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Cliente desde {fmtDate(customer.created_at)}
            </p>
            {customer.tags && customer.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {customer.tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-primary-cyan/10 text-primary-cyan border border-primary-cyan/20">
                    <TagIcon className="w-2.5 h-2.5" />
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={ShoppingBag} label="Pedidos" value={customer.orders_count.toString()} color="text-primary-cyan" bg="bg-primary-cyan/10" />
        <StatCard icon={DollarSign} label="Total gastado" value={fmtMXN(customer.total_spent_cents)} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard icon={UserCheck} label="Valor promedio" value={fmtMXN(customer.avg_order_value_cents)} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard icon={Calendar} label="Último pedido" value={fmtDate(customer.last_order_at)} color="text-amber-600" bg="bg-amber-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: contact + addresses */}
        <div className="space-y-4">
          <Card title="Contacto">
            <div className="flex items-start gap-3 pb-3 mb-3 border-b border-gray-100">
              <User className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Nombre</p>
                <p className="text-sm font-semibold text-primary-dark truncate">
                  {customerDisplayName(customer)}
                </p>
              </div>
            </div>
            <InfoRow icon={Mail} label="Email" value={customer.email} href={customer.email ? `mailto:${customer.email}` : undefined} />
            <InfoRow icon={Phone} label="Teléfono" value={customer.phone} href={customer.phone ? `tel:${customer.phone}` : undefined} />
            <InfoRow icon={MessageCircle} label="WhatsApp" value={customer.whatsapp} href={customer.whatsapp ? `https://wa.me/${customer.whatsapp.replace(/\D/g, '')}` : undefined} />
            {customer.customer_type === 'business' && (
              <>
                <InfoRow icon={Building2} label="Empresa" value={customer.company_name} />
                <InfoRow icon={StickyNote} label="RFC" value={customer.tax_id} />
              </>
            )}
            <InfoRow icon={Calendar} label="Cumpleaños" value={customer.birthday ? fmtDate(customer.birthday) : null} />
          </Card>

          <Card
            title="Direcciones"
            action={
              <Button size="sm" variant="ghost" onClick={openNewAddress} className="h-8 gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Añadir
              </Button>
            }
          >
            {customer.addresses && customer.addresses.length > 0 ? (
              <div className="space-y-2">
                {customer.addresses.map(a => (
                  <div key={a.id} className="rounded-xl border border-gray-100 p-3 hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-primary-dark">{a.label}</span>
                          {a.is_default_shipping && (
                            <Badge variant="outline" className="text-[10px] bg-primary-cyan/10 text-primary-cyan border-primary-cyan/30">
                              Envío
                            </Badge>
                          )}
                          {a.is_default_billing && (
                            <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-100">
                              Facturación
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {a.street} {a.exterior_number}{a.interior_number ? ` int. ${a.interior_number}` : ''}
                          {a.colonia ? `, ${a.colonia}` : ''}
                          <br />
                          {a.city}, {a.state} {a.zip_code}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => openEditAddress(a)}
                          className="p-1 rounded hover:bg-gray-100"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteAddress(a.id)}
                          className="p-1 rounded hover:bg-red-50"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Sin direcciones registradas</p>
            )}
          </Card>

          <Card title="Comunicaciones">
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-xs text-gray-600 leading-relaxed mb-3">
                Autorización para recibir novedades y ofertas por correo y WhatsApp (según los datos de contacto registrados).
              </p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-800">Comunicaciones comerciales</span>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-3 py-1 rounded-full',
                    customer.accepts_marketing
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-gray-100 text-gray-500 border border-gray-200'
                  )}
                >
                  {customer.accepts_marketing ? 'Autorizado' : 'No autorizado'}
                </span>
              </div>
              {!customer.accepts_marketing && (
                <p className="text-[11px] text-gray-400 mt-2">No incluye SMS.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Center + right: orders + notes */}
        <div className="lg:col-span-2 space-y-4">
          <Card title={`Pedidos recientes (${customer.recent_orders?.length ?? 0})`}>
            {customer.recent_orders && customer.recent_orders.length > 0 ? (
              <div className="space-y-2">
                {customer.recent_orders.map(o => (
                  <Link
                    key={o.id}
                    href={`/admin/pedidos/${o.id}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-primary-cyan/40 hover:bg-primary-cyan/5 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary-dark">#{o.short_id ?? o.id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-400">{fmtDateTime(o.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="outline" className="text-[11px]">
                        {o.status}
                      </Badge>
                      <span className="text-sm font-semibold text-primary-dark">{fmtMXN(o.total)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Sin pedidos aún</p>
            )}
          </Card>

          {/* Notes */}
          <Card title="Timeline CRM">
            {/* Composer */}
            <div className="mb-4 p-3 rounded-xl border border-gray-100 bg-gray-50/60 space-y-2">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Añade una nota, registra una llamada, queja o elogio…"
                rows={3}
                className="bg-white"
              />
              <div className="flex items-center justify-between gap-2">
                <Select value={noteKind} onValueChange={(v) => setNoteKind((v ?? 'note') as CustomerNoteKind)}>
                  <SelectTrigger className="w-[160px] h-9 bg-white border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(NOTE_KIND_LABEL) as CustomerNoteKind[]).filter(k => k !== 'system').map(k => (
                      <SelectItem key={k} value={k}>{NOTE_KIND_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddNote}
                  disabled={!noteText.trim() || noteSaving}
                  className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover gap-2 h-9 rounded-xl"
                >
                  {noteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Añadir
                </Button>
              </div>
            </div>

            {/* Timeline */}
            {customer.notes && customer.notes.length > 0 ? (
              <div className="space-y-3">
                {customer.notes.map(n => {
                  const Icon = NOTE_KIND_ICON[n.kind]
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3"
                    >
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', NOTE_KIND_STYLE[n.kind])}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 rounded-xl border border-gray-100 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-primary-dark">
                              {NOTE_KIND_LABEL[n.kind]}
                            </span>
                            {n.is_pinned && <Pin className="w-3 h-3 text-amber-500" />}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-400">{fmtDateTime(n.created_at)}</span>
                            <button
                              onClick={() => handleDeleteNote(n.id)}
                              className="p-1 rounded hover:bg-red-50"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap">{n.note}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic text-center py-6">Sin actividad registrada</p>
            )}
          </Card>

          {customer.internal_notes && (
            <Card title="Notas internas">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{customer.internal_notes}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Address Dialog */}
      <Dialog open={addrDialogOpen} onOpenChange={setAddrDialogOpen}>
        <DialogContent size="lg" className="p-0 overflow-hidden flex flex-col max-h-[92vh]">
          <div className="bg-gradient-to-r from-primary-dark to-[#0D2A3F] px-6 py-5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary-cyan" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">
                  {editingAddr ? 'Editar dirección' : 'Nueva dirección'}
                </DialogTitle>
                <p className="text-xs text-white/60">Envío y facturación</p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Etiqueta">
                <Input value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })} placeholder="Casa / Oficina" />
              </Field>
              <Field label="Recibe" required>
                <Input value={addrForm.recipient_name} onChange={(e) => setAddrForm({ ...addrForm, recipient_name: e.target.value })} placeholder="Juan Pérez" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Calle" required>
                  <Input value={addrForm.street} onChange={(e) => setAddrForm({ ...addrForm, street: e.target.value })} />
                </Field>
              </div>
              <Field label="Ext.">
                <Input value={addrForm.exterior_number} onChange={(e) => setAddrForm({ ...addrForm, exterior_number: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Int.">
                <Input value={addrForm.interior_number} onChange={(e) => setAddrForm({ ...addrForm, interior_number: e.target.value })} />
              </Field>
              <div className="col-span-2">
                <Field label="Colonia">
                  <Input value={addrForm.colonia} onChange={(e) => setAddrForm({ ...addrForm, colonia: e.target.value })} />
                </Field>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Ciudad" required>
                <Input value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })} />
              </Field>
              <Field label="Estado" required>
                <Input value={addrForm.state} onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })} />
              </Field>
              <Field label="CP" required>
                <Input value={addrForm.zip_code} onChange={(e) => setAddrForm({ ...addrForm, zip_code: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="País">
                <Input value={addrForm.country} onChange={(e) => setAddrForm({ ...addrForm, country: e.target.value })} />
              </Field>
              <Field label="Teléfono">
                <Input value={addrForm.phone} onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })} />
              </Field>
            </div>
            <Field label="Instrucciones de entrega">
              <Textarea
                value={addrForm.instructions}
                onChange={(e) => setAddrForm({ ...addrForm, instructions: e.target.value })}
                rows={2}
                placeholder="Portón negro, tocar dos veces…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <DefaultToggle
                label="Default de envío"
                checked={addrForm.is_default_shipping}
                onChange={(v) => setAddrForm({ ...addrForm, is_default_shipping: v })}
              />
              <DefaultToggle
                label="Default de facturación"
                checked={addrForm.is_default_billing}
                onChange={(v) => setAddrForm({ ...addrForm, is_default_billing: v })}
              />
            </div>
          </div>
          <div className="p-5 flex justify-end gap-3 border-t bg-gray-50/50 flex-shrink-0">
            <Button variant="ghost" onClick={() => setAddrDialogOpen(false)} className="rounded-xl" disabled={addrSaving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAddress}
              disabled={addrSaving}
              className="bg-primary-dark text-white hover:bg-black font-bold rounded-xl px-8"
            >
              {addrSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingAddr ? 'Guardar' : 'Añadir')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────────────

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 shadow-sm bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-primary-dark">{title}</h3>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType
  label: string
  value: string
  color: string
  bg: string
}) {
  return (
    <div className="rounded-2xl border border-gray-100 shadow-sm bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-xl font-bold text-primary-dark mt-1 truncate">{value}</p>
        </div>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', bg)}>
          <Icon className={cn('w-4 h-4', color)} />
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, href }: {
  icon: React.ElementType
  label: string
  value: string | null | undefined
  href?: string
}) {
  const content = value ? (
    <span className="text-gray-700">{value}</span>
  ) : (
    <span className="text-gray-300 italic">—</span>
  )
  return (
    <div className="flex items-center gap-3 py-1">
      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        {href && value ? (
          <a href={href} target="_blank" rel="noreferrer" className="text-sm text-primary-dark hover:text-primary-cyan truncate block">
            {value}
          </a>
        ) : (
          <div className="text-sm truncate">{content}</div>
        )}
      </div>
    </div>
  )
}

function PermissionRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={cn(
        'text-[11px] font-semibold px-2 py-0.5 rounded-full',
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
      )}>
        {active ? 'Autoriza' : 'No autoriza'}
      </span>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

function DefaultToggle({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors',
        checked
          ? 'bg-primary-cyan/10 border-primary-cyan/40 text-primary-cyan'
          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
      )}
    >
      <span className="font-medium">{label}</span>
      <span className={cn(
        'relative inline-flex h-5 w-9 rounded-full transition-colors',
        checked ? 'bg-primary-cyan' : 'bg-gray-200',
      )}>
        <span className={cn(
          'absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform',
          checked && 'translate-x-4',
        )} />
      </span>
    </button>
  )
}
