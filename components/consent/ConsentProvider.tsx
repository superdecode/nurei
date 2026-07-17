'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getConsent, setConsent, type ConsentValue } from '@/lib/tracking/consent'

type ConsentState = ConsentValue | 'pending'

type ConsentContextValue = {
  consent: ConsentState
  accept: () => void
  reject: () => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<ConsentState>('pending')

  useEffect(() => {
    setConsentState(getConsent() ?? 'pending')
  }, [])

  const accept = useCallback(() => {
    setConsent('accepted')
    setConsentState('accepted')
  }, [])

  const reject = useCallback(() => {
    setConsent('rejected')
    setConsentState('rejected')
  }, [])

  const value = useMemo(() => ({ consent, accept, reject }), [consent, accept, reject])

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext)
  if (!ctx) {
    throw new Error('useConsent must be used within ConsentProvider')
  }
  return ctx
}
