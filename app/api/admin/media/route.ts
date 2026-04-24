import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getMediaItems, deleteMedia, bulkDeleteMedia } from '@/lib/supabase/queries/media'

export async function GET() {
  try {
    const supabase = createServiceClient()
    const items = await getMediaItems(supabase)
    return NextResponse.json({ data: items })
  } catch {
    return NextResponse.json({ data: [], error: 'Error fetching media' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const convertToWebp = formData.get('convertToWebp') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    let uploadBuffer: ArrayBuffer | Buffer = await file.arrayBuffer()
    let mimeType = file.type
    let originalName = file.name
    let uploadSize = file.size

    if (convertToWebp && file.type.startsWith('image/') && file.type !== 'image/webp' && file.type !== 'image/svg+xml') {
      const sharp = (await import('sharp')).default
      const webpBuffer = await sharp(Buffer.from(uploadBuffer))
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer()
      uploadBuffer = webpBuffer
      mimeType = 'image/webp'
      uploadSize = webpBuffer.byteLength
      originalName = originalName.replace(/\.[^.]+$/, '.webp')
    }

    const filename = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filename, uploadBuffer, { cacheControl: '3600', upsert: false, contentType: mimeType })
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
