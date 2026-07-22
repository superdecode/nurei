'use client'

import { useEffect, useState } from 'react'
import { Gift, Sparkles } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAuthStore } from '@/lib/stores/auth'
import { useLoyaltyStore } from '@/lib/stores/loyaltyStore'
import { LoyaltyTierBadge } from './LoyaltyTierBadge'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'

const REASON_LABELS: Record<string, string> = {
  signup: 'Bono de bienvenida',
  purchase: 'Compra',
  redemption: 'Canje en pedido',
  refund_clawback: 'Ajuste por reembolso',
  refund_clawback_reversed: 'Ajuste revertido',
}

interface UserCoupon {
  id: string
  used_at: string | null
  coupon: { code: string; description: string | null }
}

export function LoyaltyWidget() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { balance, tier, history, loaded, fetchStatus } = useLoyaltyStore()
  const [open, setOpen] = useState(false)
  const [coupons, setCoupons] = useState<UserCoupon[]>([])

  useEffect(() => {
    if (isAuthenticated && !loaded) {
      fetchStatus()
    }
  }, [isAuthenticated, loaded, fetchStatus])

  useEffect(() => {
    if (!open) return
    fetchWithCredentials('/api/profile/coupons')
      .then((r) => r.json())
      .then((json) => setCoupons(json.data ?? []))
      .catch(() => setCoupons([]))
  }, [open])

  if (!isAuthenticated) return null

  const unusedCoupons = coupons.filter((c) => !c.used_at)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir mi programa de lealtad"
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/15 transition-transform hover:scale-105 motion-reduce:transition-none print:hidden"
      >
        <Gift className="h-6 w-6" />
        {unusedCoupons.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-rose-500" aria-hidden />
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col overflow-y-auto p-6">
          <SheetHeader className="p-0">
            <SheetTitle>Mi Nurei Coins</SheetTitle>
          </SheetHeader>

          <div className="mt-4 flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-2xl font-bold">{balance} pts</p>
              <p className="text-sm text-muted-foreground">Saldo canjeable</p>
            </div>
            <LoyaltyTierBadge tier={tier} />
          </div>

          {unusedCoupons.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
                <Sparkles className="h-4 w-4" /> Cupones sin usar
              </h3>
              <ul className="space-y-2">
                {unusedCoupons.map((c) => (
                  <li key={c.id} className="rounded-md border p-2 text-sm">
                    <span className="font-mono font-semibold">{c.coupon.code}</span>
                    {c.coupon.description && (
                      <p className="text-xs text-muted-foreground">{c.coupon.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex-1">
            <h3 className="mb-2 text-sm font-semibold">Historial</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no tienes movimientos.</p>
            ) : (
              <ul className="space-y-1">
                {history.map((entry) => (
                  <li key={entry.id} className="flex justify-between text-sm">
                    <span>{REASON_LABELS[entry.reason] ?? entry.reason}</span>
                    <span className={entry.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {entry.delta >= 0 ? '+' : ''}
                      {entry.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
