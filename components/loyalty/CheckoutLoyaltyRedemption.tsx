'use client'

import { formatPrice } from '@/lib/utils/format'

interface Props {
  balance: number
  maxDiscountCents: number
  value: number
  onChange: (points: number) => void
}

export function CheckoutLoyaltyRedemption({ balance, maxDiscountCents, value, onChange }: Props) {
  if (balance < 100) return null

  const maxRedeemablePoints = Math.min(balance, Math.floor(maxDiscountCents / 10 / 100) * 100)
  if (maxRedeemablePoints < 100) return null

  const discountCents = value * 10

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">Canjear Nurei Coins</span>
        <span className="text-muted-foreground">{balance} pts disponibles</span>
      </div>
      <input
        type="range"
        min={0}
        max={maxRedeemablePoints}
        step={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
        aria-label="Puntos a canjear"
      />
      <div className="mt-1 flex justify-between text-sm">
        <span>{value} pts</span>
        <span className="font-semibold text-emerald-600">-{formatPrice(discountCents)}</span>
      </div>
    </div>
  )
}
