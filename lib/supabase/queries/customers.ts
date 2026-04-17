import { SupabaseClient } from '@supabase/supabase-js'
import type {
  Customer,
  CustomerAddress,
  CustomerListFilters,
  CustomerNote,
  CustomerStats,
  Order,
} from '@/types'
import type {
  CreateCustomerInput,
  CustomerAddressInput,
  CustomerNoteInput,
  UpdateCustomerInput,
} from '@/lib/validations/customer'

const BASE_SELECT = `
  id, user_id,
  first_name, last_name, full_name,
  email, phone, whatsapp, avatar_url,
  customer_type, company_name, tax_id, tax_regime, billing_email,
  birthday, gender, preferred_language,
  source, referral_code, referred_by, utm_source, utm_medium, utm_campaign,
  segment, tags,
  accepts_marketing, accepts_email_marketing, accepts_sms_marketing, accepts_whatsapp_marketing, consent_updated_at,
  loyalty_points, store_credit_cents,
  is_active, is_verified, risk_level, internal_notes,
  orders_count, completed_orders_count, cancelled_orders_count,
  total_spent_cents, avg_order_value_cents,
  first_order_at, last_order_at,
  created_at, updated_at
`

export interface CustomerListResult {
  data: Customer[]
  total: number
  page: number
  limit: number
}

