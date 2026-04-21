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

/** Internal admin profiles must not appear in storefront CRM list. */
async function getInternalAdminProfileIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('user_profiles').select('id').eq('role', 'admin')
  if (error) throw error
  return (data ?? []).map((r) => r.id as string)
}

/** PostgREST OR: manual CRM rows (`user_id` null) or linked auth users who are storefront customers only. */
function buildExcludeInternalUsersOr(excludedUserIds: string[]): string | null {
  if (excludedUserIds.length === 0) return null
  return `user_id.is.null,user_id.not.in.(${excludedUserIds.join(',')})`
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

  const excludedIds = await getInternalAdminProfileIds(supabase)
  const excludeInternalOr = buildExcludeInternalUsersOr(excludedIds)

  let query = supabase
    .from('customers')
    .select(BASE_SELECT, { count: 'exact' })

  if (excludeInternalOr) {
    // PostgREST combines multiple `or` params with AND (postgrest-js uses append).
    query = query.or(excludeInternalOr)
  }
  if (search && search.trim()) {
    // PostgREST `or` splits on commas — strip them so user input cannot break the filter
    const s = search.trim().replace(/,/g, ' ')
    if (s.length > 0) {
      const esc = (x: string) =>
        x
          .replace(/\\/g, '\\\\')
          .replace(/%/g, '\\%')
          .replace(/_/g, '\\_')
          .replace(/[()]/g, ' ')
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

  const rows = (data ?? []) as unknown as Customer[]
  const enriched = await enrichCustomersFromProfiles(supabase, rows)

  return {
    data: enriched,
    total: count ?? 0,
    page,
    limit,
  }
}

/** Si no hay first/last en CRM pero sí perfil de usuario (OAuth), copiamos el nombre del perfil. */
async function enrichCustomersFromProfiles(
  supabase: SupabaseClient,
  rows: Customer[],
): Promise<Customer[]> {
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
  if (userIds.length === 0) return rows

  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', userIds)
  if (error || !profiles?.length) return rows

  const map = new Map(profiles.map((p) => [p.id as string, (p.full_name ?? '').trim()]))
  const { data: affiliateProfiles } = await supabase
    .from('affiliate_profiles')
    .select('id')
    .in('id', userIds)
  const affiliateSet = new Set((affiliateProfiles ?? []).map((row) => row.id as string))

  return rows.map((c) => {
    const affiliateFlag = c.user_id ? affiliateSet.has(c.user_id) : false
    const fn = (c.first_name ?? '').trim()
    const ln = (c.last_name ?? '').trim()
    if (fn || ln) return { ...c, is_affiliate: affiliateFlag }
    const raw = c.user_id ? map.get(c.user_id) : ''
    if (!raw) return { ...c, is_affiliate: affiliateFlag }
    const parts = raw.split(/\s+/).filter(Boolean)
    return {
      ...c,
      first_name: parts[0] ?? null,
      last_name: parts.slice(1).join(' ') || null,
      is_affiliate: affiliateFlag,
    }
  })
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

  const [base] = await enrichCustomersFromProfiles(supabase, [data as unknown as Customer])

  const [addresses, notes, recentOrders] = await Promise.all([
    listCustomerAddresses(supabase, id),
    listCustomerNotes(supabase, id),
    listCustomerRecentOrders(supabase, id, 20),
  ])

  return {
    ...(base as unknown as Customer),
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

  // Whitelist only columns that exist in the `customers` table (schema 006_customers.sql).
  // This prevents "column X does not exist" failures if Zod adds optional fields
  // ahead of a migration.
  const emailNorm = rest.email ? rest.email.toLowerCase().trim() : null
  const phoneNorm = rest.phone ? rest.phone.trim() : null
  const whatsappNorm = rest.whatsapp ? rest.whatsapp.trim() : null

  const payload: Record<string, unknown> = {
    first_name: rest.first_name,
    last_name: rest.last_name ?? null,
    email: emailNorm,
    phone: phoneNorm,
    whatsapp: whatsappNorm,

    customer_type: rest.customer_type ?? 'individual',
    company_name: rest.company_name ?? null,
    tax_id: rest.tax_id ?? null,
    tax_regime: rest.tax_regime ?? null,
    billing_email: rest.billing_email ?? null,

    birthday: rest.birthday ?? null,
    gender: rest.gender ?? null,
    preferred_language: rest.preferred_language ?? 'es',

    // Force admin source for manually-created customers, never attach to auth user
    source: 'admin',
    user_id: null,
    referral_code: rest.referral_code ?? null,
    utm_source: rest.utm_source ?? null,
    utm_medium: rest.utm_medium ?? null,
    utm_campaign: rest.utm_campaign ?? null,

    segment: rest.segment ?? 'new',
    tags: rest.tags ?? [],

    accepts_marketing: rest.accepts_marketing ?? false,
    accepts_email_marketing: rest.accepts_email_marketing ?? false,
    accepts_sms_marketing: rest.accepts_sms_marketing ?? false,
    accepts_whatsapp_marketing: rest.accepts_whatsapp_marketing ?? false,
    consent_updated_at:
      rest.accepts_marketing
      || rest.accepts_email_marketing
      || rest.accepts_sms_marketing
      || rest.accepts_whatsapp_marketing
        ? new Date().toISOString()
        : null,

    loyalty_points: rest.loyalty_points ?? 0,
    store_credit_cents: rest.store_credit_cents ?? 0,

    is_active: rest.is_active ?? true,
    is_verified: rest.is_verified ?? false,
    risk_level: rest.risk_level ?? 'normal',
    internal_notes: rest.internal_notes ?? null,
  }

  const { data, error } = await supabase
    .from('customers')
    .insert(payload)
    .select(BASE_SELECT)
    .single()
  if (error) {
    // Attach payload context so the caller's logs explain the failure.
    const augmented = Object.assign(error, { _hint: 'createCustomer insert failed' })
    throw augmented
  }
  const created = data as unknown as Customer

  if (addresses && addresses.length > 0) {
    const rows = addresses.map((a) => ({ ...a, customer_id: created.id }))
    const { error: addrError } = await supabase.from('customer_addresses').insert(rows)
    if (addrError) {
      // Don't fail the whole request; customer is created
      console.error('[createCustomer] address insert failed:', addrError)
    }
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

type CustomerStatsRow = {
  is_active: boolean
  segment: string
  customer_type: string
  accepts_marketing: boolean
  total_spent_cents: number | null
  completed_orders_count: number | null
  created_at: string
}

/** Aggregates storefront CRM only (excludes rows linked to internal admin auth users). */
export async function getCustomerStats(supabase: SupabaseClient): Promise<CustomerStats> {
  const excludedIds = await getInternalAdminProfileIds(supabase)
  let q = supabase
    .from('customers')
    .select('is_active, segment, customer_type, accepts_marketing, total_spent_cents, completed_orders_count, created_at')
  const ex = buildExcludeInternalUsersOr(excludedIds)
  if (ex) q = q.or(ex)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as CustomerStatsRow[]
  const thirtyMs = Date.now() - 30 * 86400000
  let gmv = 0
  let ltvSum = 0
  let ltvN = 0
  for (const r of rows) {
    gmv += r.total_spent_cents ?? 0
    if ((r.completed_orders_count ?? 0) > 0) {
      ltvSum += r.total_spent_cents ?? 0
      ltvN += 1
    }
  }
  return {
    total: rows.length,
    active: rows.filter((r) => r.is_active).length,
    vip: rows.filter((r) => r.segment === 'vip').length,
    new_count: rows.filter((r) => r.segment === 'new').length,
    at_risk: rows.filter((r) => r.segment === 'at_risk').length,
    lost: rows.filter((r) => r.segment === 'lost').length,
    business: rows.filter((r) => r.customer_type === 'business').length,
    marketable: rows.filter((r) => r.accepts_marketing).length,
    gmv_cents: gmv,
    avg_ltv_cents: ltvN > 0 ? Math.round(ltvSum / ltvN) : 0,
    new_last_30d: rows.filter((r) => new Date(r.created_at).getTime() >= thirtyMs).length,
  }
}

// ─── CSV export helper ────────────────────────────────

export async function exportCustomersCsv(supabase: SupabaseClient): Promise<string> {
  const excludedIds = await getInternalAdminProfileIds(supabase)
  const excludeInternalOr = buildExcludeInternalUsersOr(excludedIds)

  let exportQuery = supabase
    .from('customers')
    .select('full_name,email,phone,customer_type,segment,tags,orders_count,total_spent_cents,last_order_at,created_at')
  if (excludeInternalOr) {
    exportQuery = exportQuery.or(excludeInternalOr)
  }
  const { data, error } = await exportQuery
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
