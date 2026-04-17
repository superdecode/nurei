import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order, OrderItem, OrderUpdate, OrderStatus } from '@/types'

function productThumbUrl(row: {
  id: string
  images?: string[] | null
  primary_image_index?: number | null
  image_thumbnail_url?: string | null
}): string | null {
  if (row.image_thumbnail_url) return row.image_thumbnail_url
  const imgs = row.images ?? []
  if (!imgs.length) return null
  const idx = row.primary_image_index ?? 0
  return imgs[idx] ?? imgs[0] ?? null
}

export async function getUserOrders(
  supabase: SupabaseClient,
  userId: string,
  status?: OrderStatus
) {
  let query = supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw error
  const orders = (data ?? []) as Order[]

  const productIds = [
    ...new Set(
      orders.flatMap((o) =>
        (o.items ?? []).map((i) => i.product_id).filter((id): id is string => Boolean(id)),
      ),
    ),
  ]
  if (productIds.length === 0) return orders

  const { data: products, error: pe } = await supabase
    .from('products')
    .select('id, images, primary_image_index, image_thumbnail_url')
    .in('id', productIds)

  if (pe || !products?.length) return orders

  const urlById = new Map<string, string | null>(
    products.map((p) => [p.id as string, productThumbUrl(p as never)]),
  )

  return orders.map((o) => ({
    ...o,
    items: (o.items ?? []).map((it: OrderItem) => ({
      ...it,
      image_url: it.image_url ?? urlById.get(it.product_id) ?? null,
    })),
  }))
}

export async function getOrderById(supabase: SupabaseClient, orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()
  if (error) throw error
  return data as Order
}

export async function getOrderUpdates(supabase: SupabaseClient, orderId: string) {
  const { data, error } = await supabase
    .from('order_updates')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as OrderUpdate[]
}
