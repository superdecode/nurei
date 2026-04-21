import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const supabase = createServiceClient()
  const tagsParam = request.nextUrl.searchParams.get('selected')
  const selectedTags = (tagsParam ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

  const { data, error } = await supabase
    .from('customers')
    .select('id, tags')
    .eq('is_active', true)
  const { data: config } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'customer_tags_catalog')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'No se pudieron cargar etiquetas' }, { status: 500 })

  const tagSet = new Set<string>()
  for (const row of data ?? []) {
    for (const tag of row.tags ?? []) tagSet.add(tag)
  }
  const catalog = Array.isArray(config?.value) ? config.value : []
  for (const tag of catalog) tagSet.add(String(tag))

  let audienceCount = 0
  if (selectedTags.length > 0) {
    for (const row of data ?? []) {
      const rowTags = row.tags ?? []
      if (selectedTags.some((tag) => rowTags.includes(tag))) audienceCount += 1
    }
  }

  return NextResponse.json({
    data: {
      tags: Array.from(tagSet).sort((a, b) => a.localeCompare(b)),
      audience_count: audienceCount,
    },
  })
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const body = await request.json()
  const tag = String(body?.tag ?? '').trim()
  if (!tag) return NextResponse.json({ error: 'Tag requerida' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: config } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'customer_tags_catalog')
    .maybeSingle()

  const current = Array.isArray(config?.value) ? config.value : []
  const next = Array.from(new Set([...current, tag]))

  await supabase
    .from('app_config')
    .upsert({ key: 'customer_tags_catalog', value: next, description: 'Catálogo de etiquetas de clientes' })

  return NextResponse.json({ data: { tag } }, { status: 201 })
}
