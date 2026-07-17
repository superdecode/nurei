'use client'

import { useCallback } from 'react'
import { useCartFlightStore, type CartFlightRect } from '@/lib/stores/cartFlight'

const FLIGHT_DURATION_MS = 600
const MOBILE_BREAKPOINT_PX = 768

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))
const nextPaint = () => new Promise<void>((resolve) =>
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
)

function serializeRect(rect: DOMRect): CartFlightRect {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

function getTargetKind(): 'mobile' | 'desktop' {
  return window.innerWidth < MOBILE_BREAKPOINT_PX ? 'mobile' : 'desktop'
}

interface LaunchFlightArgs {
  sourceEl: HTMLElement | null
  quantity?: number
}

export function useAddToCartFlight() {
  const startFlight = useCartFlightStore((state) => state.startFlight)
  const finishFlight = useCartFlightStore((state) => state.finishFlight)
  const pulseTarget = useCartFlightStore((state) => state.pulseTarget)

  return useCallback(async ({ sourceEl, quantity = 1 }: LaunchFlightArgs) => {
    if (typeof window === 'undefined' || !sourceEl) return

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const sourceRect = sourceEl.getBoundingClientRect()

    const targetKind = getTargetKind()
    await nextPaint()
    const targetEl = document.querySelector<HTMLElement>(`[data-cart-fly-target="${targetKind}"]`)
    const targetRect = targetEl?.getBoundingClientRect()

    if (prefersReducedMotion || !targetRect || targetRect.width === 0) {
      return
    }

    startFlight({
      sourceRect: serializeRect(sourceRect),
      targetRect: serializeRect(targetRect),
      quantity,
    })

    await wait(FLIGHT_DURATION_MS)

    finishFlight()
    pulseTarget(targetKind)
  }, [finishFlight, pulseTarget, startFlight])
}
