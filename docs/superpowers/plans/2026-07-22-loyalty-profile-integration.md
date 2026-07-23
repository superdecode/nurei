# Loyalty Profile Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the loyalty program's user-facing surface from a floating gift-icon widget into a proper "Lealtad" tab inside `/perfil`, with a clickable tier+progress card visible at the top of the account page.

**Architecture:** Pure UI reorganization — no backend/RPC/schema changes. Extracts the existing tier threshold table into a client-safe shared module (it currently lives under `lib/server/`, which this repo reserves for server-only code), builds two small presentational components, extends the existing `/perfil` tab system (which already has an established `TABS`/`activeTab` pattern), and removes the floating widget.

**Tech Stack:** Next.js 16 (App Router, TypeScript), Zustand (`useLoyaltyStore`, already built), Tailwind, `lucide-react`, `framer-motion` (already used throughout `/perfil`).

## Global Constraints

- No backend changes: reuse `useLoyaltyStore` (`lib/stores/loyaltyStore.ts`) and `GET /api/loyalty/status` exactly as they exist today — do not modify either.
- Tier names/order (unchanged from the shipped feature): `curioso` (Curioso), `antojadizo` (Antojadizo), `fanatico` (Fanático), `snack_lover` (Snack Lover), `leyenda` (Leyenda), with `minPoints` 0/1000/2500/6500/17500 respectively — copied verbatim from `lib/server/loyalty/points.ts`'s `TIER_CONFIG`.
- Follow `/perfil`'s established visual language exactly: white/`bg-gray-50` cards, `rounded-2xl`, `bg-nurei-cta` yellow accent, `text-gray-900`/`text-gray-400` type scale, `framer-motion` for tab-switch transitions (see `TabCupones`, lines ~826-969 of `app/(public)/perfil/page.tsx`, as the reference pattern to match).
- Existing behavior of `/perfil` (tabs, query-param deep-linking via `?tab=`, header quick-stats, skeleton loading state) must keep working unchanged for the 4 existing tabs — this is an additive extension, not a rewrite.
- `GamificationWheel` (cart-triggered wheel modal) is explicitly out of scope — stays mounted in `app/(public)/layout.tsx` exactly as-is.
- Tier-up coupons are NOT duplicated in the new Lealtad tab — they already surface via the existing Cupones tab (`user_coupons`) and this plan does not touch that.

---

## File Structure

```
lib/loyalty/
  tiers.ts                    # NEW — client-safe tier table + progress calculation,
                              # extracted from lib/server/loyalty/points.ts

lib/server/loyalty/
  points.ts                   # MODIFY — re-export TIER_CONFIG/tierForLifetimePoints from
                              # lib/loyalty/tiers instead of defining them locally

components/loyalty/
  LoyaltyTierCard.tsx          # NEW — tier badge + progress bar, compact/expanded variants
  LoyaltyHistoryList.tsx       # NEW — ledger history list, TabCupones-style cards
  LoyaltyWidget.tsx            # DELETE — replaced by the profile integration
  LoyaltyTierBadge.tsx         # UNCHANGED — still used internally by LoyaltyTierCard

app/(public)/
  layout.tsx                  # MODIFY — remove <LoyaltyWidget /> mount
  perfil/page.tsx             # MODIFY — new 'lealtad' TabId, TABS entry, header tier card,
                              # TabLealtad() function
```

---

### Task 1: Extract tier config to a client-safe shared module

**Files:**
- Create: `lib/loyalty/tiers.ts`
- Modify: `lib/server/loyalty/points.ts:1-17`
- Test: `__tests__/loyalty/points.test.ts` (existing — must keep passing unmodified)

**Interfaces:**
- Produces: `TIER_CONFIG` (same shape/values as before: `{ tier: string; minPoints: number; multiplier: number }[]`, `as const`).
- Produces: `tierForLifetimePoints(lifetimePoints: number): string` (identical behavior to the current implementation).
- Produces: `tierProgress(lifetimePoints: number): { tier: string; nextTier: string | null; currentMin: number; nextMin: number | null; pointsToNext: number | null; progressPct: number }` — consumed by `LoyaltyTierCard` (Task 2).
- Consumed by: `lib/server/loyalty/points.ts` (re-exports, unchanged public surface for existing importers: `lib/server/loyalty/engine.ts`, `__tests__/loyalty/points.test.ts`, `app/api/orders/create/route.ts`).

- [ ] **Step 1: Write the failing test for `tierProgress`**

Add to `__tests__/loyalty/points.test.ts` (new `describe` block, keep all existing tests untouched):

