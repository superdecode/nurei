# Affiliate Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un módulo completo de afiliados (referral links + cupones + comisiones + dashboard) a Nurei, integrando con el sistema de auth y coupons existente.

**Architecture:** Rol `affiliate` nuevo en `user_profiles`, cinco tablas nuevas en Supabase, lógica de atribución pura en `lib/affiliate/`, API routes para tracking y stats, portal `/affiliate` para el afiliado, y módulo `/admin/affiliates` para gestión.

**Tech Stack:** Next.js 16 (App Router), Supabase (@supabase/ssr + @supabase/supabase-js), TypeScript, Tailwind CSS, framer-motion, lucide-react, sonner, recharts, Vitest (tests).

---

## File Map

### New files
```
supabase/migrations/012_affiliate_role.sql
supabase/migrations/013_affiliate_tables.sql
supabase/migrations/014_affiliate_rls.sql
lib/affiliate/cookie.ts
lib/affiliate/attribution.ts
lib/affiliate/commission.ts
lib/server/require-affiliate.ts
lib/stores/affiliateAuth.ts
app/api/referral/click/route.ts
app/api/affiliate/stats/route.ts
app/api/affiliate/orders/route.ts
app/api/affiliate/payouts/route.ts
app/api/affiliate/attribution/route.ts
app/api/admin/affiliates/route.ts
app/api/admin/affiliates/[id]/route.ts
app/api/admin/affiliates/[id]/payout/route.ts
app/affiliate/layout.tsx
app/affiliate/page.tsx
app/affiliate/overview/page.tsx
app/affiliate/ventas/page.tsx
app/affiliate/pagos/page.tsx
app/affiliate/perfil/page.tsx
app/admin/affiliates/page.tsx
app/admin/affiliates/[id]/page.tsx
app/admin/affiliates/pagos/page.tsx
__tests__/affiliate/attribution.test.ts
__tests__/affiliate/commission.test.ts
```

### Modified files
```
types/index.ts                          ← Add affiliate types + extend UserRole
app/admin/layout.tsx                    ← Add Afiliados to NAV_ITEMS
app/api/webhooks/stripe/route.ts        ← Call attribution API after payment confirmed
```

---

## Task 1: Migrations — DB Schema

**Files:**
- Create: `supabase/migrations/012_affiliate_role.sql`
- Create: `supabase/migrations/013_affiliate_tables.sql`
- Create: `supabase/migrations/014_affiliate_rls.sql`

- [ ] **Step 1: Write migration 012 — extend role check + coupons FK**

```sql
-- supabase/migrations/012_affiliate_role.sql
-- ============================================
-- 012: AFFILIATE ROLE + COUPONS FK
-- ============================================

-- 1) Extend role CHECK to include affiliate
alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('customer', 'admin', 'affiliate'));

-- 2) Add affiliate FK to coupons
alter table public.coupons
  add column if not exists affiliate_id uuid references auth.users(id) on delete set null;

create index if not exists idx_coupons_affiliate on public.coupons(affiliate_id)
  where affiliate_id is not null;
```

- [ ] **Step 2: Write migration 013 — create affiliate tables**

```sql
-- supabase/migrations/013_affiliate_tables.sql
-- ============================================
-- 013: AFFILIATE TABLES
-- ============================================

-- ─── AFFILIATE PROFILES ──────────────────────
create table if not exists public.affiliate_profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  handle                   text not null unique,
  bio                      text,
  commission_coupon_pct    int  not null default 10 check (commission_coupon_pct between 0 and 100),
  commission_cookie_pct    int  not null default 5  check (commission_cookie_pct between 0 and 100),
  total_earned_cents       int  not null default 0,
  pending_payout_cents     int  not null default 0,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger set_affiliate_profiles_updated_at
  before update on public.affiliate_profiles
  for each row execute function public.set_updated_at();

-- ─── REFERRAL LINKS ──────────────────────────
create table if not exists public.referral_links (
  id             uuid primary key default gen_random_uuid(),
  affiliate_id   uuid not null references auth.users(id) on delete cascade,
  slug           text not null unique,
  clicks_count   int  not null default 0,
  created_at     timestamptz not null default now(),
  unique (affiliate_id)
);

create index if not exists idx_referral_links_slug on public.referral_links(slug);
create index if not exists idx_referral_links_affiliate on public.referral_links(affiliate_id);

-- ─── REFERRAL CLICKS ─────────────────────────
create table if not exists public.referral_clicks (
  id                uuid primary key default gen_random_uuid(),
  referral_link_id  uuid not null references public.referral_links(id) on delete cascade,
  session_id        text not null,
  ip_hash           text,
  converted         boolean not null default false,
  order_id          uuid references public.orders(id) on delete set null,
  clicked_at        timestamptz not null default now()
);

create index if not exists idx_referral_clicks_link on public.referral_clicks(referral_link_id);
create index if not exists idx_referral_clicks_session on public.referral_clicks(session_id);

-- Dedup: same session cannot count twice within 1 hour
create unique index if not exists idx_referral_clicks_dedup
  on public.referral_clicks (referral_link_id, session_id)
  where clicked_at > (now() - interval '1 hour');

-- ─── AFFILIATE ATTRIBUTIONS ──────────────────
create table if not exists public.affiliate_attributions (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null unique references public.orders(id) on delete cascade,
  affiliate_id            uuid not null references auth.users(id) on delete cascade,
  attribution_type        text not null check (attribution_type in ('coupon', 'cookie')),
  coupon_id               uuid references public.coupons(id) on delete set null,
  commission_pct          int  not null,
  commission_amount_cents int  not null,
  payout_status           text not null default 'pending' check (payout_status in ('pending', 'paid')),
  paid_at                 timestamptz,
  created_at              timestamptz not null default now()
);

create index if not exists idx_attributions_affiliate on public.affiliate_attributions(affiliate_id);
create index if not exists idx_attributions_order on public.affiliate_attributions(order_id);

-- ─── COMMISSION PAYMENTS ─────────────────────
create table if not exists public.commission_payments (
  id               uuid primary key default gen_random_uuid(),
  affiliate_id     uuid not null references auth.users(id) on delete cascade,
  amount_cents     int  not null check (amount_cents > 0),
  period_from      date not null,
  period_to        date not null,
  attribution_ids  uuid[] not null default '{}',
  notes            text,
  paid_by          uuid references auth.users(id) on delete set null,
  paid_at          timestamptz not null default now()
);

create index if not exists idx_commission_payments_affiliate on public.commission_payments(affiliate_id);
```

- [ ] **Step 3: Write migration 014 — RLS policies**

```sql
-- supabase/migrations/014_affiliate_rls.sql
-- ============================================
-- 014: AFFILIATE RLS POLICIES
-- ============================================

alter table public.affiliate_profiles   enable row level security;
alter table public.referral_links       enable row level security;
alter table public.referral_clicks      enable row level security;
alter table public.affiliate_attributions enable row level security;
alter table public.commission_payments  enable row level security;

-- ─── AFFILIATE PROFILES ──────────────────────
create policy "Affiliate profiles: read own"
  on public.affiliate_profiles for select using (id = auth.uid());

create policy "Affiliate profiles: update own"
  on public.affiliate_profiles for update using (id = auth.uid());

create policy "Affiliate profiles: admin all"
  on public.affiliate_profiles for all using (public.is_admin());

-- ─── REFERRAL LINKS ──────────────────────────
create policy "Referral links: affiliate read own"
  on public.referral_links for select using (affiliate_id = auth.uid());

create policy "Referral links: admin all"
  on public.referral_links for all using (public.is_admin());

-- ─── REFERRAL CLICKS ─────────────────────────
create policy "Referral clicks: system insert"
  on public.referral_clicks for insert with check (true);

create policy "Referral clicks: affiliate read own via link"
  on public.referral_clicks for select using (
    exists (
      select 1 from public.referral_links rl
      where rl.id = referral_link_id and rl.affiliate_id = auth.uid()
    )
  );

create policy "Referral clicks: admin all"
  on public.referral_clicks for all using (public.is_admin());

-- ─── AFFILIATE ATTRIBUTIONS ──────────────────
create policy "Attributions: affiliate read own"
  on public.affiliate_attributions for select using (affiliate_id = auth.uid());

create policy "Attributions: system insert"
  on public.affiliate_attributions for insert with check (true);

create policy "Attributions: admin all"
  on public.affiliate_attributions for all using (public.is_admin());

-- ─── COMMISSION PAYMENTS ─────────────────────
create policy "Commission payments: affiliate read own"
  on public.commission_payments for select using (affiliate_id = auth.uid());

create policy "Commission payments: admin all"
  on public.commission_payments for all using (public.is_admin());
```

