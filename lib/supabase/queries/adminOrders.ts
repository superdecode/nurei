import { SupabaseClient } from '@supabase/supabase-js'
import type { Order, OrderUpdate, OrderStatus } from '@/types'

// ── List with server-side pagination & filters ──────────────────────────

export interface ListOrdersOptions {
  page?: number
  pageSize?: number
  status?: string
  paymentMethod?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export interface ListOrdersResult {
  orders: Order[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function listOrders(
  supabase: SupabaseClient,
  opts: ListOrdersOptions = {}
): Promise<ListOrdersResult> {
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(Math.max(1, opts.pageSize ?? 20), 100)
  const sortBy = opts.sortBy ?? 'created_at'
  const sortDir = opts.sortDir ?? 'desc'

  let countQuery = supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })

  let dataQuery = supabase
    .from('orders')
    .select('*')
    .order(sortBy, { ascending: sortDir === 'asc' })
    .range((page - 1) * pageSize, page * pageSize - 1)

  // Filters
  if (opts.status && opts.status !== 'all') {
    const statusMap: Record<string, string[]> = {
      pending_payment: ['pending'],
      paid: ['paid', 'confirmed'],
      preparing: ['preparing'],
      shipped: ['shipped'],
      delivered: ['delivered'],
      cancelled: ['cancelled'],
      refunded: ['refunded'],
    }
    const statusValues = statusMap[opts.status] ?? [opts.status]
    if (statusValues.length === 1) {
      countQuery = countQuery.eq('status', statusValues[0])
      dataQuery = dataQuery.eq('status', statusValues[0])
    } else {
      countQuery = countQuery.in('status', statusValues)
      dataQuery = dataQuery.in('status', statusValues)
    }
  }

  if (opts.paymentMethod && opts.paymentMethod !== 'all') {
    countQuery = countQuery.eq('payment_method', opts.paymentMethod)
    dataQuery = dataQuery.eq('payment_method', opts.paymentMethod)
  }

  if (opts.search) {
    const s = `%${opts.search}%`
    const filter = `short_id.ilike.${s},customer_name.ilike.${s},customer_email.ilike.${s},customer_phone.ilike.${s}`
    countQuery = countQuery.or(filter)
    dataQuery = dataQuery.or(filter)
  }

  if (opts.dateFrom) {
    countQuery = countQuery.gte('created_at', opts.dateFrom)
    dataQuery = dataQuery.gte('created_at', opts.dateFrom)
  }
  if (opts.dateTo) {
    const to = opts.dateTo.includes('T') ? opts.dateTo : `${opts.dateTo}T23:59:59.999Z`
    countQuery = countQuery.lte('created_at', to)
    dataQuery = dataQuery.lte('created_at', to)
  }

  const [{ count }, { data, error }] = await Promise.all([countQuery, dataQuery])
  if (error) throw error
  const total = count ?? 0

  return {
    orders: (data ?? []) as unknown as Order[],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

// ── Single order with updates ───────────────────────────────────────────

export async function getOrderDetail(
  supabase: SupabaseClient,
  orderId: string
): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()
  if (error || !data) return null

  const { data: updates } = await supabase
    .from('order_updates')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  return { ...(data as unknown as Order), updates: (updates ?? []) as unknown as OrderUpdate[] }
}

// ── Adjacent orders for prev/next navigation ────────────────────────────

export async function getAdjacentOrderIds(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ prev: string | null; next: string | null }> {
  const { data: current } = await supabase
    .from('orders')
    .select('created_at')
    .eq('id', orderId)
    .single()

  if (!current) return { prev: null, next: null }

  const [{ data: prevRows }, { data: nextRows }] = await Promise.all([
    supabase
      .from('orders')
      .select('id')
      .gt('created_at', current.created_at)
      .order('created_at', { ascending: true })
      .limit(1),
    supabase
      .from('orders')
      .select('id')
      .lt('created_at', current.created_at)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  return {
    prev: prevRows?.[0]?.id ?? null,
    next: nextRows?.[0]?.id ?? null,
  }
}

// ── Update order status ─────────────────────────────────────────────────

// Maps new extended statuses to the DB-safe values that pass the CHECK constraint.
// Once a migration is applied to add new values, this mapping can be removed.
const DB_STATUS_MAP: Record<string, string> = {
  pending_payment: 'pending',
  paid: 'confirmed',
  preparing: 'confirmed',
  ready_to_ship: 'confirmed',
  refunded: 'cancelled',
}

function toDbStatus(status: string): string {
  return DB_STATUS_MAP[status] ?? status
}

export async function updateOrderStatus(
  supabase: SupabaseClient,
  orderId: string,
  newStatus: OrderStatus,
  note?: string,
  updatedBy?: string
): Promise<void> {
  const dbStatus = toDbStatus(newStatus)

  const timestampField: Record<string, string> = {
    paid: 'confirmed_at',
    confirmed: 'confirmed_at',
    preparing: 'confirmed_at',
    ready_to_ship: 'confirmed_at',
    shipped: 'shipped_at',
    delivered: 'delivered_at',
    cancelled: 'cancelled_at',
    refunded: 'cancelled_at',
  }

  const updatePayload: Record<string, unknown> = {
    status: dbStatus,
    updated_at: new Date().toISOString(),
  }
  const tsField = timestampField[newStatus]
  if (tsField) updatePayload[tsField] = new Date().toISOString()
  if (newStatus === 'paid' || newStatus === 'confirmed') updatePayload.payment_status = 'paid'
  if (newStatus === 'refunded') updatePayload.payment_status = 'refunded'

  const { error } = await supabase.from('orders').update(updatePayload).eq('id', orderId)
  if (error) throw new Error(`DB error: ${error.message}`)

  // Log the original logical status in order_updates for full audit trail
  const { error: logError } = await supabase.from('order_updates').insert({
    order_id: orderId,
    status: dbStatus,
    message: note || `Estatus actualizado a ${newStatus}`,
    updated_by: updatedBy ?? 'admin',
    metadata: { logical_status: newStatus },
  })
  if (logError) console.error('Warning: could not write order log:', logError.message)
}

// ── Add note ────────────────────────────────────────────────────────────

export async function addOrderNote(
  supabase: SupabaseClient,
  orderId: string,
  message: string,
  updatedBy?: string
): Promise<OrderUpdate> {
  const { data: order } = await supabase.from('orders').select('status').eq('id', orderId).single()
  const { data, error } = await supabase
    .from('order_updates')
    .insert({
      order_id: orderId,
      status: order?.status ?? 'pending',
      message,
      updated_by: updatedBy ?? 'admin',
      metadata: { type: 'note' },
    })
    .select()
    .single()
  if (error) throw error
  return data as unknown as OrderUpdate
}

// ── Export (all rows, no pagination) ────────────────────────────────────

export async function exportOrders(
  supabase: SupabaseClient,
  opts: { status?: string; dateFrom?: string; dateTo?: string } = {}
): Promise<Order[]> {
  let query = supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status)
  if (opts.dateFrom) query = query.gte('created_at', opts.dateFrom)
  if (opts.dateTo) {
    const to = opts.dateTo.includes('T') ? opts.dateTo : `${opts.dateTo}T23:59:59.999Z`
    query = query.lte('created_at', to)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Order[]
}
