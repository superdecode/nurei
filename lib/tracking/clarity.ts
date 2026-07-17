'use client'

type ClarityFn = (...args: unknown[]) => void

declare global {
  interface Window {
    clarity?: ClarityFn
  }
}

export function identifyClarityUser(userId: string): void {
  if (typeof window === 'undefined' || typeof window.clarity !== 'function') return
  try {
    window.clarity('identify', userId)
  } catch {
    // tracking must never break the app
  }
}
