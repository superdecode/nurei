'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, X, RefreshCcw, ChevronLeft, ChevronRight, MessageSquare, Mail, ShoppingBag, Send,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

import type { PqrTicket, PqrStatus, PqrPriority, PqrType } from '@/types'
import { PQR_ESTADO_MAP, PQR_PRIORIDAD_MAP, PQR_TIPO_LABELS } from '@/lib/utils/constants'
import { formatDate } from '@/lib/utils/format'
import { totalPages as computeTotalPages } from '@/lib/utils/pagination'
import { cn } from '@/lib/utils'

const ESTADO_TABS: Array<{ value: PqrStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'abierto', label: 'Abierto' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'resuelto', label: 'Resuelto' },
  { value: 'cerrado', label: 'Cerrado' },
]

const PRIORIDAD_OPTIONS: Array<{ value: PqrPriority | 'all'; label: string }> = [
  { value: 'all', label: 'Toda prioridad' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
]

const TIPO_OPTIONS: Array<{ value: PqrType | 'all'; label: string }> = [
  { value: 'all', label: 'Todo tipo' },
  { value: 'peticion', label: 'Petición' },
  { value: 'queja', label: 'Queja' },
  { value: 'reclamo', label: 'Reclamo' },
  { value: 'sugerencia', label: 'Sugerencia' },
]

function EstadoBadge({ estado }: { estado: PqrStatus }) {
  const m = PQR_ESTADO_MAP[estado]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', m.color, m.bgColor, m.borderColor)}>
      {m.icon} {m.label}
    </span>
  )
}

function PrioridadBadge({ prioridad }: { prioridad: PqrPriority }) {
  const m = PQR_PRIORIDAD_MAP[prioridad]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', m.color, m.bgColor, m.borderColor)}>
      {m.label}
    </span>
  )
}

