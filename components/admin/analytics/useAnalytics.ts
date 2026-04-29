'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface UseAnalyticsOptions {
  params?: Record<string, string | number | undefined>
  enabled?: boolean
}

interface UseAnalyticsResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useAnalytics<T>(
  endpoint: string,
  options: UseAnalyticsOptions = {},
): UseAnalyticsResult<T> {
  const { params = {}, enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const buildUrl = useCallback(() => {
    const url = new URL(endpoint, window.location.origin)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
    return url.toString()
  }, [endpoint, JSON.stringify(params)])

  const fetchData = useCallback(async () => {
    if (!enabled) return

    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(buildUrl(), { signal: abortRef.current.signal })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Error ${res.status}`)
        return
      }
      const json = await res.json()
      setData(json.data ?? json)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    } finally {
      setLoading(false)
    }
  }, [buildUrl, enabled])

  useEffect(() => {
    fetchData()
    return () => {
      abortRef.current?.abort()
    }
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
