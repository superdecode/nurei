'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import type { Metric } from 'web-vitals'

const RATING_THRESHOLDS: Record<string, [number, number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
}

// Cap error reports per session so a broken page in a loop can't flood the API
const MAX_ERRORS_PER_SESSION = 10
const GOOD_VITAL_SAMPLE_RATE = 0.1
const NEEDS_IMPROVEMENT_SAMPLE_RATE = 0.5

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const [good, poor] = RATING_THRESHOLDS[name] ?? [0, 0]
  if (value <= good) return 'good'
  if (value <= poor) return 'needs-improvement'
  return 'poor'
}

function getConnection(): string {
  const nav = navigator as Navigator & { connection?: { effectiveType?: string } }
  return nav.connection?.effectiveType ?? 'unknown'
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem('_sid')
    if (!id) {
      id = Math.random().toString(36).slice(2)
      sessionStorage.setItem('_sid', id)
    }
    return id
  } catch {
    return ''
  }
}

/**
 * Classify a failed resource so CSS and JS chunk failures are identifiable
 * exactly (asset URL preserved in source_url).
 */
function classifyResource(tag: string, url: string): 'css' | 'chunk' | 'img' | 'resource' {
  if (tag === 'link') {
    if (url.includes('.css') || url.includes('css')) return 'css'
    return 'resource'
  }
  if (tag === 'script') return 'chunk'
  if (tag === 'img') return 'img'
  return 'resource'
}

type VitalEvent = {
  metric_name: string
  metric_value: number
  rating: string
  page_path: string
  session_id: string
  user_agent: string
  connection: string
}

// Queue vitals and flush them in a single request instead of one POST per
// metric — cuts Vercel function invocations ~5x per pageview.
const vitalsQueue: VitalEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let errorsSent = 0
const sentErrorKeys = new Set<string>()

function flushVitals() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (vitalsQueue.length === 0) return
  const events = vitalsQueue.splice(0, vitalsQueue.length)
  const body = JSON.stringify({ type: 'vitals', events })
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/performance/track', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/performance/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // never block the page for analytics
  }
}

function queueVital(metric: Metric, path: string) {
  const rating = getRating(metric.name, metric.value)
  const sampleRate =
    rating === 'good'
      ? GOOD_VITAL_SAMPLE_RATE
      : rating === 'needs-improvement'
        ? NEEDS_IMPROVEMENT_SAMPLE_RATE
        : 1
  if (sampleRate < 1 && Math.random() > sampleRate) return

  vitalsQueue.push({
    metric_name: metric.name,
    metric_value: metric.value,
    rating,
    page_path: path,
    session_id: sessionId(),
    user_agent: navigator.userAgent.slice(0, 300),
    connection: getConnection(),
  })
  // Debounced flush: initial vitals (TTFB/FCP/LCP) usually land within seconds
  if (!flushTimer) flushTimer = setTimeout(flushVitals, 10_000)
}

function sendError(
  errorType: string,
  msg: string,
  path: string,
  sourceUrl?: string,
  stack?: string,
) {
  // Dedup identical errors within a session (e.g. an <img> retried in a loop)
  const key = `${errorType}:${msg.slice(0, 120)}`
  if (sentErrorKeys.has(key) || errorsSent >= MAX_ERRORS_PER_SESSION) return
  sentErrorKeys.add(key)
  errorsSent++

  const body = JSON.stringify({
    type: 'error',
    error_type: errorType,
    error_msg: msg.slice(0, 500),
    source_url: sourceUrl?.slice(0, 500),
    page_path: path,
    stack: stack?.slice(0, 2000),
    session_id: sessionId(),
    user_agent: navigator.userAgent.slice(0, 300),
  })
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/performance/track', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/performance/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // never block the page for analytics
  }
}

export function WebVitalsTracker() {
  const pathname = usePathname()
  const pathRef = useRef(pathname)

  useEffect(() => {
    pathRef.current = pathname
  }, [pathname])

  useEffect(() => {
    import('web-vitals').then(({ onLCP, onCLS, onINP, onFCP, onTTFB }) => {
      const report = (m: Metric) => queueVital(m, pathRef.current)
      onLCP(report)
      onCLS(report)
      onINP(report)
      onFCP(report)
      onTTFB(report)
    }).catch(() => {})

    // Resource load errors (stylesheets, scripts/chunks, images, iframes).
    // Captured on the capture phase — resource errors don't bubble.
    const onResourceError = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (!target || target === (window as unknown as EventTarget)) return
      const tag = target.tagName?.toLowerCase()
      if (!tag || !['script', 'link', 'img', 'iframe'].includes(tag)) return
      const src =
        (target as HTMLScriptElement).src ||
        (target as HTMLLinkElement).href ||
        ''
      const type = classifyResource(tag, src)
      sendError(type, `Failed to load ${tag}: ${src}`.slice(0, 500), pathRef.current, src)
    }

    // JS runtime errors
    const onJsError = (e: ErrorEvent) => {
      if (e.target !== window) return
      sendError('js', e.message || 'JS Error', pathRef.current, e.filename, e.error?.stack)
    }

    // Unhandled promise rejections
    const onUnhandled = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
      const stack = e.reason instanceof Error ? e.reason.stack : undefined
      sendError('js', `Unhandled promise: ${msg}`, pathRef.current, undefined, stack)
    }

    // Flush queued vitals when the page is hidden/closed — last chance to send
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushVitals()
    }

    window.addEventListener('error', onResourceError, true)
    window.addEventListener('error', onJsError)
    window.addEventListener('unhandledrejection', onUnhandled)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flushVitals)

    return () => {
      window.removeEventListener('error', onResourceError, true)
      window.removeEventListener('error', onJsError)
      window.removeEventListener('unhandledrejection', onUnhandled)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flushVitals)
    }
  }, [])

  return null
}
