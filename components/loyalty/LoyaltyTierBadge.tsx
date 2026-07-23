import { Badge } from '@/components/ui/badge'

export const TIER_LABELS: Record<string, string> = {
  curioso: 'Curioso',
  antojadizo: 'Antojadizo',
  fanatico: 'Fanático',
  snack_lover: 'Snack Lover',
  leyenda: 'Leyenda',
}

const TIER_STYLES: Record<string, string> = {
  curioso: 'bg-muted text-muted-foreground',
  antojadizo: 'bg-amber-100 text-amber-800',
  fanatico: 'bg-orange-100 text-orange-800',
  snack_lover: 'bg-rose-100 text-rose-800',
  leyenda: 'bg-violet-100 text-violet-800',
}

export function LoyaltyTierBadge({ tier }: { tier: string }) {
  const label = TIER_LABELS[tier] ?? tier
  const style = TIER_STYLES[tier] ?? TIER_STYLES.curioso
  return <Badge className={style}>{label}</Badge>
}