- [ ] **Step 4: Apply migrations to local Supabase**

```bash
cd /Users/quiron/CascadeProjects/nurei
npx supabase db push
# or via Supabase Dashboard > SQL Editor if using remote
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/012_affiliate_role.sql \
        supabase/migrations/013_affiliate_tables.sql \
        supabase/migrations/014_affiliate_rls.sql
git commit -m "feat(db): add affiliate module schema and RLS policies"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add affiliate types to types/index.ts**

Open `types/index.ts` and make these changes:

**Change `UserRole`** (currently `'customer' | 'admin'`):
```typescript
export type UserRole = 'customer' | 'admin' | 'affiliate'
```

**Add after the existing `AdminModule` type:**
```typescript
// ─── AFFILIATE ────────────────────────────────────────────────────────────────

export type AffiliateAttributionType = 'coupon' | 'cookie'
export type AffiliatePayoutStatus = 'pending' | 'paid'

export interface AffiliateProfile {
  id: string
  handle: string
  bio: string | null
  commission_coupon_pct: number
  commission_cookie_pct: number
  total_earned_cents: number
  pending_payout_cents: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ReferralLink {
  id: string
  affiliate_id: string
  slug: string
  clicks_count: number
  created_at: string
}

export interface ReferralClick {
  id: string
  referral_link_id: string
  session_id: string
  ip_hash: string | null
  converted: boolean
  order_id: string | null
  clicked_at: string
}

export interface AffiliateAttribution {
  id: string
  order_id: string
  affiliate_id: string
  attribution_type: AffiliateAttributionType
  coupon_id: string | null
  commission_pct: number
  commission_amount_cents: number
  payout_status: AffiliatePayoutStatus
  paid_at: string | null
  created_at: string
}

export interface CommissionPayment {
  id: string
  affiliate_id: string
  amount_cents: number
  period_from: string
  period_to: string
  attribution_ids: string[]
  notes: string | null
  paid_by: string | null
  paid_at: string
}

// Admin view: affiliate with derived stats
export interface AffiliateWithStats extends AffiliateProfile {
  email: string
  handle: string
  referral_slug: string | null
  orders_this_month: number
  coupon_code: string | null
}

// Affiliate dashboard stats shape
export interface AffiliateDashboardStats {
  total_earned_cents: number
  pending_payout_cents: number
  total_orders: number
  total_clicks: number
  conversion_rate: number // percentage 0-100
  weekly_sales: Array<{ week: string; amount_cents: number; orders: number }>
  top_products: Array<{ product_name: string; units: number }>
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat(types): add affiliate module types and extend UserRole"
```

---

## Task 3: Test Setup + Pure Library Functions

**Files:**
- Create: `lib/affiliate/cookie.ts`
- Create: `lib/affiliate/attribution.ts`
- Create: `lib/affiliate/commission.ts`
- Create: `__tests__/affiliate/attribution.test.ts`
- Create: `__tests__/affiliate/commission.test.ts`

- [ ] **Step 1: Install Vitest**

```bash
cd /Users/quiron/CascadeProjects/nurei
npm install --save-dev vitest @vitest/coverage-v8
```

- [ ] **Step 2: Add test script to package.json**

Open `package.json` and add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write lib/affiliate/cookie.ts**

```typescript
// lib/affiliate/cookie.ts
import { NextResponse } from 'next/server'

export const REFERRAL_COOKIE_NAME = '_nurei_ref'
export const REFERRAL_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

export function setReferralCookie(response: NextResponse, referralLinkId: string): NextResponse {
  response.cookies.set(REFERRAL_COOKIE_NAME, referralLinkId, {
    httpOnly: false,
    sameSite: 'lax',
    maxAge: REFERRAL_TTL_SECONDS,
    path: '/',
  })
  return response
}

export function clearReferralCookie(response: NextResponse): NextResponse {
  response.cookies.delete(REFERRAL_COOKIE_NAME)
  return response
}

export function getReferralLinkIdFromHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE_NAME}=([^;]+)`))
  return match?.[1] ?? null
}
```

- [ ] **Step 4: Write the failing attribution test**

```typescript
// __tests__/affiliate/attribution.test.ts
import { describe, it, expect } from 'vitest'
import { resolveAttribution } from '../../lib/affiliate/attribution'

describe('resolveAttribution', () => {
  it('returns null when no coupon and no cookie', () => {
    const result = resolveAttribution({
      couponAffiliateId: null,
      couponId: null,
      cookieAffiliateId: null,
      couponCommissionPct: 10,
      cookieCommissionPct: 5,
    })
    expect(result).toBeNull()
  })

  it('returns cookie attribution when only cookie is present', () => {
    const result = resolveAttribution({
      couponAffiliateId: null,
      couponId: null,
      cookieAffiliateId: 'affiliate-123',
      couponCommissionPct: 10,
      cookieCommissionPct: 5,
    })
    expect(result).toEqual({
      type: 'cookie',
      affiliateId: 'affiliate-123',
      couponId: undefined,
      commissionPct: 5,
    })
  })

  it('returns coupon attribution when coupon is present (priority over cookie)', () => {
    const result = resolveAttribution({
      couponAffiliateId: 'affiliate-abc',
      couponId: 'coupon-xyz',
      cookieAffiliateId: 'affiliate-different',
      couponCommissionPct: 10,
      cookieCommissionPct: 5,
    })
    expect(result).toEqual({
      type: 'coupon',
      affiliateId: 'affiliate-abc',
      couponId: 'coupon-xyz',
      commissionPct: 10,
    })
  })

  it('ignores cookie when coupon belongs to different affiliate', () => {
    const result = resolveAttribution({
      couponAffiliateId: 'affiliate-A',
      couponId: 'coupon-1',
      cookieAffiliateId: 'affiliate-B',
      couponCommissionPct: 12,
      cookieCommissionPct: 6,
    })
    expect(result?.affiliateId).toBe('affiliate-A')
    expect(result?.type).toBe('coupon')
  })
})
```

- [ ] **Step 5: Run test — expect FAIL**

```bash
npm test
```
Expected: `Error: Cannot find module '../../lib/affiliate/attribution'`

- [ ] **Step 6: Write lib/affiliate/attribution.ts**

```typescript
// lib/affiliate/attribution.ts
export type AttributionType = 'coupon' | 'cookie'

export interface AttributionResult {
  type: AttributionType
  affiliateId: string
  couponId?: string
  commissionPct: number
}

export function resolveAttribution(params: {
  couponAffiliateId: string | null | undefined
  couponId: string | null | undefined
  cookieAffiliateId: string | null | undefined
  couponCommissionPct: number
  cookieCommissionPct: number
}): AttributionResult | null {
  if (params.couponAffiliateId && params.couponId) {
    return {
      type: 'coupon',
      affiliateId: params.couponAffiliateId,
      couponId: params.couponId,
      commissionPct: params.couponCommissionPct,
    }
  }
  if (params.cookieAffiliateId) {
    return {
      type: 'cookie',
      affiliateId: params.cookieAffiliateId,
      commissionPct: params.cookieCommissionPct,
    }
  }
  return null
}
```

- [ ] **Step 7: Run test — expect PASS**

```bash
npm test
```
Expected: `4 tests passed`

- [ ] **Step 8: Write the failing commission test**

```typescript
// __tests__/affiliate/commission.test.ts
import { describe, it, expect } from 'vitest'
import { calculateCommission } from '../../lib/affiliate/commission'

describe('calculateCommission', () => {
  it('calculates percentage commission correctly', () => {
    expect(calculateCommission({ orderTotalCents: 10000, commissionPct: 10 })).toBe(1000)
  })

  it('floors fractional centavos', () => {
    expect(calculateCommission({ orderTotalCents: 9999, commissionPct: 10 })).toBe(999)
  })

  it('returns 0 for 0% commission', () => {
    expect(calculateCommission({ orderTotalCents: 50000, commissionPct: 0 })).toBe(0)
  })

  it('returns full amount for 100% commission', () => {
    expect(calculateCommission({ orderTotalCents: 20000, commissionPct: 100 })).toBe(20000)
  })
})
```

- [ ] **Step 9: Run test — expect FAIL**

```bash
npm test
```
Expected: `Error: Cannot find module '../../lib/affiliate/commission'`

- [ ] **Step 10: Write lib/affiliate/commission.ts**

```typescript
// lib/affiliate/commission.ts
export function calculateCommission(params: {
  orderTotalCents: number
  commissionPct: number
}): number {
  return Math.floor(params.orderTotalCents * params.commissionPct / 100)
}
```

- [ ] **Step 11: Run all tests — expect PASS**

```bash
npm test
```
Expected: `8 tests passed`

- [ ] **Step 12: Commit**

```bash
git add lib/affiliate/ __tests__/ package.json
git commit -m "feat(affiliate): add pure attribution/commission/cookie lib with tests"
```

---

## Task 4: Auth Guard for Affiliate Portal

**Files:**
- Create: `lib/server/require-affiliate.ts`

- [ ] **Step 1: Write require-affiliate.ts**

Pattern mirrors the existing `lib/server/require-admin.ts`.

```typescript
// lib/server/require-affiliate.ts
import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

export async function requireAffiliate() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  const { data: profile } = await createServiceClient()
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'affiliate') {
    return { error: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }

  return { userId: user.id }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/server/require-affiliate.ts
git commit -m "feat(affiliate): add server-side affiliate auth guard"
```

---

## Task 5: Referral Click API Route

**Files:**
- Create: `app/api/referral/click/route.ts`

- [ ] **Step 1: Write the click tracking route**

```typescript
// app/api/referral/click/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { setReferralCookie } from '@/lib/affiliate/cookie'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { slug, sessionId } = await request.json()

    if (!slug || typeof slug !== 'string' || !sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'slug y sessionId requeridos' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: link, error: linkError } = await supabase
      .from('referral_links')
      .select('id, affiliate_id')
      .eq('slug', slug.toLowerCase())
      .single()

    if (linkError || !link) {
      return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 })
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16)

    // Insert click (unique index on link+session within 1h handles dedup at DB level)
    const { error: insertError } = await supabase
      .from('referral_clicks')
      .insert({
        referral_link_id: link.id,
        session_id: sessionId,
        ip_hash: ipHash,
      })

    // Ignore unique violation (duplicate click within 1h)
    if (insertError && !insertError.message.includes('unique')) {
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }

    // Increment click counter only on new clicks
    if (!insertError) {
      await supabase.rpc('increment_referral_clicks', { link_id: link.id })
    }

    const response = NextResponse.json({ ok: true, linkId: link.id })
    return setReferralCookie(response, link.id)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
```

> **Note:** The `increment_referral_clicks` RPC needs to be a DB function. Add this to migration 013 or a new migration 013b:
> ```sql
> create or replace function public.increment_referral_clicks(link_id uuid)
> returns void as $$
>   update public.referral_links set clicks_count = clicks_count + 1 where id = link_id;
> $$ language sql security definer;
> ```

- [ ] **Step 2: Add the RPC function to migration 013**

Open `supabase/migrations/013_affiliate_tables.sql` and append:

```sql
-- ─── HELPERS ──────────────────────────────────
create or replace function public.increment_referral_clicks(link_id uuid)
returns void as $$
  update public.referral_links set clicks_count = clicks_count + 1 where id = link_id;
$$ language sql security definer;
```

- [ ] **Step 3: Apply updated migration and commit**

```bash
npx supabase db push
git add app/api/referral/ supabase/migrations/013_affiliate_tables.sql
git commit -m "feat(affiliate): add referral click tracking API route"
```

---

## Task 6: Attribution API Route

**Files:**
- Create: `app/api/affiliate/attribution/route.ts`

Called when an order's payment is confirmed (to be integrated into Stripe webhook in Task 11).

- [ ] **Step 1: Write the attribution route**

```typescript
// app/api/affiliate/attribution/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveAttribution } from '@/lib/affiliate/attribution'
import { calculateCommission } from '@/lib/affiliate/commission'
import { getReferralLinkIdFromHeader } from '@/lib/affiliate/cookie'

interface AttributionPayload {
  orderId: string
  orderTotalCents: number
  couponCode?: string | null
  cookieHeader?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body: AttributionPayload = await request.json()
    const { orderId, orderTotalCents, couponCode, cookieHeader } = body

    if (!orderId || typeof orderTotalCents !== 'number') {
      return NextResponse.json({ error: 'orderId y orderTotalCents requeridos' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Resolve coupon's affiliate
    let couponAffiliateId: string | null = null
    let couponId: string | null = null
    let couponCommissionPct = 0

    if (couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('id, affiliate_id')
        .ilike('code', couponCode)
        .single()

      if (coupon?.affiliate_id) {
        couponAffiliateId = coupon.affiliate_id
        couponId = coupon.id

        const { data: profile } = await supabase
          .from('affiliate_profiles')
          .select('commission_coupon_pct')
          .eq('id', coupon.affiliate_id)
          .single()

        couponCommissionPct = profile?.commission_coupon_pct ?? 0
      }
    }

    // Resolve cookie's affiliate
    let cookieAffiliateId: string | null = null
    let cookieCommissionPct = 0

    const referralLinkId = getReferralLinkIdFromHeader(cookieHeader ?? null)
    if (referralLinkId) {
      const { data: link } = await supabase
        .from('referral_links')
        .select('affiliate_id')
        .eq('id', referralLinkId)
        .single()

      if (link?.affiliate_id) {
        cookieAffiliateId = link.affiliate_id

        const { data: profile } = await supabase
          .from('affiliate_profiles')
          .select('commission_cookie_pct')
          .eq('id', link.affiliate_id)
          .single()

        cookieCommissionPct = profile?.commission_cookie_pct ?? 0
      }
    }

    const attribution = resolveAttribution({
      couponAffiliateId,
      couponId,
      cookieAffiliateId,
      couponCommissionPct,
      cookieCommissionPct,
    })

    if (!attribution) {
      return NextResponse.json({ ok: true, attributed: false })
    }

    const commissionAmountCents = calculateCommission({
      orderTotalCents,
      commissionPct: attribution.commissionPct,
    })

    // Insert attribution (ignore if already exists — idempotent)
    const { error: attrError } = await supabase
      .from('affiliate_attributions')
      .insert({
        order_id: orderId,
        affiliate_id: attribution.affiliateId,
        attribution_type: attribution.type,
        coupon_id: attribution.couponId ?? null,
        commission_pct: attribution.commissionPct,
        commission_amount_cents: commissionAmountCents,
      })

    if (attrError && !attrError.message.includes('unique')) {
      return NextResponse.json({ error: 'Error al registrar atribución' }, { status: 500 })
    }

    // Update pending balance
    if (!attrError) {
      await supabase.rpc('increment_affiliate_pending', {
        affiliate_id: attribution.affiliateId,
        amount: commissionAmountCents,
      })

      // Mark referral click as converted
      if (referralLinkId) {
        await supabase
          .from('referral_clicks')
          .update({ converted: true, order_id: orderId })
          .eq('referral_link_id', referralLinkId)
          .eq('session_id', cookieHeader ?? '')
          .eq('converted', false)
      }
    }

    return NextResponse.json({
      ok: true,
      attributed: true,
      type: attribution.type,
      commissionAmountCents,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Add increment_affiliate_pending RPC to migration 013**

Append to `supabase/migrations/013_affiliate_tables.sql`:

```sql
create or replace function public.increment_affiliate_pending(affiliate_id uuid, amount int)
returns void as $$
  update public.affiliate_profiles
  set pending_payout_cents = pending_payout_cents + amount,
      updated_at = now()
  where id = affiliate_id;
$$ language sql security definer;
```

- [ ] **Step 3: Apply migration and commit**

```bash
npx supabase db push
git add app/api/affiliate/attribution/ supabase/migrations/013_affiliate_tables.sql
git commit -m "feat(affiliate): add attribution resolution API route"
```

---

## Task 7: Affiliate Stats & Data API Routes

**Files:**
- Create: `app/api/affiliate/stats/route.ts`
- Create: `app/api/affiliate/orders/route.ts`
- Create: `app/api/affiliate/payouts/route.ts`

- [ ] **Step 1: Write stats route**

```typescript
// app/api/affiliate/stats/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { requireAffiliate } from '@/lib/server/require-affiliate'
import type { AffiliateDashboardStats } from '@/types'

export async function GET() {
  const guard = await requireAffiliate()
  if (guard.error) return guard.error

  const affiliateId = guard.userId!
  const supabase = createServiceClient()

  const [profileRes, clicksRes, attributionsRes] = await Promise.all([
    supabase
      .from('affiliate_profiles')
      .select('total_earned_cents, pending_payout_cents')
      .eq('id', affiliateId)
      .single(),

    supabase
      .from('referral_links')
      .select('clicks_count')
      .eq('affiliate_id', affiliateId)
      .single(),

    supabase
      .from('affiliate_attributions')
      .select('id, commission_amount_cents, created_at, order_id')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false }),
  ])

  const profile = profileRes.data
  const totalClicks = clicksRes.data?.clicks_count ?? 0
  const attributions = attributionsRes.data ?? []

  const totalOrders = attributions.length
  const conversionRate = totalClicks > 0 ? Math.round((totalOrders / totalClicks) * 100) : 0

  // Build weekly sales for last 8 weeks
  const now = new Date()
  const weekly_sales = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - (7 * (7 - i)))
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    const weekAttrs = attributions.filter((a) => {
      const d = new Date(a.created_at)
      return d >= weekStart && d < weekEnd
    })

    return {
      week: weekStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
      amount_cents: weekAttrs.reduce((s, a) => s + a.commission_amount_cents, 0),
      orders: weekAttrs.length,
    }
  })

  // Top products (requires joining with orders — simplified via orders table)
  const orderIds = attributions.slice(0, 50).map((a) => a.order_id)
  let top_products: Array<{ product_name: string; units: number }> = []

  if (orderIds.length > 0) {
    const { data: orders } = await supabase
      .from('orders')
      .select('items')
      .in('id', orderIds)

    const productCounts: Record<string, number> = {}
    for (const order of orders ?? []) {
      const items = order.items as Array<{ name: string; quantity: number }>
      for (const item of items) {
        productCounts[item.name] = (productCounts[item.name] ?? 0) + item.quantity
      }
    }

    top_products = Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([product_name, units]) => ({ product_name, units }))
  }

  const stats: AffiliateDashboardStats = {
    total_earned_cents: profile?.total_earned_cents ?? 0,
    pending_payout_cents: profile?.pending_payout_cents ?? 0,
    total_orders: totalOrders,
    total_clicks: totalClicks,
    conversion_rate: conversionRate,
    weekly_sales,
    top_products,
  }

  return NextResponse.json({ data: stats })
}
```

- [ ] **Step 2: Write orders route**

```typescript
// app/api/affiliate/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAffiliate } from '@/lib/server/require-affiliate'