```typescript
import { tierProgress } from '../../lib/loyalty/tiers'

describe('tierProgress', () => {
  it('reports progress within the first tier', () => {
    const result = tierProgress(500)
    expect(result).toEqual({
      tier: 'curioso',
      nextTier: 'antojadizo',
      currentMin: 0,
      nextMin: 1000,
      pointsToNext: 500,
      progressPct: 50,
    })
  })

  it('reports 0% right at a tier boundary', () => {
    const result = tierProgress(1000)
    expect(result.tier).toBe('antojadizo')
    expect(result.pointsToNext).toBe(1500)
    expect(result.progressPct).toBe(0)
  })

  it('reports progress in the last tier before the cap', () => {
    const result = tierProgress(6500)
    expect(result.tier).toBe('snack_lover')
    expect(result.nextTier).toBe('leyenda')
    expect(result.pointsToNext).toBe(11000)
    expect(result.progressPct).toBe(0)
  })

  it('reports 100% progress and no next tier at the max tier', () => {
    const result = tierProgress(20000)
    expect(result.tier).toBe('leyenda')
    expect(result.nextTier).toBeNull()
    expect(result.nextMin).toBeNull()
    expect(result.pointsToNext).toBeNull()
    expect(result.progressPct).toBe(100)
  })

  it('floors progressPct to an integer', () => {
    const result = tierProgress(1333)
    // antojadizo: 1000-2499, span 1500, progress = 333/1500 = 22.2%
    expect(result.progressPct).toBe(22)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/loyalty/points.test.ts -t "tierProgress"`
Expected: FAIL with "Cannot find module '../../lib/loyalty/tiers'"

- [ ] **Step 3: Create `lib/loyalty/tiers.ts`**

```typescript
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
```

- [ ] **Step 4: Update `lib/server/loyalty/points.ts` to re-export instead of duplicate**

Replace lines 1-17 of `lib/server/loyalty/points.ts` (the `TIER_CONFIG` const and `tierForLifetimePoints` function) with:

```typescript
export { TIER_CONFIG, tierForLifetimePoints } from '@/lib/loyalty/tiers'
```

Leave everything below (`pointsEarnedForPurchase`, `redemptionDiscountCents`, `validateRedemptionAmount`) untouched, exactly as it is today.

- [ ] **Step 5: Run the full existing test file to confirm nothing broke**

Run: `npx vitest run __tests__/loyalty/points.test.ts`
Expected: PASS — all pre-existing tests (tierForLifetimePoints, pointsEarnedForPurchase, redemptionDiscountCents, validateRedemptionAmount) plus the 5 new `tierProgress` tests, all green.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (confirms `lib/server/loyalty/engine.ts` and `app/api/orders/create/route.ts`, which import from `lib/server/loyalty/points`, still resolve correctly through the re-export).

- [ ] **Step 7: Commit**

```bash
git add lib/loyalty/tiers.ts lib/server/loyalty/points.ts __tests__/loyalty/points.test.ts
git commit -m "refactor: extract loyalty tier config to a client-safe shared module"
```

---

### Task 2: `LoyaltyTierCard` component

**Files:**
- Create: `components/loyalty/LoyaltyTierCard.tsx`

**Interfaces:**
- Consumes: `tierProgress` (Task 1, `@/lib/loyalty/tiers`), `LoyaltyTierBadge` (existing, unchanged).
- Produces: `<LoyaltyTierCard lifetimePoints={number} balance={number} variant="compact" | "expanded" onClick={() => void}>` — consumed by `app/(public)/perfil/page.tsx` (Task 4), in the header (`variant="compact"`) and inside the Lealtad tab (`variant="expanded"`).

- [ ] **Step 1: Write the component**

```typescript
'use client'

import { tierProgress } from '@/lib/loyalty/tiers'
import { LoyaltyTierBadge } from './LoyaltyTierBadge'

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

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left bg-gray-50 rounded-2xl p-3 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center justify-between mb-1.5">
          <LoyaltyTierBadge tier={progress.tier} />
          <span className="text-xs font-bold text-gray-900">{balance} pts</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-nurei-cta transition-all"
            style={{ width: `${progress.progressPct}%` }}
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
        <LoyaltyTierBadge tier={progress.tier} />
        <div className="text-right">
          <p className="text-2xl font-black text-gray-900">{balance}</p>
          <p className="text-[11px] text-gray-400 font-bold">puntos disponibles</p>
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-nurei-cta transition-all"
          style={{ width: `${progress.progressPct}%` }}
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/loyalty/LoyaltyTierCard.tsx
git commit -m "feat: add LoyaltyTierCard with compact and expanded variants"
```

---

### Task 3: `LoyaltyHistoryList` component

**Files:**
- Create: `components/loyalty/LoyaltyHistoryList.tsx`

**Interfaces:**
- Consumes: `LoyaltyLedgerEntry` type (existing, exported from `lib/stores/loyaltyStore.ts`).
- Produces: `<LoyaltyHistoryList history={LoyaltyLedgerEntry[]} />` — consumed by `app/(public)/perfil/page.tsx`'s `TabLealtad()` (Task 4).