export async function listCustomers(
  supabase: SupabaseClient,
  filters: CustomerListFilters = {},
): Promise<CustomerListResult> {
  const {
    search, segment = 'all', type = 'all', tag,
    has_orders, is_active, accepts_marketing, min_spent_cents,
    page = 1, limit = 50,
    sort = 'created_at', order = 'desc',
  } = filters

  let query = supabase
    .from('customers')
    .select(BASE_SELECT, { count: 'exact' })

  if (search && search.trim()) {
    // PostgREST `or` splits on commas — strip them so user input cannot break the filter
    const s = search.trim().replace(/,/g, ' ')
    if (s.length > 0) {
      const esc = (x: string) =>
        x.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
      const q = esc(s)
      // Search real columns only — generated `full_name` can fail to filter in some PostgREST setups
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company_name.ilike.%${q}%`,
      )
    }
  }
  if (segment !== 'all') query = query.eq('segment', segment)
  if (type !== 'all') query = query.eq('customer_type', type)
  if (tag) query = query.contains('tags', [tag])
  if (has_orders === true) query = query.gt('orders_count', 0)
  if (has_orders === false) query = query.eq('orders_count', 0)
  if (is_active !== undefined) query = query.eq('is_active', is_active)
  if (accepts_marketing !== undefined) query = query.eq('accepts_marketing', accepts_marketing)
  if (min_spent_cents !== undefined) query = query.gte('total_spent_cents', min_spent_cents)

  const asc = order === 'asc'
  if (sort === 'full_name') {
    query = query
      .order('first_name', { ascending: asc })
      .order('last_name', { ascending: asc })
  } else {
    query = query.order(sort, { ascending: asc })
  }
  query = query.range((page - 1) * limit, page * limit - 1)

  const { data, error, count } = await query
  if (error) throw error

  return {
    data: (data ?? []) as unknown as Customer[],
    total: count ?? 0,
    page,
    limit,
  }
}

export async function getCustomerById(
  supabase: SupabaseClient,
  id: string,
): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select(BASE_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const [addresses, notes, recentOrders] = await Promise.all([
    listCustomerAddresses(supabase, id),
    listCustomerNotes(supabase, id),
    listCustomerRecentOrders(supabase, id, 20),
  ])

  return {
    ...(data as unknown as Customer),
    addresses,
    notes,
    recent_orders: recentOrders,
  }
}

export async function createCustomer(
  supabase: SupabaseClient,
  input: CreateCustomerInput,
): Promise<Customer> {
  const { addresses, ...rest } = input
  const normalized = {
    ...rest,
    email: rest.email ? rest.email.toLowerCase().trim() : null,
    phone: rest.phone ?? null,
    consent_updated_at: rest.accepts_marketing
      || rest.accepts_email_marketing
      || rest.accepts_sms_marketing
      || rest.accepts_whatsapp_marketing
      ? new Date().toISOString()
      : null,
  }

  const { data, error } = await supabase
    .from('customers')
    .insert(normalized)
    .select(BASE_SELECT)
    .single()
  if (error) throw error
  const created = data as unknown as Customer

  if (addresses && addresses.length > 0) {
    const rows = addresses.map((a) => ({ ...a, customer_id: created.id }))
    await supabase.from('customer_addresses').insert(rows)
  }

  return created
}

export async function updateCustomer(
  supabase: SupabaseClient,
  id: string,
  input: UpdateCustomerInput,
): Promise<Customer> {
  const { addresses: _addrs, ...rest } = input as UpdateCustomerInput & { addresses?: unknown }
  void _addrs

  const payload: Record<string, unknown> = { ...rest }
  if (typeof payload.email === 'string') {
    payload.email = (payload.email as string).toLowerCase().trim() || null
  }

  const touchesConsent =
    payload.accepts_marketing !== undefined
    || payload.accepts_email_marketing !== undefined
    || payload.accepts_sms_marketing !== undefined
    || payload.accepts_whatsapp_marketing !== undefined
  if (touchesConsent) payload.consent_updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('id', id)
    .select(BASE_SELECT)
    .single()
  if (error) throw error
  return data as unknown as Customer
}

export async function deleteCustomer(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
}

export async function setCustomerActive(
  supabase: SupabaseClient,
  id: string,
  is_active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ is_active })
    .eq('id', id)
  if (error) throw error
}

// ─── Addresses ─────────────────────────────────────────

export async function listCustomerAddresses(
  supabase: SupabaseClient,
  customerId: string,
): Promise<CustomerAddress[]> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_default_shipping', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as CustomerAddress[]
}

export async function createCustomerAddress(
  supabase: SupabaseClient,
  customerId: string,
  input: CustomerAddressInput,
): Promise<CustomerAddress> {
  if (input.is_default_shipping) {
    await supabase
      .from('customer_addresses')
      .update({ is_default_shipping: false })
      .eq('customer_id', customerId)
  }
  if (input.is_default_billing) {
    await supabase
      .from('customer_addresses')
      .update({ is_default_billing: false })
      .eq('customer_id', customerId)
  }
  const { data, error } = await supabase
    .from('customer_addresses')
    .insert({ ...input, customer_id: customerId })
    .select('*')
    .single()
  if (error) throw error
  return data as unknown as CustomerAddress
}

export async function updateCustomerAddress(
  supabase: SupabaseClient,
  addressId: string,
  input: Partial<CustomerAddressInput>,
): Promise<CustomerAddress> {
  const { data: existing } = await supabase
    .from('customer_addresses')
    .select('customer_id')
    .eq('id', addressId)
    .single()

  if (existing && input.is_default_shipping) {
    await supabase
      .from('customer_addresses')
      .update({ is_default_shipping: false })
      .eq('customer_id', existing.customer_id)
      .neq('id', addressId)
  }
  if (existing && input.is_default_billing) {
    await supabase
      .from('customer_addresses')
      .update({ is_default_billing: false })
      .eq('customer_id', existing.customer_id)
      .neq('id', addressId)
  }

  const { data, error } = await supabase
    .from('customer_addresses')
    .update(input)
    .eq('id', addressId)
    .select('*')
    .single()
  if (error) throw error
  return data as unknown as CustomerAddress
}

export async function deleteCustomerAddress(
  supabase: SupabaseClient,
  addressId: string,
): Promise<void> {
  const { error } = await supabase
    .from('customer_addresses')
    .delete()
    .eq('id', addressId)
  if (error) throw error
}

// ─── Notes ─────────────────────────────────────────────

export async function listCustomerNotes(
  supabase: SupabaseClient,
  customerId: string,
): Promise<CustomerNote[]> {
  const { data, error } = await supabase
    .from('customer_notes')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as CustomerNote[]
}

export async function createCustomerNote(
  supabase: SupabaseClient,
  customerId: string,
  authorId: string | null,
  input: CustomerNoteInput,
): Promise<CustomerNote> {
  const { data, error } = await supabase
    .from('customer_notes')
    .insert({ ...input, customer_id: customerId, author_id: authorId })
    .select('*')
    .single()
  if (error) throw error
  return data as unknown as CustomerNote
}

export async function deleteCustomerNote(
  supabase: SupabaseClient,
  noteId: string,
): Promise<void> {
  const { error } = await supabase
    .from('customer_notes')
    .delete()
    .eq('id', noteId)
  if (error) throw error
}

// ─── Orders linked to customer ────────────────────────

export async function listCustomerRecentOrders(
  supabase: SupabaseClient,
  customerId: string,
  limit = 20,
): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, short_id, status, payment_status, total, items, created_at, shipped_at, delivered_at, paid_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as Order[]
}

// ─── Stats ─────────────────────────────────────────────

export async function getCustomerStats(supabase: SupabaseClient): Promise<CustomerStats> {
  const { data, error } = await supabase
    .from('customer_stats')
    .select('*')
    .maybeSingle()
  if (error) throw error
  return (data ?? {
    total: 0, active: 0, vip: 0, new_count: 0, at_risk: 0, lost: 0,
    business: 0, marketable: 0, gmv_cents: 0, avg_ltv_cents: 0, new_last_30d: 0,
  }) as unknown as CustomerStats
}

// ─── CSV export helper ────────────────────────────────

export async function exportCustomersCsv(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from('customers')
    .select('full_name,email,phone,customer_type,segment,tags,orders_count,total_spent_cents,last_order_at,created_at')
    .order('created_at', { ascending: false })
    .limit(10000)
  if (error) throw error

  const rows = data ?? []
  const header = [
    'Nombre', 'Email', 'Teléfono', 'Tipo', 'Segmento', 'Etiquetas',
    'Pedidos', 'Total gastado (MXN)', 'Último pedido', 'Creado',
  ]
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v).replace(/"/g, '""')
    return /[",\n]/.test(s) ? `"${s}"` : s
  }
  const lines = rows.map((r: Record<string, unknown>) => [
    r.full_name, r.email, r.phone, r.customer_type, r.segment,
    Array.isArray(r.tags) ? (r.tags as string[]).join('|') : '',
    r.orders_count,
    typeof r.total_spent_cents === 'number' ? ((r.total_spent_cents as number) / 100).toFixed(2) : '',
    r.last_order_at, r.created_at,
  ].map(escape).join(','))

  return [header.join(','), ...lines].join('\n')
}
