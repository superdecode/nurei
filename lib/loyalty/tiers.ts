export const TIER_CONFIG = [
  { tier: 'curioso', minPoints: 0, multiplier: 1.0 },
  { tier: 'antojadizo', minPoints: 1000, multiplier: 1.0 },
  { tier: 'fanatico', minPoints: 2500, multiplier: 1.2 },
  { tier: 'snack_lover', minPoints: 6500, multiplier: 1.5 },
  { tier: 'leyenda', minPoints: 17500, multiplier: 1.5 },
] as const

export function tierForLifetimePoints(lifetimePoints: number): string {
  let result = TIER_CONFIG[0].tier as string
  for (const entry of TIER_CONFIG) {
    if (lifetimePoints >= entry.minPoints) {
      result = entry.tier
    }
  }
  return result
}

export interface TierProgress {
  tier: string
  nextTier: string | null
  currentMin: number
  nextMin: number | null
  pointsToNext: number | null
  progressPct: number
}

/** Progress toward the next tier, for progress-bar UI. 100% / null nextTier at the max tier. */
export function tierProgress(lifetimePoints: number): TierProgress {
  let currentIndex = 0
  for (let i = 0; i < TIER_CONFIG.length; i++) {
    if (lifetimePoints >= TIER_CONFIG[i].minPoints) currentIndex = i
  }

  const current = TIER_CONFIG[currentIndex]
  const next = TIER_CONFIG[currentIndex + 1] ?? null

  if (!next) {
    return {
      tier: current.tier,
      nextTier: null,
      currentMin: current.minPoints,
      nextMin: null,
      pointsToNext: null,
      progressPct: 100,
    }
  }

  const span = next.minPoints - current.minPoints
  const into = lifetimePoints - current.minPoints
  const progressPct = Math.floor(Math.max(0, Math.min(100, (into / span) * 100)))

  return {
    tier: current.tier,
    nextTier: next.tier,
    currentMin: current.minPoints,
    nextMin: next.minPoints,
    pointsToNext: next.minPoints - lifetimePoints,
    progressPct,
  }
}
