import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'

const schema = z.object({
  dateFrom: z.string().date().default(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
  dateTo:   z.string().date().default(() => new Date().toISOString().slice(0, 10)),
  limit:    z.coerce.number().int().min(1).max(500).default(200),
})

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const parsed = schema.safeParse({
    dateFrom: request.nextUrl.searchParams.get('dateFrom') ?? undefined,
    dateTo:   request.nextUrl.searchParams.get('dateTo') ?? undefined,
    limit:    request.nextUrl.searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 })

  const { dateFrom, dateTo, limit } = parsed.data
  const supabase = createServiceClient()

  const { data: rows, error } = await supabase
    .from('page_load_errors')
    .select('id, error_type, error_msg, source_url, page_path, created_at')
    .gte('created_at', dateFrom + 'T00:00:00Z')
    .lte('created_at', dateTo + 'T23:59:59Z')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Frequency grouping
  const freq: Record<string, { error_type: string; error_msg: string; count: number; pages: Set<string>; last_seen: string }> = {}
  for (const row of rows ?? []) {
    const key = `${row.error_type}::${row.error_msg.slice(0, 120)}`
    if (!freq[key]) {
      freq[key] = { error_type: row.error_type, error_msg: row.error_msg, count: 0, pages: new Set(), last_seen: row.created_at }
    }
    freq[key].count++
    freq[key].pages.add(row.page_path)
    if (row.created_at > freq[key].last_seen) freq[key].last_seen = row.created_at
  }

  const grouped = Object.values(freq)
    .map((g) => ({ ...g, pages: Array.from(g.pages), pages_count: g.pages.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)

  // By type summary
  const byType: Record<string, number> = {}
  for (const row of rows ?? []) {
    byType[row.error_type] = (byType[row.error_type] ?? 0) + 1
  }

  const recent = (rows ?? []).slice(0, 50).map(({ id, error_type, error_msg, source_url, page_path, created_at }) => ({
    id, error_type, error_msg, source_url, page_path, created_at,
  }))

  return NextResponse.json({ data: { total: rows?.length ?? 0, by_type: byType, grouped, recent } })
}