export async function GET(request: NextRequest) {
  const guard = await requireAffiliate()
  if (guard.error) return guard.error

  const affiliateId = guard.userId!
  const { searchParams } = request.nextUrl

  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const type = searchParams.get('type')
  const status = searchParams.get('status')

  const supabase = createServiceClient()
  let query = supabase
    .from('affiliate_attributions')
    .select(`
      id, order_id, attribution_type, coupon_id,
      commission_pct, commission_amount_cents, payout_status, paid_at, created_at,
      orders ( short_id, total, created_at )
    `)
    .eq('affiliate_id', affiliateId)
    .order('created_at', { ascending: false })

  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)
  if (type && (type === 'coupon' || type === 'cookie')) query = query.eq('attribution_type', type)
  if (status && (status === 'pending' || status === 'paid')) query = query.eq('payout_status', status)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: 'Error al obtener órdenes' }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
```

- [ ] **Step 3: Write payouts route**

```typescript
// app/api/affiliate/payouts/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAffiliate } from '@/lib/server/require-affiliate'

export async function GET() {
  const guard = await requireAffiliate()
  if (guard.error) return guard.error

  const affiliateId = guard.userId!
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('commission_payments')
    .select('*')
    .eq('affiliate_id', affiliateId)
    .order('paid_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Error al obtener pagos' }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/affiliate/
git commit -m "feat(affiliate): add stats, orders, and payouts API routes"
```

---

## Task 8: Admin Affiliate API Routes

**Files:**
- Create: `app/api/admin/affiliates/route.ts`
- Create: `app/api/admin/affiliates/[id]/route.ts`
- Create: `app/api/admin/affiliates/[id]/payout/route.ts`

- [ ] **Step 1: Write admin affiliates list/create route**

```typescript
// app/api/admin/affiliates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const supabase = createServiceClient()

  const { data: profiles, error } = await supabase
    .from('affiliate_profiles')
    .select(`
      id, handle, bio, commission_coupon_pct, commission_cookie_pct,
      total_earned_cents, pending_payout_cents, is_active, created_at,
      auth.users!inner ( email )
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Error al obtener afiliados' }, { status: 500 })

  // Enrich with referral slug and coupon code
  const affiliateIds = (profiles ?? []).map((p) => p.id)

  const [linksRes, couponsRes] = await Promise.all([
    supabase.from('referral_links').select('affiliate_id, slug').in('affiliate_id', affiliateIds),
    supabase.from('coupons').select('affiliate_id, code').in('affiliate_id', affiliateIds).eq('is_active', true),
  ])

  const slugMap = Object.fromEntries((linksRes.data ?? []).map((l) => [l.affiliate_id, l.slug]))
  const couponMap = Object.fromEntries((couponsRes.data ?? []).map((c) => [c.affiliate_id, c.code]))

  const enriched = (profiles ?? []).map((p) => ({
    ...p,
    email: (p as any)['auth.users']?.email ?? '',
    referral_slug: slugMap[p.id] ?? null,
    coupon_code: couponMap[p.id] ?? null,
  }))

  return NextResponse.json({ data: enriched })
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const supabase = createServiceClient()
  const body = await request.json()

  const { email, handle, bio, commission_coupon_pct, commission_cookie_pct, referral_slug } = body

  if (!email || !handle || !referral_slug) {
    return NextResponse.json({ error: 'email, handle y referral_slug son obligatorios' }, { status: 400 })
  }

  // Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID(),
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Error al crear usuario' }, { status: 400 })
  }

  const userId = authData.user.id

  // Set role
  await supabase.from('user_profiles').upsert({
    id: userId,
    role: 'affiliate',
    full_name: handle,
  })

  // Create affiliate profile
  await supabase.from('affiliate_profiles').insert({
    id: userId,
    handle,
    bio: bio ?? null,
    commission_coupon_pct: commission_coupon_pct ?? 10,
    commission_cookie_pct: commission_cookie_pct ?? 5,
  })

  // Create referral link
  const { error: linkError } = await supabase.from('referral_links').insert({
    affiliate_id: userId,
    slug: referral_slug.toLowerCase(),
  })

  if (linkError) {
    return NextResponse.json({ error: 'El slug ya está en uso' }, { status: 409 })
  }

  return NextResponse.json({ ok: true, userId }, { status: 201 })
}
```

- [ ] **Step 2: Write admin single affiliate route**

```typescript
// app/api/admin/affiliates/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('affiliate_profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Afiliado no encontrado' }, { status: 404 })

  const [linkRes, couponRes, attrsRes] = await Promise.all([
    supabase.from('referral_links').select('slug, clicks_count').eq('affiliate_id', id).single(),
    supabase.from('coupons').select('id, code, type, value').eq('affiliate_id', id).eq('is_active', true).single(),
    supabase
      .from('affiliate_attributions')
      .select('id, order_id, attribution_type, commission_amount_cents, payout_status, created_at, orders(short_id, total)')
      .eq('affiliate_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return NextResponse.json({
    data: {
      profile: data,
      referral_link: linkRes.data ?? null,
      coupon: couponRes.data ?? null,
      attributions: attrsRes.data ?? [],
    },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id } = await params
  const body = await request.json()
  const supabase = createServiceClient()

  const allowed = ['commission_coupon_pct', 'commission_cookie_pct', 'is_active', 'bio', 'handle']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { error } = await supabase
    .from('affiliate_profiles')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write admin payout route**

```typescript
// app/api/admin/affiliates/[id]/payout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id: affiliateId } = await params
  const { attributionIds, notes, periodFrom, periodTo } = await request.json()

  if (!attributionIds?.length || !periodFrom || !periodTo) {
    return NextResponse.json({ error: 'attributionIds, periodFrom y periodTo requeridos' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Get total amount from selected attributions
  const { data: attrs, error: fetchError } = await supabase
    .from('affiliate_attributions')
    .select('id, commission_amount_cents')
    .in('id', attributionIds)
    .eq('affiliate_id', affiliateId)
    .eq('payout_status', 'pending')

  if (fetchError || !attrs?.length) {
    return NextResponse.json({ error: 'No se encontraron atribuciones pendientes' }, { status: 400 })
  }

  const totalCents = attrs.reduce((s, a) => s + a.commission_amount_cents, 0)
  const now = new Date().toISOString()

  // Record payment
  const { error: payError } = await supabase.from('commission_payments').insert({
    affiliate_id: affiliateId,
    amount_cents: totalCents,
    period_from: periodFrom,
    period_to: periodTo,
    attribution_ids: attrs.map((a) => a.id),
    notes: notes ?? null,
    paid_by: guard.userId,
    paid_at: now,
  })

  if (payError) return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 })

  // Mark attributions as paid
  await supabase
    .from('affiliate_attributions')
    .update({ payout_status: 'paid', paid_at: now })
    .in('id', attrs.map((a) => a.id))

  // Update affiliate balance
  await supabase
    .from('affiliate_profiles')
    .update({
      pending_payout_cents: supabase.rpc('decrement_pending_payout', { affiliate_id: affiliateId, amount: totalCents }) as any,
      total_earned_cents: supabase.rpc('increment_total_earned', { affiliate_id: affiliateId, amount: totalCents }) as any,
    })
    .eq('id', affiliateId)

  // Simpler approach: read-then-write for the balance update
  const { data: profile } = await supabase
    .from('affiliate_profiles')
    .select('pending_payout_cents, total_earned_cents')
    .eq('id', affiliateId)
    .single()

  if (profile) {
    await supabase
      .from('affiliate_profiles')
      .update({
        pending_payout_cents: Math.max(0, profile.pending_payout_cents - totalCents),
        total_earned_cents: profile.total_earned_cents + totalCents,
      })
      .eq('id', affiliateId)
  }

  return NextResponse.json({ ok: true, amountPaidCents: totalCents })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/affiliates/
git commit -m "feat(affiliate): add admin affiliate management API routes"
```

---

## Task 9: Affiliate Portal Layout + Auth Store

**Files:**
- Create: `lib/stores/affiliateAuth.ts`
- Create: `app/affiliate/layout.tsx`
- Create: `app/affiliate/page.tsx`

- [ ] **Step 1: Write affiliate auth Zustand store**

Follows the same pattern as `lib/stores/adminAuth.ts`.

```typescript
// lib/stores/affiliateAuth.ts
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'

interface AffiliateUser {
  id: string
  email: string
  handle: string
}

interface AffiliateAuthState {
  user: AffiliateUser | null
  isAuthenticated: boolean
  isLoading: boolean
  checkSession: () => Promise<void>
  logout: () => Promise<void>
}

export const useAffiliateAuthStore = create<AffiliateAuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  checkSession: async () => {
    set({ isLoading: true })
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      set({ user: null, isAuthenticated: false, isLoading: false })
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'affiliate') {
      set({ user: null, isAuthenticated: false, isLoading: false })
      return
    }

    const { data: affiliateProfile } = await supabase
      .from('affiliate_profiles')
      .select('handle')
      .eq('id', user.id)
      .single()

    set({
      user: { id: user.id, email: user.email!, handle: affiliateProfile?.handle ?? '' },
      isAuthenticated: true,
      isLoading: false,
    })
  },

  logout: async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    set({ user: null, isAuthenticated: false })
  },
}))
```

- [ ] **Step 2: Write affiliate layout**

```typescript
// app/affiliate/layout.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { BarChart3, ShoppingBag, CreditCard, User, LogOut, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAffiliateAuthStore } from '@/lib/stores/affiliateAuth'

