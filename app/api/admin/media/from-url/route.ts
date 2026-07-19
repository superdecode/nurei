import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import sharp from 'sharp'
import { requireAdmin } from '@/lib/server/require-admin'
import { ALLOWED_MEDIA_MIME_TYPES, COMPRESSIBLE_MEDIA_MIME_TYPES } from '@/lib/server/media-mime-types'

const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const { url } = await request.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL requerida' }, { status: 400 })
    }

    // Validate URL — must be http/https and must not target private/internal hosts (SSRF prevention)
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
    }

    const privateHostPattern =
      /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|::1|fc00:|fe80:|[:0]+$)/i
    if (privateHostPattern.test(parsed.hostname)) {
      return NextResponse.json({ error: 'URL no permitida' }, { status: 400 })
    }

    const fetchRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!fetchRes.ok) {
      return NextResponse.json({ error: `No se pudo descargar la imagen (${fetchRes.status})` }, { status: 400 })
    }

    const contentType = (fetchRes.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!ALLOWED_MEDIA_MIME_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: 'La URL no apunta a una imagen JPG, PNG, WebP o GIF' },
        { status: 400 }
      )
    }

    const declaredLength = Number(fetchRes.headers.get('content-length') ?? 0)
    if (declaredLength > MAX_DOWNLOAD_BYTES) {
      return NextResponse.json({ error: 'Imagen demasiado grande (máximo 15MB).' }, { status: 400 })
    }

    const buffer = Buffer.from(await fetchRes.arrayBuffer())
    if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
      return NextResponse.json({ error: 'Imagen demasiado grande (máximo 15MB).' }, { status: 400 })
    }

    const originalName = parsed.pathname.split('/').pop()?.split('?')[0] ?? 'image'
    const baseName = originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'image'
    const shouldConvert = COMPRESSIBLE_MEDIA_MIME_TYPES.has(contentType)
    const extFromMime = contentType.split('/')[1]?.toLowerCase() || 'jpg'
    const finalExt = shouldConvert ? 'webp' : extFromMime
    const filename = `${Date.now()}-${baseName}.${finalExt}`
    let uploadBuffer: Uint8Array = buffer
    let finalMime = contentType

    if (shouldConvert) {
      uploadBuffer = await sharp(buffer)
        .rotate() // respect EXIF orientation before stripping metadata
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer()
      finalMime = 'image/webp'
    }

    const supabase = createServiceClient()
    // Immutable timestamped filename — cache aggressively to cut Supabase egress
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filename, uploadBuffer, { contentType: finalMime, cacheControl: '31536000', upsert: false })
    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(filename)

    const { data, error } = await supabase
      .from('media')
      .insert({
        filename: `${baseName}.${finalExt}`,
        url: urlData.publicUrl,
        size_bytes: uploadBuffer.length,
        mime_type: finalMime,
      })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error procesando imagen'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
