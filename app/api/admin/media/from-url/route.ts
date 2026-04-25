import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const { url, convertToWebp } = await request.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL requerida' }, { status: 400 })
    }

    // Validate URL is http/https
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
    }

    const fetchRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!fetchRes.ok) {
      return NextResponse.json({ error: `No se pudo descargar la imagen (${fetchRes.status})` }, { status: 400 })
    }

    const contentType = fetchRes.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'La URL no apunta a una imagen' }, { status: 400 })
    }

    const buffer = Buffer.from(await fetchRes.arrayBuffer())

    const originalName = parsed.pathname.split('/').pop()?.split('?')[0] ?? 'image'
    const baseName = originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'image'
    const shouldConvert = Boolean(convertToWebp) && contentType !== 'image/webp' && contentType !== 'image/svg+xml'
    const extFromMime = contentType.split('/')[1]?.toLowerCase() || 'jpg'
    const finalExt = shouldConvert ? 'webp' : extFromMime
    const filename = `${Date.now()}-${baseName}.${finalExt}`
    let uploadBuffer: Uint8Array = buffer
    let finalMime = contentType

    if (shouldConvert) {
      uploadBuffer = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer()
      finalMime = 'image/webp'
    }

    const supabase = createServiceClient()
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filename, uploadBuffer, { contentType: finalMime, cacheControl: '3600', upsert: false })
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
