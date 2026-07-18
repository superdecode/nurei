import type { SupabaseClient } from '@supabase/supabase-js'

/** Reserves a compact, sequential order folio in the database. */
export async function reserveWeeklyOrderFolio(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc('reserve_weekly_order_short_id')
  if (error || !data) {
    throw new Error(error?.message || 'No se pudo reservar el folio del pedido.')
  }
  return data
}
