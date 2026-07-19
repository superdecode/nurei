import { SupabaseClient } from '@supabase/supabase-js'
import type { OrderRefund } from '@/types'

// ── List with server-side pagination, sorting & filters ─────────────────

export interface ListRefundsOptions {
  page?: number
  pageSize?: number
  status?: string
  refundMethod?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export interface ListRefundsResult {
  refunds: OrderRefund[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const SORTABLE_COLUMNS = new Set(['refunded_at', 'amount_cents', 'status', 'refund_method', 'created_at'])
const ORDER_SELECT = 'id, short_id, customer_name, customer_email, total'
const REFUND_SELECT = `id, order_id, amount_cents, reason, refund_method, status, stripe_refund_id, notes, processed_by, refunded_at, created_at, order:orders(${ORDER_SELECT})`

export async function listRefunds(
  supabase: SupabaseClient,
  opts: ListRefundsOptions = {}
): Promise<ListRefundsResult> {
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(Math.max(1, opts.pageSize ?? 20), 100)
  const sortBy = SORTABLE_COLUMNS.has(opts.sortBy ?? '') ? (opts.sortBy as string) : 'refunded_at'
  const sortDir = opts.sortDir ?? 'desc'

  let countQuery = supabase
    .from('order_refunds')
    .select('id', { count: 'exact', head: true })

  let dataQuery = supabase
    .from('order_refunds')
    .select(REFUND_SELECT)
    .order(sortBy, { ascending: sortDir === 'asc' })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (opts.status && opts.status !== 'all') {
    countQuery = countQuery.eq('status', opts.status)
    dataQuery = dataQuery.eq('status', opts.status)
  }

  if (opts.refundMethod && opts.refundMethod !== 'all') {
    countQuery = countQuery.eq('refund_method', opts.refundMethod)
    dataQuery = dataQuery.eq('refund_method', opts.refundMethod)
  }

  if (opts.dateFrom) {
    countQuery = countQuery.gte('refunded_at', opts.dateFrom)
    dataQuery = dataQuery.gte('refunded_at', opts.dateFrom)
  }
  if (opts.dateTo) {
    const to = opts.dateTo.includes('T') ? opts.dateTo : `${opts.dateTo}T23:59:59.999Z`
    countQuery = countQuery.lte('refunded_at', to)
    dataQuery = dataQuery.lte('refunded_at', to)
  }

  // Search spans both the refund's own text fields and the parent order's
  // identifying fields. PostgREST doesn't reliably support .or() across an
  // embedded resource, so matching orders are resolved first and combined
  // with a direct order_id.in(...) filter.
  if (opts.search) {
    const s = `%${opts.search}%`
    const { data: matchingOrders } = await supabase
      .from('orders')
      .select('id')
      .or(`short_id.ilike.${s},customer_name.ilike.${s},customer_email.ilike.${s}`)

    const orderIds = (matchingOrders ?? []).map((o: { id: string }) => o.id)
    const filter = orderIds.length > 0
      ? `reason.ilike.${s},notes.ilike.${s},order_id.in.(${orderIds.join(',')})`
      : `reason.ilike.${s},notes.ilike.${s}`
    countQuery = countQuery.or(filter)
    dataQuery = dataQuery.or(filter)
  }

  const [{ count }, { data, error }] = await Promise.all([countQuery, dataQuery])
  if (error) throw error
  const total = count ?? 0

  return {
    refunds: (data ?? []) as unknown as OrderRefund[],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

// ── Single refund with order context ────────────────────────────────────

export async function getRefundDetail(
  supabase: SupabaseClient,
  refundId: string
): Promise<OrderRefund | null> {
  const { data, error } = await supabase
    .from('order_refunds')
    .select(REFUND_SELECT)
    .eq('id', refundId)
    .single()

  if (error || !data) return null
  return data as unknown as OrderRefund
}
