'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CheckoutBootstrapResponse } from '@/lib/store/normalize-checkout-settings'

type StoreCheckoutContextValue = {
  bootstrap: CheckoutBootstrapResponse | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const StoreCheckoutContext = createContext<StoreCheckoutContextValue | null>(null)

export function StoreCheckoutProvider({ children }: { children: ReactNode }) {
  const [bootstrap, setBootstrap] = useState<CheckoutBootstrapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/store/checkout')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo cargar la configuración')
      setBootstrap(json.data as CheckoutBootstrapResponse)
    } catch (e) {
      setBootstrap(null)
      setError(e instanceof Error ? e.message : 'Error de configuración')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ bootstrap, loading, error, refresh }),
    [bootstrap, loading, error, refresh]
  )

  return <StoreCheckoutContext.Provider value={value}>{children}</StoreCheckoutContext.Provider>
}

export function useStoreCheckout(): StoreCheckoutContextValue {
  const ctx = useContext(StoreCheckoutContext)
  if (!ctx) {
    throw new Error('useStoreCheckout must be used within StoreCheckoutProvider')
  }
  return ctx
}

/** Safe variant when provider might be absent (tests / storybook). */
export function useStoreCheckoutOptional(): StoreCheckoutContextValue | null {
  return useContext(StoreCheckoutContext)
}