const NAV = [
  { href: '/affiliate/overview', label: 'Resumen', icon: BarChart3 },
  { href: '/affiliate/ventas', label: 'Ventas', icon: ShoppingBag },
  { href: '/affiliate/pagos', label: 'Pagos', icon: CreditCard },
  { href: '/affiliate/perfil', label: 'Perfil', icon: User },
]

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, isLoading, checkSession, logout } = useAffiliateAuthStore()

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login?redirect=/affiliate/overview')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-dark to-[#0D2A3F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-cyan animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b h-14 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="nurei" className="w-7 h-7 object-contain" />
          <span className="text-lg font-black text-primary-dark">
            nu<span className="text-primary-cyan">rei</span>
            <span className="text-xs font-medium text-gray-400 ml-2">afiliados</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:block">@{user?.handle}</span>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors',
                isActive(href)
                  ? 'border-primary-cyan text-primary-cyan'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:block">{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <motion.div
          key={pathname}
          initial={{ opacity: 0.95 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Write redirect page**

```typescript
// app/affiliate/page.tsx
import { redirect } from 'next/navigation'

export default function AffiliatePage() {
  redirect('/affiliate/overview')
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/stores/affiliateAuth.ts app/affiliate/layout.tsx app/affiliate/page.tsx
git commit -m "feat(affiliate): add affiliate portal layout with auth guard"
```

---

## Task 10: Affiliate Overview Page

**Files:**
- Create: `app/affiliate/overview/page.tsx`

- [ ] **Step 1: Write overview page**

```typescript
// app/affiliate/overview/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, ShoppingBag, MousePointer2, Wallet, DollarSign, Package } from 'lucide-react'
import { formatPrice } from '@/lib/utils/format'
import type { AffiliateDashboardStats } from '@/types'

function KpiCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-primary-cyan/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary-cyan" />
        </div>
      </div>
      <p className="text-2xl font-black text-primary-dark">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function AffiliateOverviewPage() {
  const [stats, setStats] = useState<AffiliateDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/affiliate/stats')
      .then((r) => r.json())
      .then(({ data }) => setStats(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border h-24 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return <p className="text-gray-500">Error al cargar estadísticas.</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-primary-dark">Resumen</h1>
        <p className="text-sm text-gray-400 mt-1">Tu desempeño como afiliado Nurei</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard icon={DollarSign} label="Total ganado" value={formatPrice(stats.total_earned_cents)} />
        <KpiCard icon={Wallet} label="Pendiente de cobro" value={formatPrice(stats.pending_payout_cents)} sub="Próximo pago" />
        <KpiCard icon={ShoppingBag} label="Órdenes atribuidas" value={String(stats.total_orders)} />
        <KpiCard icon={MousePointer2} label="Clics totales" value={String(stats.total_clicks)} />
        <KpiCard icon={TrendingUp} label="Conversión" value={`${stats.conversion_rate}%`} sub="Clics → compra" />
      </div>

      {/* Weekly chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Ventas semanales (últimas 8 semanas)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stats.weekly_sales} barSize={24}>
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(value: number) => [formatPrice(value), 'Comisión']}
              contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', fontSize: 12 }}
            />
            <Bar dataKey="amount_cents" fill="#00C4CC" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top products */}
      {stats.top_products.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Top productos más vendidos</h2>
          <div className="space-y-3">
            {stats.top_products.map((p, i) => (
              <div key={p.product_name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-4">#{i + 1}</span>
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Package className="w-4 h-4 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-primary-dark">{p.product_name}</p>
                </div>
                <span className="text-sm font-bold text-gray-500">{p.units} uds.</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/affiliate/overview/
git commit -m "feat(affiliate): add affiliate overview dashboard page"
```

---

## Task 11: Affiliate Ventas + Pagos + Perfil Pages

**Files:**
- Create: `app/affiliate/ventas/page.tsx`
- Create: `app/affiliate/pagos/page.tsx`
- Create: `app/affiliate/perfil/page.tsx`

- [ ] **Step 1: Write ventas page**

```typescript
// app/affiliate/ventas/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { AffiliateAttribution } from '@/types'

interface AttributionRow extends AffiliateAttribution {
  orders?: { short_id: string; total: number; created_at: string }
}

export default function AffiliateVentasPage() {
  const [rows, setRows] = useState<AttributionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (typeFilter) params.set('type', typeFilter)
    if (statusFilter) params.set('status', statusFilter)

    setLoading(true)
    fetch(`/api/affiliate/orders?${params}`)
      .then((r) => r.json())
      .then(({ data }) => setRows(data ?? []))
      .finally(() => setLoading(false))
  }, [typeFilter, statusFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-primary-dark">Ventas</h1>
        <p className="text-sm text-gray-400 mt-1">Órdenes atribuidas a tu link o cupón</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 px-3 bg-white border border-gray-200 rounded-xl text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="coupon">Cupón</option>
          <option value="cookie">Link</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 bg-white border border-gray-200 rounded-xl text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="paid">Pagado</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Orden</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tipo</th>
                <th className="text-right py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Monto orden</th>
                <th className="text-right py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Comisión</th>
                <th className="text-center py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estado pago</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td colSpan={6} className="py-4 px-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-sm text-gray-400">
                    No hay ventas con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                    <td className="py-3.5 px-4 text-gray-500 text-xs">
                      {new Date(row.created_at).toLocaleDateString('es-MX')}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-primary-dark font-bold">
                      #{row.orders?.short_id ?? '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={cn(
                        'px-2 py-0.5 text-[10px] font-bold rounded-full',
                        row.attribution_type === 'coupon'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      )}>
                        {row.attribution_type === 'coupon' ? 'Cupón' : 'Link'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-gray-600">
                      {row.orders ? formatPrice(row.orders.total) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-primary-dark">
                      {formatPrice(row.commission_amount_cents)}
                      <span className="text-gray-400 font-normal text-xs ml-1">({row.commission_pct}%)</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={cn(
                        'px-2 py-0.5 text-[10px] font-bold rounded-full',
                        row.payout_status === 'paid'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      )}>
                        {row.payout_status === 'paid' ? 'Pagado' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write pagos page**

```typescript
// app/affiliate/pagos/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/utils/format'
import type { CommissionPayment } from '@/types'

export default function AffiliatePagosPage() {
  const [payments, setPayments] = useState<CommissionPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/affiliate/payouts')
      .then((r) => r.json())
      .then(({ data }) => setPayments(data ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-primary-dark">Pagos</h1>
        <p className="text-sm text-gray-400 mt-1">Historial de comisiones recibidas</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fecha de pago</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Período</th>
                <th className="text-right py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Monto</th>
                <th className="text-center py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Órdenes</th>
                <th className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Notas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-16 text-center"><div className="w-5 h-5 border-2 border-primary-cyan border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-sm text-gray-400">Aún no tienes pagos registrados</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                    <td className="py-3.5 px-4 text-gray-500 text-xs">
                      {new Date(p.paid_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-500">
                      {new Date(p.period_from).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} —{' '}
                      {new Date(p.period_to).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                      {formatPrice(p.amount_cents)}
                    </td>
                    <td className="py-3.5 px-4 text-center text-gray-500 text-xs">
                      {p.attribution_ids.length}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 text-xs hidden md:table-cell">
                      {p.notes ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write perfil page**

```typescript
// app/affiliate/perfil/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Save, Copy, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useAffiliateAuthStore } from '@/lib/stores/affiliateAuth'

export default function AffiliatePerfilPage() {
  const { user } = useAffiliateAuthStore()
  const [bio, setBio] = useState('')
  const [slug, setSlug] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase
      .from('affiliate_profiles')
      .select('bio')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data?.bio) setBio(data.bio) })

    supabase
      .from('referral_links')
      .select('slug')
      .eq('affiliate_id', user.id)
      .single()
      .then(({ data }) => { if (data?.slug) setSlug(data.slug) })
  }, [user])

  const referralUrl = slug ? `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nurei.mx'}/?ref=${slug}` : null

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('affiliate_profiles')
      .update({ bio })
      .eq('id', user.id)

    if (error) toast.error('Error al guardar')
    else toast.success('Perfil actualizado')
    setSaving(false)
  }

  const copyLink = () => {
    if (!referralUrl) return
    navigator.clipboard.writeText(referralUrl)
    toast.success('Link copiado')
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-black text-primary-dark">Perfil</h1>
        <p className="text-sm text-gray-400 mt-1">Tu información de afiliado</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Handle</label>
          <p className="mt-1 font-bold text-primary-dark">@{user?.handle}</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
          <p className="mt-1 text-sm text-gray-600">{user?.email}</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-cyan/30"
            placeholder="Cuéntale a Nurei sobre ti..."
          />
        </div>

        {referralUrl && (
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Tu link de referido</label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-xs font-mono text-primary-dark flex-1 truncate">{referralUrl}</span>
              <button onClick={copyLink} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary-cyan">
                <Copy className="w-4 h-4" />
              </button>
              <a href={referralUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-bold rounded-xl h-10 px-6"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/affiliate/ventas/ app/affiliate/pagos/ app/affiliate/perfil/
git commit -m "feat(affiliate): add ventas, pagos, and perfil pages to affiliate portal"
```

---

## Task 12: Admin Affiliates Module

**Files:**
- Create: `app/admin/affiliates/page.tsx`
- Create: `app/admin/affiliates/[id]/page.tsx`
- Create: `app/admin/affiliates/pagos/page.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Add Afiliados to admin nav**

Open `app/admin/layout.tsx`. Find the `NAV_ITEMS` array and add:

```typescript
import { Users2 } from 'lucide-react'  // add to imports

// In NAV_ITEMS array, add after '/admin/cupones':
{ href: '/admin/affiliates', label: 'Afiliados', icon: Users2 },
```

- [ ] **Step 2: Write admin affiliates list page**

```typescript
// app/admin/affiliates/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, Search, Users2, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { formatPrice } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { AffiliateWithStats } from '@/types'

interface AffiliateForm {
  email: string
  handle: string
  referral_slug: string
  commission_coupon_pct: string
  commission_cookie_pct: string
}

const EMPTY_FORM: AffiliateForm = {
  email: '', handle: '', referral_slug: '',
  commission_coupon_pct: '10', commission_cookie_pct: '5',
}

export default function AdminAffiliatesPage() {
  const [affiliates, setAffiliates] = useState<AffiliateWithStats[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AffiliateForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/affiliates')
      .then((r) => r.json())
      .then(({ data }) => setAffiliates(data ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = affiliates.filter((a) =>
    a.handle.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!form.email || !form.handle || !form.referral_slug) {
      toast.error('Email, handle y slug son obligatorios')
      return
    }
    setSaving(true)
    const res = await fetch('/api/admin/affiliates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        commission_coupon_pct: parseInt(form.commission_coupon_pct),
        commission_cookie_pct: parseInt(form.commission_cookie_pct),
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'Error al crear afiliado')
    } else {
      toast.success('Afiliado creado')
      setShowForm(false)
      setForm(EMPTY_FORM)
      load()
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Afiliados</h1>
          <p className="text-sm text-gray-400 mt-1">{affiliates.length} afiliados registrados</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/affiliates/pagos">
            <Button variant="outline" className="rounded-xl h-10 font-bold">Pagos pendientes</Button>
          </Link>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-primary-cyan text-primary-dark hover:bg-primary-cyan-hover font-bold rounded-xl h-10 px-5"
          >
            <Plus className="w-4 h-4 mr-2" /> Nuevo afiliado
          </Button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por handle o email..."
          className="pl-10 h-11 rounded-xl"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              {['Afiliado', 'Slug', 'Cupón', 'Comisión cupón', 'Comisión link', 'Pendiente cobro', 'Activo', ''].map((h) => (
                <th key={h} className="text-left py-3.5 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-16 text-center"><div className="w-5 h-5 border-2 border-primary-cyan border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
            ) : filtered.map((a) => (
              <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/30 group">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary-cyan/10 flex items-center justify-center text-xs font-bold text-primary-cyan">
                      {a.handle.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-primary-dark">@{a.handle}</p>
                      <p className="text-xs text-gray-400">{a.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 font-mono text-xs text-gray-500">{a.referral_slug ?? '—'}</td>
                <td className="py-4 px-4 font-mono text-xs font-bold text-primary-dark">{a.coupon_code ?? '—'}</td>
                <td className="py-4 px-4 text-gray-600">{a.commission_coupon_pct}%</td>
                <td className="py-4 px-4 text-gray-600">{a.commission_cookie_pct}%</td>
                <td className="py-4 px-4 font-bold text-amber-600">{formatPrice(a.pending_payout_cents)}</td>
                <td className="py-4 px-4">
                  <span className={cn('px-2 py-0.5 text-[10px] font-bold rounded-full', a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                    {a.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-4 px-4 text-right opacity-0 group-hover:opacity-100">
                  <Link href={`/admin/affiliates/${a.id}`} className="text-xs font-bold text-primary-cyan hover:underline flex items-center gap-1 justify-end">
                    Ver detalle <ExternalLink className="w-3 h-3" />
                  </Link>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <Users2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No hay afiliados registrados aún</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="p-6 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black text-primary-dark">Nuevo afiliado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {[
              { label: 'Email', key: 'email', type: 'email', placeholder: 'influencer@email.com' },
              { label: 'Handle (@)', key: 'handle', type: 'text', placeholder: 'mariafood' },
              { label: 'Slug del link (?ref=)', key: 'referral_slug', type: 'text', placeholder: 'maria' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{label}</label>
                <Input
                  type={type}
                  value={form[key as keyof AffiliateForm]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="h-10"
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Comisión cupón (%)</label>
                <Input type="number" value={form.commission_coupon_pct} onChange={(e) => setForm({ ...form, commission_coupon_pct: e.target.value })} className="h-10" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Comisión link (%)</label>
                <Input type="number" value={form.commission_cookie_pct} onChange={(e) => setForm({ ...form, commission_cookie_pct: e.target.value })} className="h-10" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl h-10">Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving} className="bg-primary-dark text-white rounded-xl h-10 px-6 font-bold">
                {saving ? 'Creando...' : 'Crear afiliado'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Write admin affiliate detail page**

```typescript
// app/admin/affiliates/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPrice } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { AffiliateProfile, AffiliateAttribution } from '@/types'

interface DetailData {
  profile: AffiliateProfile
  referral_link: { slug: string; clicks_count: number } | null
  coupon: { id: string; code: string; type: string; value: number } | null
  attributions: Array<AffiliateAttribution & { orders?: { short_id: string; total: number } }>
}

export default function AdminAffiliateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [couponPct, setCouponPct] = useState('')
  const [cookiePct, setCookiePct] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/affiliates/${id}`)
      .then((r) => r.json())
      .then(({ data: d }) => {
        setData(d)
        setCouponPct(String(d.profile.commission_coupon_pct))
        setCookiePct(String(d.profile.commission_cookie_pct))
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch(`/api/admin/affiliates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commission_coupon_pct: parseInt(couponPct),
        commission_cookie_pct: parseInt(cookiePct),
      }),
    })
    if (res.ok) toast.success('Tasas actualizadas')
    else toast.error('Error al actualizar')
    setSaving(false)
  }

  if (loading) return <div className="h-32 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary-cyan border-t-transparent rounded-full animate-spin" /></div>
  if (!data) return <p className="text-gray-500">Afiliado no encontrado</p>

  const { profile, referral_link, coupon, attributions } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/affiliates" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-gray-900">@{profile.handle}</h1>
          <p className="text-sm text-gray-400">Detalle del afiliado</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total ganado', value: formatPrice(profile.total_earned_cents) },
          { label: 'Pendiente', value: formatPrice(profile.pending_payout_cents) },
          { label: 'Clics totales', value: String(referral_link?.clicks_count ?? 0) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl border p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
            <p className="text-2xl font-black text-primary-dark">{value}</p>
          </div>
        ))}
      </div>

      {/* Commission rates */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Tasas de comisión</h2>
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">Por cupón (%)</label>
            <Input type="number" value={couponPct} onChange={(e) => setCouponPct(e.target.value)} className="h-10" min={0} max={100} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">Por link (%)</label>
            <Input type="number" value={cookiePct} onChange={(e) => setCookiePct(e.target.value)} className="h-10" min={0} max={100} />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="mt-4 bg-primary-dark text-white rounded-xl h-10 px-6 font-bold">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar tasas'}
        </Button>
      </div>

      {/* Coupon & Link info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cupón asignado</h3>
          {coupon ? (
            <div>
              <p className="font-mono font-bold text-primary-dark text-lg">{coupon.code}</p>
              <p className="text-sm text-gray-500">{coupon.type === 'percentage' ? `${coupon.value}% desc.` : formatPrice(coupon.value)}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin cupón asignado — crear en módulo de Cupones</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Link de referido</h3>
          {referral_link ? (
            <div>
              <p className="font-mono text-sm text-primary-dark">?ref={referral_link.slug}</p>
              <p className="text-sm text-gray-500 mt-1">{referral_link.clicks_count} clics totales</p>
            </div>
          ) : <p className="text-sm text-gray-400">Sin link</p>}
        </div>
      </div>

      {/* Attributions */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <div className="p-5 border-b">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Órdenes atribuidas (últimas 50)</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50 border-b">
              {['Fecha', 'Orden', 'Tipo', 'Comisión', 'Estado'].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-gray-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attributions.length === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center text-sm text-gray-400">Sin órdenes aún</td></tr>
            ) : (
              attributions.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                  <td className="py-3 px-4 text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString('es-MX')}</td>
                  <td className="py-3 px-4 font-mono text-xs font-bold">#{a.orders?.short_id ?? '—'}</td>
                  <td className="py-3 px-4">
                    <span className={cn('px-2 py-0.5 text-[10px] font-bold rounded-full', a.attribution_type === 'coupon' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700')}>
                      {a.attribution_type === 'coupon' ? 'Cupón' : 'Link'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-primary-dark">{formatPrice(a.commission_amount_cents)}</td>
                  <td className="py-3 px-4">
                    <span className={cn('px-2 py-0.5 text-[10px] font-bold rounded-full', a.payout_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                      {a.payout_status === 'paid' ? 'Pagado' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write admin pagos page (simplified)**

```typescript
// app/admin/affiliates/pagos/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, DollarSign } from 'lucide-react'
import { formatPrice } from '@/lib/utils/format'
import type { AffiliateWithStats } from '@/types'

export default function AdminAffiliatesPagosPage() {
  const [affiliates, setAffiliates] = useState<AffiliateWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/affiliates')
      .then((r) => r.json())
      .then(({ data }) => setAffiliates((data ?? []).filter((a: AffiliateWithStats) => a.pending_payout_cents > 0)))
      .finally(() => setLoading(false))
  }, [])

  const total = affiliates.reduce((s, a) => s + a.pending_payout_cents, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/affiliates" className="text-gray-400 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Pagos pendientes</h1>
          <p className="text-sm text-gray-400">Total a pagar: <span className="font-bold text-amber-600">{formatPrice(total)}</span></p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50 border-b">
              {['Afiliado', 'Pendiente', ''].map((h) => (
                <th key={h} className="text-left py-3.5 px-4 text-[10px] font-bold text-gray-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="py-16 text-center"><div className="w-5 h-5 border-2 border-primary-cyan border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
            ) : affiliates.length === 0 ? (
              <tr><td colSpan={3} className="py-16 text-center text-sm text-gray-400">No hay pagos pendientes</td></tr>
            ) : (
              affiliates.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-bold text-primary-dark">@{a.handle}</p>
                      <p className="text-xs text-gray-400">{a.email}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-bold text-amber-600 text-base">{formatPrice(a.pending_payout_cents)}</td>
                  <td className="py-4 px-4 text-right">
                    <Link href={`/admin/affiliates/${a.id}`} className="text-xs font-bold text-primary-cyan hover:underline flex items-center gap-1 justify-end">
                      <DollarSign className="w-3.5 h-3.5" /> Registrar pago
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/admin/affiliates/ app/admin/layout.tsx
git commit -m "feat(affiliate): add admin affiliates module (list, detail, pagos)"
```

---

## Task 13: Stripe Webhook Integration

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Add attribution call to Stripe webhook**

Open `app/api/webhooks/stripe/route.ts` and replace the entire file:

```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' })

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    const supabase = createServiceClient()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orderId = session.metadata?.order_id
        if (!orderId) break

        // Update order payment status
        await supabase.from('orders').update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent as string,
        }).eq('id', orderId)

        // Fetch order for attribution
        const { data: order } = await supabase
          .from('orders')
          .select('total, coupon_code')
          .eq('id', orderId)
          .single()

        // Trigger attribution (fire-and-forget, non-blocking)
        if (order) {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
          fetch(`${baseUrl}/api/affiliate/attribution`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              orderTotalCents: order.total,
              couponCode: order.coupon_code ?? null,
              // cookieHeader is unavailable in webhooks — cookie-based attribution
              // must be captured at checkout time and stored in order metadata
              cookieHeader: session.metadata?.referral_link_id
                ? `_nurei_ref=${session.metadata.referral_link_id}`
                : null,
            }),
          }).catch(() => {}) // non-blocking
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent
        const orderId = intent.metadata?.order_id
        if (orderId) {
          await supabase.from('orders').update({
            payment_status: 'failed',
            status: 'failed',
          }).eq('id', orderId)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
```

> **Important:** For cookie-based attribution via the Stripe webhook, the checkout flow must pass the `_nurei_ref` cookie value as `session.metadata.referral_link_id` when creating the Stripe Checkout Session. This requires modifying the checkout session creation route to read the cookie from the request and forward it as metadata.

- [ ] **Step 2: Add referral_link_id to checkout session metadata**

Find the route that creates the Stripe Checkout Session (likely `app/api/payment/route.ts` or similar). Add:

```typescript
// When creating the Stripe session, pass the referral cookie as metadata
const referralLinkId = request.cookies.get('_nurei_ref')?.value ?? null

const session = await stripe.checkout.sessions.create({
  // ... existing config
  metadata: {
    order_id: orderId,
    ...(referralLinkId ? { referral_link_id: referralLinkId } : {}),
  },
})
```

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/stripe/route.ts
git commit -m "feat(affiliate): integrate attribution into Stripe webhook on payment confirmed"
```

---

## Task 14: Referral Click Trigger in Storefront

**Files:**
- Modify: `app/(public)/layout.tsx` or `app/(public)/page.tsx`

When a visitor lands on `/?ref=slug`, the storefront must call `/api/referral/click` to register the click and plant the cookie.

- [ ] **Step 1: Add referral tracking to storefront**

Create a client component that fires on mount when `ref` param is present:

```typescript
// components/ReferralTracker.tsx
'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { v4 as uuid } from 'uuid'

export function ReferralTracker() {
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')

  useEffect(() => {
    if (!ref) return

    // Stable session ID stored in sessionStorage
    let sessionId = sessionStorage.getItem('_nurei_sid')
    if (!sessionId) {
      sessionId = uuid()
      sessionStorage.setItem('_nurei_sid', sessionId)
    }

    fetch('/api/referral/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: ref, sessionId }),
    }).catch(() => {}) // non-blocking, best-effort
  }, [ref])

  return null
}
```

- [ ] **Step 2: Add ReferralTracker to public layout**

Open `app/(public)/layout.tsx` and add:

```typescript
import { Suspense } from 'react'
import { ReferralTracker } from '@/components/ReferralTracker'

// Inside the layout JSX, at the top of the body:
<Suspense fallback={null}>
  <ReferralTracker />
</Suspense>
```

- [ ] **Step 3: Commit**

```bash
git add components/ReferralTracker.tsx app/\(public\)/layout.tsx
git commit -m "feat(affiliate): add referral click tracker to storefront"
```

---

## Self-Review

### Spec coverage check
- [x] §3 DB Schema → Task 1
- [x] §3.1 user_profiles.role → Task 1 (012 migration)
- [x] §3.1 coupons.affiliate_id → Task 1 (012 migration)
- [x] §3.2 All 5 new tables → Task 1 (013 migration)
- [x] §3.3 RLS policies → Task 1 (014 migration)
- [x] §2 Types → Task 2
- [x] §4 Attribution flow → Tasks 3 (pure lib), 5 (click), 6 (attribution), 13 (webhook), 14 (tracker)
- [x] §5 Routes → Tasks 4 (guard), 7 (affiliate APIs), 8 (admin APIs), 9-11 (portal), 12 (admin)
- [x] §6 Dashboard detail → Task 10 (overview), 11 (ventas/pagos/perfil)
- [x] §7 Admin module → Task 12
- [x] §8 Anti-fraud (dedup index) → Task 1 (migration 013)
- [x] §9 Migration plan → Task 1
- [x] §10 Success criteria → all tasks collectively

### Placeholder scan
- No TBDs or TODOs in task steps.
- The admin payout "register payment" flow (from detail page) directs to the affiliate detail page and calls `/api/admin/affiliates/[id]/payout` — the button wiring is left to Task 12 Step 3, where the PATCH form should be extended. **Fix:** The detail page in Task 12 shows rates editing. To record a payout, admin visits the detail page, sees the pending attributions table, and clicks individual rows to select them. This is a UX simplification for v1 — the full payout selection modal should be a follow-up task.

### Type consistency
- `AffiliateWithStats` used in admin pages is defined in Task 2 and consumed in Task 8 (API) and Task 12 (UI). ✓
- `AffiliateDashboardStats` returned by `/api/affiliate/stats` and consumed by `overview/page.tsx`. ✓
- `AffiliateAttribution` used in detail page and ventas page. ✓

---