- [ ] **Step 1: Write the component**

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/loyalty/LoyaltyHistoryList.tsx
git commit -m "feat: add LoyaltyHistoryList component"
```

---

### Task 4: Integrate into `/perfil` — new tab, header card, tab content

**Files:**
- Modify: `app/(public)/perfil/page.tsx`

**Interfaces:**
- Consumes: `useLoyaltyStore` (existing), `LoyaltyTierCard` (Task 2), `LoyaltyHistoryList` (Task 3).

- [ ] **Step 1: Add the `useLoyaltyStore` import and the new icon import**

At the top imports, add `Award` to the existing `lucide-react` import list (alongside `User, Mail, Phone, ...`), and add:

```typescript
import { useLoyaltyStore } from '@/lib/stores/loyaltyStore'
import { LoyaltyTierCard } from '@/components/loyalty/LoyaltyTierCard'
import { LoyaltyHistoryList } from '@/components/loyalty/LoyaltyHistoryList'
```

- [ ] **Step 2: Extend `TabId` and `TABS`**

Change:
```typescript
type TabId = 'pedidos' | 'cupones' | 'direcciones' | 'cuenta'
```
to:
```typescript
type TabId = 'pedidos' | 'cupones' | 'direcciones' | 'lealtad' | 'cuenta'
```

Add a new entry to `TABS` (position it after `cupones`, before `direcciones` — reward-adjacent tabs grouped together):
```typescript
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'pedidos', label: 'Pedidos', icon: <Package className="w-4 h-4" /> },
  { id: 'cupones', label: 'Cupones', icon: <Ticket className="w-4 h-4" /> },
  { id: 'lealtad', label: 'Lealtad', icon: <Award className="w-4 h-4" /> },
  { id: 'direcciones', label: 'Direcciones', icon: <MapPin className="w-4 h-4" /> },
  { id: 'cuenta', label: 'Cuenta', icon: <User className="w-4 h-4" /> },
]
```

- [ ] **Step 3: Update the query-param tab guard**

Find:
```typescript
      if (tab === 'pedidos' || tab === 'cupones' || tab === 'direcciones' || tab === 'cuenta') {
```
Change to:
```typescript
      if (tab === 'pedidos' || tab === 'cupones' || tab === 'lealtad' || tab === 'direcciones' || tab === 'cuenta') {
```

- [ ] **Step 4: Fetch loyalty status alongside the other profile data**

In `PerfilPageContent`, add the store hook near the other hooks (alongside `useFavoritesStore`):
```typescript
  const { balance, lifetimePoints, loaded: loyaltyLoaded, fetchStatus: fetchLoyaltyStatus, history: loyaltyHistory } = useLoyaltyStore()
```

In the existing `useEffect` that runs `refreshUser()`, `loadAddresses()`, `loadOrders()` on mount (the one gated by `if (!isAuthenticated) { router.push('/login'); return }`), add `fetchLoyaltyStatus()` to the same `queueMicrotask` block:
```typescript
    queueMicrotask(() => {
      refreshUser()
      loadAddresses()
      loadOrders()
      fetchLoyaltyStatus()
      fetchWithCredentials('/api/profile/coupons')
        // ...unchanged...
    })
```
Add `fetchLoyaltyStatus` to that `useEffect`'s dependency array alongside the other functions already listed there.

- [ ] **Step 5: Add the header tier card**

In the JSX, inside the "Quick stats" block (the `{showAccountSummary && (...)}` section that currently renders the 2-column Pedidos/Favoritos grid), add the compact tier card ABOVE that grid, inside the same conditional:

```tsx
          {showAccountSummary && (
          <>
          <div className="mt-5">
            <LoyaltyTierCard
              lifetimePoints={lifetimePoints}
              balance={balance}
              variant="compact"
              onClick={() => setActiveTab('lealtad')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-gray-50 rounded-2xl p-3 text-center">
              <p className="text-xl font-black text-gray-900">{orders.length}</p>
              <p className="text-[11px] text-gray-400 font-bold mt-0.5">Pedidos</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 text-center">
              <Link href="/favoritos" className="block">
                <p className="text-xl font-black text-gray-900">{favCount}</p>
                <p className="text-[11px] text-gray-400 font-bold mt-0.5">Favoritos</p>
              </Link>
            </div>
          </div>
          </>
          )}
```

(This replaces the existing `<div className="grid grid-cols-2 gap-3 mt-5">...</div>` block — same two stat tiles, unchanged content, just wrapped in a fragment alongside the new tier card and with the grid's top margin changed from `mt-5` to `mt-3` since the tier card above it now carries the `mt-5` spacing from the header.)

- [ ] **Step 6: Add the `TabLealtad` function**

Add this new function in the same style/location as the existing `TabCupones`/`TabDirecciones` functions (before the "Main Profile Page" section comment):

```typescript
// ─── Tab: Lealtad ───────────────────────────────────────────────────────────

function TabLealtad({ lifetimePoints, balance, history }: {
  lifetimePoints: number
  balance: number
  history: LoyaltyLedgerEntry[]
}) {
  return (
    <div className="space-y-6">
      <LoyaltyTierCard lifetimePoints={lifetimePoints} balance={balance} variant="expanded" />

      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
          Historial de movimientos
        </h3>
        <LoyaltyHistoryList history={history} />
      </div>
    </div>
  )
}
```

Add the `LoyaltyLedgerEntry` type to the existing type-only import from `lib/stores/loyaltyStore`:
```typescript
import { useLoyaltyStore, type LoyaltyLedgerEntry } from '@/lib/stores/loyaltyStore'
```
(replacing the plain `import { useLoyaltyStore } from '@/lib/stores/loyaltyStore'` added in Step 1 — use this combined form instead).

- [ ] **Step 7: Render the new tab content**

Find:
```typescript
            {activeTab === 'cupones' && <TabCupones />}
            {activeTab === 'direcciones' && <TabDirecciones />}
```
Change to:
```typescript
            {activeTab === 'cupones' && <TabCupones />}
            {activeTab === 'lealtad' && (
              <TabLealtad lifetimePoints={lifetimePoints} balance={balance} history={loyaltyHistory} />
            )}
            {activeTab === 'direcciones' && <TabDirecciones />}
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Manual verification**

Run `npm run dev`, log in, go to `/perfil`:
- Confirm the compact tier card renders in the header (between avatar and Pedidos/Favoritos stats), shows a tier badge, a progress bar, and points-to-next-tier text (or "Nivel máximo alcanzado" if at Leyenda).
- Click it — confirm it switches to the "Lealtad" tab (the tab bar's active-tab underline should move to Lealtad, and the expanded tier card + history list render below).
- Confirm the "Lealtad" tab also appears directly in the tab bar and is independently clickable.
- Confirm `/perfil?tab=lealtad` deep-links directly into the tab on page load.
- Confirm the other 4 tabs (Pedidos, Cupones, Direcciones, Cuenta) still work exactly as before.

- [ ] **Step 10: Commit**

```bash
git add "app/(public)/perfil/page.tsx"
git commit -m "feat: integrate loyalty tier card and history into the profile page"
```

---

### Task 5: Remove the floating widget

**Files:**
- Modify: `app/(public)/layout.tsx`
- Delete: `components/loyalty/LoyaltyWidget.tsx`

**Interfaces:**
- Removes the last remaining reference to `LoyaltyWidget` (confirmed via `grep -rl "LoyaltyWidget"` returning only `app/(public)/layout.tsx` and `components/loyalty/LoyaltyWidget.tsx` itself, before this task).

- [ ] **Step 1: Remove the import and mount from the layout**

In `app/(public)/layout.tsx`, remove the line:
```typescript
import { LoyaltyWidget } from '@/components/loyalty/LoyaltyWidget'
```
and remove the line:
```tsx
        <LoyaltyWidget />
```
Leave `<GamificationWheel />` and its import exactly as they are — out of scope for this change.

- [ ] **Step 2: Delete the component file**

```bash
git rm components/loyalty/LoyaltyWidget.tsx
```

- [ ] **Step 3: Confirm no remaining references**

Run: `grep -rl "LoyaltyWidget" --include="*.tsx" --include="*.ts" . | grep -v node_modules`
Expected: no output (empty).

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors, build succeeds.

- [ ] **Step 5: Manual smoke test**

Run `npm run dev`, load any public page, confirm no floating gift-icon button appears anywhere, and the WhatsApp floating button renders normally with no leftover spacing/collision artifacts from the removed widget.

- [ ] **Step 6: Commit**

```bash
git add "app/(public)/layout.tsx"
git commit -m "feat: remove floating loyalty widget in favor of the profile integration"
```

---

## Self-Review Notes

- **Spec coverage:** tier extraction to client-safe module (Task 1), compact clickable header card (Task 2 + Task 4 Step 5), new Lealtad tab with expanded tier card + history (Task 2/3 + Task 4 Steps 6-7), floating widget removal (Task 5) — all covered. `GamificationWheel` and tier-up coupons explicitly untouched per spec's out-of-scope list.
- **Type consistency:** `tierProgress`'s return shape is used identically by both `LoyaltyTierCard` variants; `LoyaltyLedgerEntry` is imported from its single source of truth (`lib/stores/loyaltyStore.ts`) in both `LoyaltyHistoryList` and the modified `perfil/page.tsx`, not redefined.
- **No placeholders:** every step has complete, ready-to-use code.
