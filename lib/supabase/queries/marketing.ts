import { SupabaseClient } from '@supabase/supabase-js'
import type { MarketingCampaign, CampaignStatus } from '@/types'
import type { AudienceFilter } from '@/lib/marketing/audience-filter'

export interface ListCampaignsOptions {
  status?: CampaignStatus
}

export async function listCampaigns(
  supabase: SupabaseClient,
  opts: ListCampaignsOptions = {}
): Promise<MarketingCampaign[]> {
  let query = supabase
    .from('marketing_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (opts.status) query = query.eq('status', opts.status)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as MarketingCampaign[]
}

export async function getCampaign(supabase: SupabaseClient, id: string): Promise<MarketingCampaign | null> {
  const { data, error } = await supabase.from('marketing_campaigns').select('*').eq('id', id).single()
  if (error) return null
  return data as MarketingCampaign
}

export interface CreateCampaignInput {
  name: string
  subject: string
  preheader: string | null
  template_key: MarketingCampaign['template_key']
  content: MarketingCampaign['content']
  audience_segments: string[]
  audience_tags: string[]
  coupon_code: string | null
  created_by: string
}

export async function createCampaign(supabase: SupabaseClient, input: CreateCampaignInput): Promise<MarketingCampaign> {
  const { data, error } = await supabase.from('marketing_campaigns').insert(input).select('*').single()
  if (error) throw new Error(error.message)
  return data as MarketingCampaign
}

export type UpdateCampaignInput = Partial<Omit<CreateCampaignInput, 'created_by'>>

/** Only draft campaigns may be updated or deleted — enforced here, mirrors the coupons/orders draft-only rule. */
export async function updateCampaign(
  supabase: SupabaseClient,
  id: string,
  input: UpdateCampaignInput
): Promise<MarketingCampaign> {
  const { data: existing, error: fetchError } = await supabase
    .from('marketing_campaigns')
    .select('status')
    .eq('id', id)
    .single()
  if (fetchError || !existing) throw new Error('Campaña no encontrada')
  if (existing.status !== 'draft') throw new Error('Solo se pueden editar campañas en borrador')

  const { data, error } = await supabase
    .from('marketing_campaigns')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as MarketingCampaign
}

export async function deleteCampaign(supabase: SupabaseClient, id: string): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('marketing_campaigns')
    .select('status')
    .eq('id', id)
    .single()
  if (fetchError || !existing) throw new Error('Campaña no encontrada')
  if (existing.status !== 'draft') throw new Error('Solo se pueden eliminar campañas en borrador')

  const { error } = await supabase.from('marketing_campaigns').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export interface AudienceCustomer {
  id: string
  email: string
  full_name: string | null
}

/** Resolves the actual list of customers matching a filter — used both for send and for the count preview. */
export async function resolveAudience(supabase: SupabaseClient, filter: AudienceFilter): Promise<AudienceCustomer[]> {
  let query = supabase
    .from('customers')
    .select('id, email, full_name')
    .eq('accepts_email_marketing', filter.acceptsEmailMarketing)
    .eq('is_active', filter.isActive)
    .not('segment', 'in', `(${filter.excludeSegments.join(',')})`)
    .not('email', 'is', null)

  if (filter.segments.length > 0) query = query.in('segment', filter.segments)
  if (filter.tags.length > 0) query = query.overlaps('tags', filter.tags)

  const { data, error } = await query.limit(5000)
  if (error) throw new Error(error.message)
  return (data ?? []) as AudienceCustomer[]
}

export interface ActiveCoupon {
  code: string
  discount_type: string
  value: number
  description: string | null
}

export async function listActiveCoupons(supabase: SupabaseClient): Promise<ActiveCoupon[]> {
  const { data, error } = await supabase
    .from('coupons')
    .select('code, discount_type, value, description')
    .eq('is_active', true)
    .eq('is_paused', false)
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []) as ActiveCoupon[]
}
