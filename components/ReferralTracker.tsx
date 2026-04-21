'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { v4 as uuid } from 'uuid'

export function ReferralTracker() {
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')

  useEffect(() => {
    if (!ref) return

    let sessionId = sessionStorage.getItem('_nurei_sid')
    if (!sessionId) {
      sessionId = uuid()
      sessionStorage.setItem('_nurei_sid', sessionId)
    }

    fetch('/api/referral/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: ref, sessionId }),
    }).catch(() => {})
  }, [ref])

  return null
}
