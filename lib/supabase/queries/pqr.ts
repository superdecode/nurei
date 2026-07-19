import { SupabaseClient } from '@supabase/supabase-js'
import { toRange } from '@/lib/supabase/pagination'
import type { PqrTicket, PqrStatus, PqrType, PqrPriority } from '@/types'

export interface CreatePqrTicketInput {
  tipo: PqrType
  asunto: string
  mensaje: string
  cliente_email: string
  cliente_nombre?: string | null
  order_id?: string | null
  user_id?: string | null
  customer_id?: string | null
}

export async function createPqrTicket(
  supabase: SupabaseClient,
  input: CreatePqrTicketInput
): Promise<PqrTicket> {
  const { data, error } = await supabase
    .from('pqr_tickets')
    .insert({
      tipo: input.tipo,
      asunto: input.asunto,
      mensaje: input.mensaje,
      cliente_email: input.cliente_email,
      cliente_nombre: input.cliente_nombre ?? null,
      order_id: input.order_id ?? null,
      user_id: input.user_id ?? null,
      customer_id: input.customer_id ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as PqrTicket
}

export interface ListPqrOptions {
  page?: number
  pageSize?: number
  estado?: PqrStatus | 'all'
  prioridad?: PqrPriority | 'all'
  tipo?: PqrType | 'all'
  search?: string
}

export interface ListPqrResult {
  tickets: PqrTicket[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function listPqrTickets(
  supabase: SupabaseClient,
  opts: ListPqrOptions = {}
): Promise<ListPqrResult> {
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(Math.max(1, opts.pageSize ?? 20), 100)

  let countQuery = supabase.from('pqr_tickets').select('id', { count: 'exact', head: true })
  let dataQuery = supabase
    .from('pqr_tickets')
    .select('*, order:orders(id, short_id)')
    .order('created_at', { ascending: false })
    .range(...toRange(page, pageSize))

  if (opts.estado && opts.estado !== 'all') {
    countQuery = countQuery.eq('estado', opts.estado)
    dataQuery = dataQuery.eq('estado', opts.estado)
  }
  if (opts.prioridad && opts.prioridad !== 'all') {
    countQuery = countQuery.eq('prioridad', opts.prioridad)
    dataQuery = dataQuery.eq('prioridad', opts.prioridad)
  }
  if (opts.tipo && opts.tipo !== 'all') {
    countQuery = countQuery.eq('tipo', opts.tipo)
    dataQuery = dataQuery.eq('tipo', opts.tipo)
  }
  if (opts.search) {
    const term = `%${opts.search}%`
    const orFilter = `ticket_number.ilike.${term},asunto.ilike.${term},cliente_email.ilike.${term},cliente_nombre.ilike.${term}`
    countQuery = countQuery.or(orFilter)
    dataQuery = dataQuery.or(orFilter)
  }

  const [{ count }, { data, error }] = await Promise.all([countQuery, dataQuery])
  if (error) throw error

  const total = count ?? 0
  return {
    tickets: (data ?? []) as PqrTicket[],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getPqrCounts(supabase: SupabaseClient): Promise<Record<PqrStatus, number>> {
  const { data, error } = await supabase.from('pqr_tickets').select('estado')
  if (error) throw error

  const counts: Record<PqrStatus, number> = { abierto: 0, en_proceso: 0, resuelto: 0, cerrado: 0 }
  for (const row of data ?? []) {
    const estado = row.estado as PqrStatus
    if (estado in counts) counts[estado] += 1
  }
  return counts
}

export async function getPqrTicketById(
  supabase: SupabaseClient,
  id: string
): Promise<PqrTicket | null> {
  const { data, error } = await supabase
    .from('pqr_tickets')
    .select('*, order:orders(id, short_id)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as PqrTicket | null
}

export interface UpdatePqrTicketInput {
  estado?: PqrStatus
  prioridad?: PqrPriority
  respuesta?: string
  assigned_to?: string | null
}

export async function updatePqrTicket(
  supabase: SupabaseClient,
  id: string,
  input: UpdatePqrTicketInput
): Promise<PqrTicket> {
  const { data, error } = await supabase
    .from('pqr_tickets')
    .update(input)
    .eq('id', id)
    .select('*, order:orders(id, short_id)')
    .single()
  if (error) throw error
  return data as PqrTicket
}
