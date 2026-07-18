import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/server/rate-limit'

const RETENTION_DAYS = 30
// Probability of running the retention cleanup on any given insert —
// keeps the tables capped without a cron dependency.
const CLEANUP_PROBABILITY = 0.001

const vitalEventSchema = z.object({
  metric_name: z.enum(['LCP', 'CLS', 'INP', 'FCP', 'TTFB']),
  metric_value: z.number().finite(),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  page_path: z.string().max(500),
  session_id: z.string().max(64).optional(),
  user_agent: z.string().max(300).optional(),
  connection: z.string().max(50).optional(),
})

// Batched vitals: one request per pageview instead of one per metric
const vitalsBatchSchema = z.object({
  type: z.literal('vitals'),
  events: z.array(vitalEventSchema).min(1).max(10),
})

// Kept for backward compatibility with in-flight clients
const vitalSingleSchema = vitalEventSchema.extend({ type: z.literal('vital') })

const errorSchema = z.object({
  type: z.literal('error'),
  // css = stylesheet load failure, chunk = JS script/chunk load failure,
  // img = image load failure — exact asset in source_url
  error_type: z.enum(['resource', 'css', 'chunk', 'img', 'js', 'network', 'render', 'unknown']),
  error_msg: z.string().max(500),
  source_url: z.string().max(500).optional(),
  page_path: z.string().max(500),
  stack: z.string().max(2000).optional(),
  session_id: z.string().max(64).optional(),
  user_agent: z.string().max(300).optional(),
})

const payloadSchema = z.discriminatedUnion('type', [vitalsBatchSchema, vitalSingleSchema, errorSchema])

async function maybeCleanup(supabase: ReturnType<typeof createServiceClient>) {
  if (Math.random() >= CLEANUP_PROBABILITY) return
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString()
  await Promise.all([
    supabase.from('page_performance_events').delete().lt('created_at', cutoff),
    supabase.from('page_load_errors').delete().lt('created_at', cutoff),
  ])
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const rl = rateLimit(`perf-track:${ip}`, 30, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (parsed.data.type === 'vitals') {
    const { error } = await supabase.from('page_performance_events').insert(parsed.data.events)
    if (error) {
      console.error('[track/vitals]', error.message)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
  } else if (parsed.data.type === 'vital') {
    const { type: _, ...row } = parsed.data
    const { error } = await supabase.from('page_performance_events').insert(row)
    if (error) {
      console.error('[track/vitals]', error.message)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
  } else {
    const { type: _, ...row } = parsed.data
    const { error } = await supabase.from('page_load_errors').insert(row)
    if (error) {
      console.error('[track/errors]', error.message)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
  }

  await maybeCleanup(supabase)

  return NextResponse.json({ ok: true }, { status: 201 })
}
