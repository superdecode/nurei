import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'

const schema = z.object({
  dateFrom: z.string().date().default(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
  dateTo: z.string().date().default(() => new Date().toISOString().slice(0, 10)),
})

const METRIC_THRESHOLDS: Record<string, { good: number; poor: number; unit: string }> = {
  LCP:  { good: 2500, poor: 4000, unit: 'ms' },
  CLS:  { good: 0.1,  poor: 0.25, unit: '' },
  INP:  { good: 200,  poor: 500,  unit: 'ms' },
  FCP:  { good: 1800, poor: 3000, unit: 'ms' },
  TTFB: { good: 800,  poor: 1800, unit: 'ms' },
}

const PRIVATE_ANALYTICS_CACHE = {
  'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const parsed = schema.safeParse({
    dateFrom: request.nextUrl.searchParams.get('dateFrom') ?? undefined,
    dateTo:   request.nextUrl.searchParams.get('dateTo') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 })

  const { dateFrom, dateTo } = parsed.data
  const supabase = createServiceClient()

  const { data: rows, error } = await supabase
    .from('page_performance_events')
    .select('metric_name, metric_value, rating, page_path, created_at')
    .gte('created_at', dateFrom + 'T00:00:00Z')
    .lte('created_at', dateTo + 'T23:59:59Z')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate per metric
  const byMetric: Record<string, number[]> = {}
  for (const row of rows ?? []) {
    if (!byMetric[row.metric_name]) byMetric[row.metric_name] = []
    byMetric[row.metric_name].push(Number(row.metric_value))
  }

  const summary = Object.entries(byMetric).map(([name, values]) => {
    const sorted = [...values].sort((a, b) => a - b)
    const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? 0
    const median = sorted[Math.floor(sorted.length * 0.5)] ?? 0
    const thresh = METRIC_THRESHOLDS[name]
    const pctGood = values.filter((v) => v <= (thresh?.good ?? 0)).length / values.length * 100
    const rating = thresh ? (p75 <= thresh.good ? 'good' : p75 <= thresh.poor ? 'needs-improvement' : 'poor') : 'good'
    return { name, p75: Math.round(p75 * 1000) / 1000, median: Math.round(median * 1000) / 1000, pct_good: Math.round(pctGood), count: values.length, rating, unit: thresh?.unit ?? 'ms' }
  })

  // Daily trend
  const dailyMap: Record<string, Record<string, number[]>> = {}
  for (const row of rows ?? []) {
    const day = (row.created_at as string).slice(0, 10)
    if (!dailyMap[day]) dailyMap[day] = {}
    if (!dailyMap[day][row.metric_name]) dailyMap[day][row.metric_name] = []
    dailyMap[day][row.metric_name].push(Number(row.metric_value))
  }
  const trend = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, metrics]) => {
      const entry: Record<string, number | string> = { day }
      for (const [name, vals] of Object.entries(metrics)) {
        const s = [...vals].sort((a, b) => a - b)
        entry[name] = Math.round((s[Math.floor(s.length * 0.75)] ?? 0) * 100) / 100
      }
      return entry
    })

  // Top slow pages per metric
  const pageMap: Record<string, Record<string, number[]>> = {}
  for (const row of rows ?? []) {
    if (!pageMap[row.page_path]) pageMap[row.page_path] = {}
    if (!pageMap[row.page_path][row.metric_name]) pageMap[row.page_path][row.metric_name] = []
    pageMap[row.page_path][row.metric_name].push(Number(row.metric_value))
  }
  const slowPages = Object.entries(pageMap)
    .map(([path, metrics]) => {
      const lcp = metrics['LCP'] ?? []
      const s = [...lcp].sort((a, b) => a - b)
      const p75 = s[Math.floor(s.length * 0.75)] ?? 0
      return { path, lcp_p75: Math.round(p75), samples: lcp.length }
    })
    .sort((a, b) => b.lcp_p75 - a.lcp_p75)
    .slice(0, 10)

  return NextResponse.json({ data: { summary, trend, slow_pages: slowPages } }, { headers: PRIVATE_ANALYTICS_CACHE })
}
