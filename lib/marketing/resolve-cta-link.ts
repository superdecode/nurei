import { SupabaseClient } from '@supabase/supabase-js'
import type { CampaignCtaLink } from '@/types'

/** Turns a product/category/url CTA link into an absolute nurei.mx URL for the sent email. */
export async function resolveCtaUrl(
  supabase: SupabaseClient,
  link: CampaignCtaLink | null,
  appUrl: string
): Promise<string> {
  if (!link) return appUrl

  if (link.type === 'url') {
    return link.value.startsWith('http') ? link.value : `${appUrl}${link.value}`
  }

  if (link.type === 'product') {
    const { data } = await supabase.from('products').select('slug').eq('slug', link.value).single()
    return data ? `${appUrl}/producto/${data.slug}` : appUrl
  }

  // category
  const { data } = await supabase.from('categories').select('slug').eq('slug', link.value).single()
  return data ? `${appUrl}/menu?categoria=${data.slug}` : `${appUrl}/menu`
}
