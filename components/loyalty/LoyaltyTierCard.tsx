'use client'

import { motion } from 'framer-motion'
import { Sprout, Flame, Star, Crown, Gem } from 'lucide-react'
import { tierProgress } from '@/lib/loyalty/tiers'
import { LoyaltyTierBadge } from './LoyaltyTierBadge'

const TIER_ICONS: Record<string, React.ElementType> = {
  curioso: Sprout,
  antojadizo: Flame,
  fanatico: Star,
  snack_lover: Crown,
  leyenda: Gem,
}

const TIER_ICON_STYLES: Record<string, string> = {
  curioso: 'bg-muted text-muted-foreground',
  antojadizo: 'bg-amber-100 text-amber-700',
  fanatico: 'bg-orange-100 text-orange-700',
  snack_lover: 'bg-rose-100 text-rose-700',
  leyenda: 'bg-violet-100 text-violet-700',
}

const TIER_MULTIPLIER_LABEL: Record<string, string> = {
  curioso: '',
  antojadizo: '',
  fanatico: '1.2x puntos por compra',
  snack_lover: '1.5x puntos por compra',
  leyenda: '1.5x puntos por compra',
}

const NEXT_TIER_LABELS: Record<string, string> = {
  antojadizo: 'Antojadizo',
  fanatico: 'Fanático',
  snack_lover: 'Snack Lover',
  leyenda: 'Leyenda',
}

interface LoyaltyTierCardProps {
  lifetimePoints: number
  balance: number
  variant: 'compact' | 'expanded'
  onClick?: () => void
}

export function LoyaltyTierCard({ lifetimePoints, balance, variant, onClick }: LoyaltyTierCardProps) {
  const progress = tierProgress(lifetimePoints)
  const multiplierLabel = TIER_MULTIPLIER_LABEL[progress.tier]

  const TierIcon = TIER_ICONS[progress.tier] ?? Sprout
  const iconStyle = TIER_ICON_STYLES[progress.tier] ?? TIER_ICON_STYLES.curioso

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left bg-gray-50 rounded-2xl p-3 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconStyle}`}>
              <TierIcon className="w-4 h-4" />
            </div>
            <LoyaltyTierBadge tier={progress.tier} />
          </div>
          <span className="text-xs font-bold text-gray-900">{balance} pts</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-nurei-cta"
            initial={{ width: 0 }}
            animate={{ width: `${progress.progressPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        {progress.nextTier && (
          <p className="mt-1 text-[11px] text-gray-400 font-bold">
            {progress.pointsToNext} pts para {NEXT_TIER_LABELS[progress.nextTier]}
          </p>
        )}
      </button>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconStyle}`}>
            <TierIcon className="w-5 h-5" />
          </div>
          <LoyaltyTierBadge tier={progress.tier} />
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-gray-900">{balance}</p>
          <p className="text-[11px] text-gray-400 font-bold">puntos disponibles</p>
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-nurei-cta"
          initial={{ width: 0 }}
          animate={{ width: `${progress.progressPct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-gray-400 font-bold">
          {progress.nextTier
            ? `${progress.pointsToNext} pts para ${NEXT_TIER_LABELS[progress.nextTier]}`
            : 'Nivel máximo alcanzado'}
        </span>
        {multiplierLabel && (
          <span className="text-nurei-cta font-bold">{multiplierLabel}</span>
        )}
      </div>
    </div>
  )
}
