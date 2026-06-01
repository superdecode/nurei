'use client'

import { useEffect } from 'react'

export function ServiceWorkerCleanup() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((rs) => rs.forEach((r) => r.unregister()))
    }
  }, [])
  return null
}
