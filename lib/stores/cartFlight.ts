'use client'

import { create } from 'zustand'

export interface CartFlightRect {
  left: number
  top: number
  width: number
  height: number
}

export interface CartFlight {
  id: number
  sourceRect: CartFlightRect
  targetRect: CartFlightRect
  quantity: number
}

interface CartFlightStore {
  flight: CartFlight | null
  desktopPulseKey: number
  mobilePulseKey: number
  startFlight: (flight: Omit<CartFlight, 'id'>) => void
  finishFlight: () => void
  pulseTarget: (kind: 'mobile' | 'desktop') => void
}

export const useCartFlightStore = create<CartFlightStore>()((set) => ({
  flight: null,
  desktopPulseKey: 0,
  mobilePulseKey: 0,

  startFlight: (flight) => set({ flight: { id: Date.now(), ...flight } }),
  finishFlight: () => set({ flight: null }),

  pulseTarget: (kind) => set((state) => (
    kind === 'mobile'
      ? { mobilePulseKey: state.mobilePulseKey + 1 }
      : { desktopPulseKey: state.desktopPulseKey + 1 }
  )),
}))
