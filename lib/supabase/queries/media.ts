import { SupabaseClient } from '@supabase/supabase-js'
import type { MediaItem } from '@/types'

const BUCKET = 'media'

export async function uploadMedia(
  supabase: SupabaseClient,
  file: File,
  path?: string
): Promise<MediaItem> {
  const filename = path ?? `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
    })
  if (uploadError) throw uploadError

  // Get public URL
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename)

  // Create media record
  const { data, error } = await supabase
    .from('media')
    .insert({
      filename: file.name,
      url: urlData.publicUrl,
      size_bytes: file.size,
      mime_type: file.type,
    })
    .select()
    .single()
  if (error) throw error
  return data as MediaItem
}

export async function getMediaItems(supabase: SupabaseClient, limit = 100): Promise<MediaItem[]> {
  const { data, error } = await supabase
    .from('media')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as MediaItem[]
}

export async function deleteMedia(supabase: SupabaseClient, id: string, url: string): Promise<void> {
  // Extract path from URL
  const urlObj = new URL(url)
  const path = urlObj.pathname.split(`/storage/v1/object/public/${BUCKET}/`)[1]

  if (path) {
    await supabase.storage.from(BUCKET).remove([path])
  }

  const { error } = await supabase
    .from('media')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function bulkDeleteMedia(supabase: SupabaseClient, items: Array<{ id: string; url: string }>): Promise<void> {
  // Delete from storage
  const paths = items
    .map(item => {
      try {
        const urlObj = new URL(item.url)
        return urlObj.pathname.split(`/storage/v1/object/public/${BUCKET}/`)[1]
      } catch {
        return null
      }
    })
    .filter((p): p is string => !!p)

  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths)
  }

  // Delete records
  const { error } = await supabase
    .from('media')
    .delete()
    .in('id', items.map(i => i.id))
  if (error) throw error
}
