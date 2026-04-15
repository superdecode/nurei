import { SupabaseClient } from '@supabase/supabase-js'

export async function getSettings(supabase: SupabaseClient): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
  if (error) throw error

  const settings: Record<string, unknown> = {}
  for (const row of data ?? []) {
    settings[row.key] = row.value
  }
  return settings
}

export async function getSetting(supabase: SupabaseClient, key: string): Promise<unknown> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', key)
    .single()
  if (error) return null
  return data?.value
}

export async function upsertSetting(
  supabase: SupabaseClient,
  key: string,
  value: unknown,
  description?: string
): Promise<void> {
  const { error } = await supabase
    .from('app_config')
    .upsert({ key, value, description, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

export async function upsertMultipleSettings(
  supabase: SupabaseClient,
  settings: Record<string, unknown>
): Promise<void> {
  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('app_config')
    .upsert(rows, { onConflict: 'key' })
  if (error) throw error
}
