'use client'

import { Coins, ShoppingBag, Ticket, RotateCcw, Gift } from 'lucide-react'
import type { LoyaltyLedgerEntry } from '@/lib/stores/loyaltyStore'

const REASON_LABELS: Record<string, string> = {
  signup: 'Bono de bienvenida',
  purchase: 'Compra',
  redemption: 'Canje en pedido',
  refund_clawback: 'Ajuste por reembolso',
  refund_clawback_reversed: 'Ajuste revertido',
}

const REASON_ICONS: Record<string, React.ElementType> = {
  signup: Gift,
  purchase: ShoppingBag,
  redemption: Ticket,
  refund_clawback: RotateCcw,
  refund_clawback_reversed: RotateCcw,
}

function formatEntryDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function LoyaltyHistoryList({ history }: { history: LoyaltyLedgerEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-14">
        <Coins className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-bold text-gray-400">Aún no tienes movimientos</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {history.map((entry) => {
        const Icon = REASON_ICONS[entry.reason] ?? Coins
        const isPositive = entry.delta >= 0
        return (
          <div
            key={entry.id}
            className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isPositive ? 'bg-yellow-50' : 'bg-gray-100'
            }`}>
              <Icon className={`w-4 h-4 ${isPositive ? 'text-yellow-500' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">
                {REASON_LABELS[entry.reason] ?? entry.reason}
              </p>
              <p className="text-[11px] text-gray-400">{formatEntryDate(entry.created_at)}</p>
            </div>
            <span className={`text-sm font-black shrink-0 ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
              {isPositive ? '+' : ''}
              {entry.delta}
            </span>
          </div>
        )
      })}
    </div>
  )
}