interface ApiList {
  tickets: PqrTicket[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type CountsResponse = Record<PqrStatus, number>

export default function PqrAdminPage() {
  const [data, setData] = useState<ApiList>({ tickets: [], total: 0, page: 1, pageSize: 20, totalPages: 1 })
  const [counts, setCounts] = useState<CountsResponse>({ abierto: 0, en_proceso: 0, resuelto: 0, cerrado: 0 })
  const [loading, setLoading] = useState(true)

  const [estadoTab, setEstadoTab] = useState<PqrStatus | 'all'>('all')
  const [prioridadFilter, setPrioridadFilter] = useState<PqrPriority | 'all'>('all')
  const [tipoFilter, setTipoFilter] = useState<PqrType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [searchApplied, setSearchApplied] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [drawerTicket, setDrawerTicket] = useState<PqrTicket | null>(null)
  const [respuestaDraft, setRespuestaDraft] = useState('')
  const [savingReply, setSavingReply] = useState(false)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (estadoTab !== 'all') params.set('estado', estadoTab)
      if (prioridadFilter !== 'all') params.set('prioridad', prioridadFilter)
      if (tipoFilter !== 'all') params.set('tipo', tipoFilter)
      if (searchApplied) params.set('search', searchApplied)

      const res = await fetch(`/api/admin/pqr?${params}`)
      const json = (await res.json()) as { data?: ApiList; error?: string }
      if (!res.ok || !json.data) {
        toast.error(json.error ?? 'Error al cargar los PQR')
        return
      }
      setData(json.data)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [estadoTab, prioridadFilter, tipoFilter, searchApplied, page])

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pqr/counts')
      const json = (await res.json()) as { data?: CountsResponse }
      if (json.data) setCounts(json.data)
    } catch {
      // silent — counts are a nice-to-have badge, not critical
    }
  }, [])

  useEffect(() => { fetchTickets() }, [fetchTickets])
  useEffect(() => { fetchCounts() }, [fetchCounts])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setSearchApplied(search.trim()); setPage(1) }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const openDrawer = (ticket: PqrTicket) => {
    setDrawerTicket(ticket)
    setRespuestaDraft(ticket.respuesta ?? '')
  }

  const closeDrawer = () => {
    setDrawerTicket(null)
    setRespuestaDraft('')
  }

  const patchTicket = useCallback(async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/pqr/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as { data?: PqrTicket; error?: string }
    if (!res.ok || !json.data) {
      toast.error(json.error ?? 'Error al actualizar')
      return null
    }
    return json.data
  }, [])

  const handleEstadoChange = async (estado: PqrStatus) => {
    if (!drawerTicket) return
    const updated = await patchTicket(drawerTicket.id, { estado })
    if (updated) {
      setDrawerTicket(updated)
      fetchTickets()
      fetchCounts()
      toast.success('Estado actualizado')
    }
  }

  const handlePrioridadChange = async (prioridad: PqrPriority) => {
    if (!drawerTicket) return
    const updated = await patchTicket(drawerTicket.id, { prioridad })
    if (updated) {
      setDrawerTicket(updated)
      fetchTickets()
      toast.success('Prioridad actualizada')
    }
  }

  const handleSendReply = async () => {
    if (!drawerTicket || !respuestaDraft.trim()) return
    setSavingReply(true)
    try {
      const updated = await patchTicket(drawerTicket.id, { respuesta: respuestaDraft.trim() })
      if (updated) {
        setDrawerTicket(updated)
        fetchTickets()
        toast.success('Respuesta enviada al cliente')
      }
    } finally {
      setSavingReply(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary-cyan" />
            PQR
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{data.total} caso{data.total !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="outline" onClick={() => { fetchTickets(); fetchCounts() }} className="gap-1.5 h-9 rounded-full text-xs font-semibold self-start">
          <RefreshCcw className="h-3.5 w-3.5" /> Actualizar
        </Button>
      </div>

      {/* Estado tabs */}
      <div className="flex flex-wrap gap-2">
        {ESTADO_TABS.map((tab) => {
          const active = estadoTab === tab.value
          const count = tab.value === 'all'
            ? counts.abierto + counts.en_proceso + counts.resuelto + counts.cerrado
            : counts[tab.value]
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => { setEstadoTab(tab.value); setPage(1) }}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                active ? 'bg-primary-dark text-white border-primary-dark' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              )}
            >
              {tab.label}
              <span className={cn('rounded-full px-1.5 text-[10px]', active ? 'bg-white/20' : 'bg-gray-100')}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative min-w-[min(100%,220px)] flex-1 basis-[220px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            className="h-10 pl-10 pr-10 text-sm bg-white border-gray-200 rounded-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por folio, asunto, correo…"
          />
          {search && (
            <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => { setSearch(''); setSearchApplied(''); setPage(1) }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select value={prioridadFilter} onValueChange={(v) => { setPrioridadFilter((v as PqrPriority | 'all') ?? 'all'); setPage(1) }}>
          <SelectTrigger aria-label="Filtrar por prioridad" className="w-[160px] h-10 border-gray-200 rounded-full">
            <SelectValue>{(v: string) => PRIORIDAD_OPTIONS.find((o) => o.value === v)?.label ?? 'Prioridad'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PRIORIDAD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter((v as PqrType | 'all') ?? 'all'); setPage(1) }}>
          <SelectTrigger aria-label="Filtrar por tipo" className="w-[160px] h-10 border-gray-200 rounded-full">
            <SelectValue>{(v: string) => TIPO_OPTIONS.find((o) => o.value === v)?.label ?? 'Tipo'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TIPO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Folio</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Tipo</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Cliente</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Asunto</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Prioridad</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Estado</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="w-20 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-16 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-28 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-40 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                  <TableCell><div className="w-16 h-5 bg-gray-100 rounded-full animate-pulse" /></TableCell>
                  <TableCell><div className="w-20 h-5 bg-gray-100 rounded-full animate-pulse" /></TableCell>
                  <TableCell><div className="w-20 h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                </TableRow>
              ))
            ) : data.tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="py-16 text-center">
                    <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 font-medium">No se encontraron casos</p>
                    <p className="text-xs text-gray-400 mt-1">Intenta cambiar los filtros</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="border-b transition-colors cursor-pointer hover:bg-gray-50/80"
                  onClick={() => openDrawer(ticket)}
                >
                  <TableCell><span className="font-mono text-sm font-semibold text-primary-dark">{ticket.ticket_number}</span></TableCell>
                  <TableCell><span className="text-xs text-gray-500">{PQR_TIPO_LABELS[ticket.tipo]}</span></TableCell>
                  <TableCell>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{ticket.cliente_nombre || ticket.cliente_email}</p>
                  </TableCell>
                  <TableCell><p className="text-sm text-gray-700 truncate max-w-[220px]">{ticket.asunto}</p></TableCell>
                  <TableCell><PrioridadBadge prioridad={ticket.prioridad} /></TableCell>
                  <TableCell><EstadoBadge estado={ticket.estado} /></TableCell>
                  <TableCell><p className="text-xs text-gray-500">{formatDate(ticket.created_at)}</p></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-xs text-gray-500">
              {(data.page - 1) * pageSize + 1}–{Math.min(data.page * pageSize, data.total)} de {data.total}
            </p>
            <div className="flex items-center gap-1">
              <button type="button" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-xs text-gray-600">{data.page} / {computeTotalPages(data.total, pageSize)}</span>
              <button type="button" disabled={data.page >= data.totalPages} onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {drawerTicket && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/40"
              onClick={closeDrawer}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-start justify-between border-b border-gray-100 px-5 py-3.5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">PQR</p>
                  <p className="text-xl font-black text-primary-dark font-mono leading-tight mt-0.5">{drawerTicket.ticket_number}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <EstadoBadge estado={drawerTicket.estado} />
                    <PrioridadBadge prioridad={drawerTicket.prioridad} />
                  </div>
                </div>
                <button type="button" onClick={closeDrawer} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition ml-1">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="rounded-xl border border-gray-100 p-4 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Cliente</p>
                  <p className="text-sm font-medium text-gray-900">{drawerTicket.cliente_nombre || 'Sin nombre'}</p>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500"><Mail className="h-3 w-3" /> {drawerTicket.cliente_email}</p>
                  {drawerTicket.order && (
                    <Link href={`/admin/pedidos/${drawerTicket.order.id}`} className="flex items-center gap-1.5 text-xs font-semibold text-primary-cyan hover:underline">
                      <ShoppingBag className="h-3 w-3" /> Pedido {drawerTicket.order.short_id}
                    </Link>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{drawerTicket.asunto}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{drawerTicket.mensaje}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="pqr-drawer-estado" className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">Estado</label>
                    <Select value={drawerTicket.estado} onValueChange={(v) => handleEstadoChange(v as PqrStatus)}>
                      <SelectTrigger id="pqr-drawer-estado" className="h-9 border-gray-200 rounded-lg text-xs">
                        <SelectValue>{(v: string) => ESTADO_TABS.find((t) => t.value === v)?.label ?? v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADO_TABS.filter((t) => t.value !== 'all').map((t) => (
                          <SelectItem key={t.value} value={t.value as string}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="pqr-drawer-prioridad" className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">Prioridad</label>
                    <Select value={drawerTicket.prioridad} onValueChange={(v) => handlePrioridadChange(v as PqrPriority)}>
                      <SelectTrigger id="pqr-drawer-prioridad" className="h-9 border-gray-200 rounded-lg text-xs">
                        <SelectValue>{(v: string) => PRIORIDAD_OPTIONS.find((o) => o.value === v)?.label ?? v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORIDAD_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                          <SelectItem key={o.value} value={o.value as string}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label htmlFor="pqr-drawer-respuesta" className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">Respuesta al cliente</label>
                  <Textarea
                    id="pqr-drawer-respuesta"
                    value={respuestaDraft}
                    onChange={(e) => setRespuestaDraft(e.target.value)}
                    placeholder="Escribe una respuesta — se envía por correo al enviar"
                    className="min-h-[100px] text-sm"
                  />
                  {drawerTicket.respuesta && drawerTicket.respuesta === respuestaDraft && (
                    <p className="text-[11px] text-gray-400 mt-1">Ya enviada al cliente.</p>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3">
                <Button
                  onClick={handleSendReply}
                  disabled={savingReply || !respuestaDraft.trim() || respuestaDraft.trim() === (drawerTicket.respuesta ?? '')}
                  className="flex items-center justify-center gap-2 w-full h-10 rounded-xl text-sm font-semibold"
                >
                  <Send className="h-4 w-4" /> {savingReply ? 'Enviando…' : 'Enviar respuesta'}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
