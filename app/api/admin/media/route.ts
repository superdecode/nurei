import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getMediaItems, deleteMedia, bulkDeleteMedia } from '@/lib/supabase/queries/media'
import { requireAdmin } from '@/lib/server/require-admin'
import { ALLOWED_MEDIA_MIME_TYPES, COMPRESSIBLE_MEDIA_MIME_TYPES } from '@/lib/server/media-mime-types'

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const supabase = createServiceClient()
    const items = await getMediaItems(supabase)
    return NextResponse.json({ data: items })
  } catch {
    return NextResponse.json({ data: [], error: 'Error fetching media' })
  }
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // pre-compression input cap

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const supabase = createServiceClient()
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_MEDIA_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Formato no permitido. Usa JPG, PNG, WebP o GIF.' },
        { status: 400 },
      )
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Archivo demasiado grande (máximo 10MB).' },
        { status: 400 },
      )
    }

    let uploadBuffer: ArrayBuffer | Buffer = await file.arrayBuffer()
    let mimeType = file.type
    let originalName = file.name
    let uploadSize = file.size

    if (COMPRESSIBLE_MEDIA_MIME_TYPES.has(file.type)) {
      const sharp = (await import('sharp')).default
      const webpBuffer = await sharp(Buffer.from(uploadBuffer))
        .rotate() // respect EXIF orientation before stripping metadata
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer()
      uploadBuffer = webpBuffer
      mimeType = 'image/webp'
      uploadSize = webpBuffer.byteLength
      originalName = originalName.replace(/\.[^.]+$/, '.webp')
    }

    const filename = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    // Filenames are timestamp-prefixed (immutable) — cache aggressively to
    // minimize Supabase egress on repeat views.
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filename, uploadBuffer, { cacheControl: '31536000', upsert: false, contentType: mimeType })
    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(filename)

    const { data, error } = await supabase
      .from('media')
      .insert({
        filename: originalName,
        url: urlData.publicUrl,
        size_bytes: uploadSize,
        mime_type: mimeType,
      })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error uploading file'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const supabase = createServiceClient()
    const body = await request.json()

    if (Array.isArray(body.items)) {
      await bulkDeleteMedia(supabase, body.items)
    } else if (body.id && body.url) {
      await deleteMedia(supabase, body.id, body.url)
    } else {
      return NextResponse.json({ error: 'id and url are required' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error deleting media'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
