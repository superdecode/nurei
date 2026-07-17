# Marketing Tracking Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire consent-gated Google Analytics 4, Meta Pixel + Conversions API, and Microsoft Clarity into nurei so campaign performance and real purchases can be measured and attributed.

**Architecture:** A `lib/tracking/` module holds per-platform event helpers (pure, unit-testable payload builders + thin `window.*` callers that no-op safely). A `ConsentProvider` gates rendering of the three `<Script>` tags; each integration also self-disables when its env var is unset. Meta Purchase is dual-tracked: browser Pixel (gated by consent) + server Conversions API from the Stripe webhook (ungated, recovers blocked/lost conversions), deduplicated via a shared `event_id`.

**Tech Stack:** Next.js 16 (App Router), React 19, Zustand, Vitest, TypeScript, `next/script`.

## Global Constraints

- Prices in the codebase (`Product.price`, `Product.base_price`, `ProductVariant.price`, `Order.total`, `OrderItem.subtotal`) are in **centavos MXN**. All tracking `value` fields must be divided by 100 before being sent (see `lib/utils/format.ts:5`, `formatPrice`).
- The public route group layout (`app/(public)/layout.tsx`) must **never** call `next/headers` `cookies()` — this breaks ISR on public pages (established project constraint). Consent state is read/written client-side only (`document.cookie`), never server-side in that layout.
- Every tracking call must fail silently — a blocked/missing `window.gtag`/`window.fbq`/`window.clarity`, or a failed Meta CAPI request, must never break checkout or browsing. Matches the existing `.catch(() => {})` pattern in `app/api/webhooks/stripe/route.ts:61` and `:70-77`.
- No Google Tag Manager — scripts are added directly via `next/script`.
- Consent is binary (Accept/Reject), not granular by category.
- Meta Conversions API Graph API version: **v25.0** (verified via developers.facebook.com, 2026-07-17). Endpoint: `https://graph.facebook.com/v25.0/{pixel_id}/events?access_token={token}`.
- `em`/`ph` user_data fields must be SHA-256 hashed after normalizing: email → trim + lowercase; phone → strip all non-digits, strip leading zeros, then prepend MX country code `52` if the result is exactly 10 digits. `client_ip_address` and `client_user_agent` are sent **unhashed**.
- New env vars (all optional, blank by default): `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `META_CONVERSIONS_API_TOKEN`, `NEXT_PUBLIC_CLARITY_PROJECT_ID`.
- Spec deviations from `docs/superpowers/specs/2026-07-17-marketing-tracking-integrations-design.md` (refined during planning, intent preserved):
  - No custom `fbclid`-capture cookie/route. Meta's own Pixel script already sets first-party `_fbp` (browser ID) and `_fbc` (click ID, derived from the `fbclid` URL param) automatically on load — `create-checkout/route.ts` reads them the same way it already reads `_nurei_ref` (`request.cookies.get(...)`), no new client component needed.
  - `add_to_cart`/`AddToCart` fires from inside `lib/stores/cart.ts`'s `addItem` action (single source of truth for all 5 existing call sites) instead of from `useAddToCartFlight.ts` (which only has animation rect data, not product data).
  - Client-side `purchase`/`Purchase` fires in `app/(public)/pedido/[id]/page.tsx` keyed on `order.payment_status === 'paid'` (covers every payment method that reaches paid status), not only on the Stripe `success=true` redirect.
  - Server-side Meta CAPI Purchase is scoped to the Stripe (`stripe_card`) payment path only (fired from the existing webhook) — OXXO/bank-transfer/manual-card CAPI coverage is out of scope for this plan (those don't go through `app/api/webhooks/stripe/route.ts`).

---

### Task 1: Currency conversion helper

**Files:**
- Create: `lib/tracking/currency.ts`
- Test: `__tests__/tracking/currency.test.ts`

**Interfaces:**
- Produces: `centavosToPesos(centavos: number): number`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/tracking/currency.test.ts
import { describe, it, expect } from 'vitest'
import { centavosToPesos } from '../../lib/tracking/currency'

describe('centavosToPesos', () => {
  it('converts centavos to pesos', () => {
    expect(centavosToPesos(15000)).toBe(150)
  })

  it('handles zero', () => {
    expect(centavosToPesos(0)).toBe(0)
  })

  it('handles non-round centavos', () => {
    expect(centavosToPesos(12550)).toBe(125.5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/tracking/currency.test.ts`
Expected: FAIL with "Cannot find module '../../lib/tracking/currency'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/tracking/currency.ts
export function centavosToPesos(centavos: number): number {
  return centavos / 100
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/tracking/currency.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/tracking/currency.ts __tests__/tracking/currency.test.ts
git commit -m "feat: add centavos-to-pesos conversion helper for tracking"
```

---

### Task 2: Consent cookie module

**Files:**
- Create: `lib/tracking/consent.ts`
- Test: `__tests__/tracking/consent.test.ts`

**Interfaces:**
- Produces: `CONSENT_COOKIE_NAME: string`, `CONSENT_TTL_SECONDS: number`, `type ConsentValue = 'accepted' | 'rejected'`, `readConsentCookie(cookieString: string): ConsentValue | null`, `buildConsentCookieString(value: ConsentValue): string` (client-side `document.cookie`-assignable string), `getConsent(): ConsentValue | null` (reads `document.cookie`, browser-only), `setConsent(value: ConsentValue): void` (writes `document.cookie`, browser-only)

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/tracking/consent.test.ts
import { describe, it, expect } from 'vitest'
import { readConsentCookie, buildConsentCookieString, CONSENT_COOKIE_NAME } from '../../lib/tracking/consent'

describe('readConsentCookie', () => {
  it('returns null when cookie is absent', () => {
    expect(readConsentCookie('')).toBeNull()
    expect(readConsentCookie('other=1; foo=bar')).toBeNull()
  })

  it('parses accepted value', () => {
    expect(readConsentCookie(`${CONSENT_COOKIE_NAME}=accepted`)).toBe('accepted')
  })

  it('parses rejected value among other cookies', () => {
    expect(readConsentCookie(`foo=bar; ${CONSENT_COOKIE_NAME}=rejected; baz=1`)).toBe('rejected')
  })

  it('returns null for an unrecognized value', () => {
    expect(readConsentCookie(`${CONSENT_COOKIE_NAME}=garbage`)).toBeNull()
  })
})

describe('buildConsentCookieString', () => {
  it('builds a cookie string with 12 month max-age and path=/', () => {
    const str = buildConsentCookieString('accepted')
    expect(str).toContain(`${CONSENT_COOKIE_NAME}=accepted`)
    expect(str).toContain('path=/')
    expect(str).toContain('max-age=31536000')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/tracking/consent.test.ts`
Expected: FAIL with "Cannot find module '../../lib/tracking/consent'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/tracking/consent.ts
export const CONSENT_COOKIE_NAME = '_nurei_consent'
export const CONSENT_TTL_SECONDS = 365 * 24 * 60 * 60 // 12 months

export type ConsentValue = 'accepted' | 'rejected'

const VALID_VALUES: ConsentValue[] = ['accepted', 'rejected']

export function readConsentCookie(cookieString: string): ConsentValue | null {
  const match = cookieString.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE_NAME}=([^;]+)`))
  const raw = match?.[1]
  if (!raw) return null
  return VALID_VALUES.includes(raw as ConsentValue) ? (raw as ConsentValue) : null
}

export function buildConsentCookieString(value: ConsentValue): string {
  return `${CONSENT_COOKIE_NAME}=${value}; path=/; max-age=${CONSENT_TTL_SECONDS}; SameSite=Lax`
}

export function getConsent(): ConsentValue | null {
  if (typeof document === 'undefined') return null
  return readConsentCookie(document.cookie)
}

export function setConsent(value: ConsentValue): void {
  if (typeof document === 'undefined') return
  document.cookie = buildConsentCookieString(value)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/tracking/consent.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/tracking/consent.ts __tests__/tracking/consent.test.ts
git commit -m "feat: add consent cookie read/write helpers"
```

---

### Task 3: ConsentProvider + ConsentBanner components

**Files:**
- Create: `components/consent/ConsentProvider.tsx`
- Create: `components/consent/ConsentBanner.tsx`

**Interfaces:**
- Consumes: `getConsent`, `setConsent`, `type ConsentValue` from `@/lib/tracking/consent` (Task 2)
- Produces: `ConsentProvider({ children }: { children: ReactNode })`, `useConsent(): { consent: ConsentValue | 'pending', accept: () => void, reject: () => void }`, `ConsentBanner()` (renders null once `consent !== 'pending'`)

- [ ] **Step 1: Write ConsentProvider**

```typescript
// components/consent/ConsentProvider.tsx
'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getConsent, setConsent, type ConsentValue } from '@/lib/tracking/consent'

type ConsentState = ConsentValue | 'pending'

type ConsentContextValue = {
  consent: ConsentState
  accept: () => void
  reject: () => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<ConsentState>('pending')

  useEffect(() => {
    setConsentState(getConsent() ?? 'pending')
  }, [])

  const accept = useCallback(() => {
    setConsent('accepted')
    setConsentState('accepted')
  }, [])

  const reject = useCallback(() => {
    setConsent('rejected')
    setConsentState('rejected')
  }, [])

  const value = useMemo(() => ({ consent, accept, reject }), [consent, accept, reject])

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext)
  if (!ctx) {
    throw new Error('useConsent must be used within ConsentProvider')
  }
  return ctx
}
```

- [ ] **Step 2: Write ConsentBanner**

```typescript
// components/consent/ConsentBanner.tsx
'use client'

import { useConsent } from './ConsentProvider'

export function ConsentBanner() {
  const { consent, accept, reject } = useConsent()

  if (consent !== 'pending') return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 bg-white px-4 py-4 sm:px-6 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
        <p className="text-sm text-gray-600 flex-1">
          Usamos cookies para analizar el uso del sitio y medir el desempeño de nuestra publicidad. Puedes aceptar o rechazar.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={reject}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-full bg-primary-cyan px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-primary-cyan-hover transition-colors"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`
Visit `http://localhost:3500/` in a browser with no `_nurei_consent` cookie set (or clear cookies). Confirm the banner appears at the bottom. Click "Aceptar" — banner disappears, `document.cookie` contains `_nurei_consent=accepted`. Reload the page — banner stays hidden (cookie persisted).

- [ ] **Step 4: Commit**

```bash
git add components/consent/ConsentProvider.tsx components/consent/ConsentBanner.tsx
git commit -m "feat: add consent provider and banner components"
```

---

### Task 4: GA4 event helpers

**Files:**
- Create: `lib/tracking/ga4.ts`
- Test: `__tests__/tracking/ga4.test.ts`

**Interfaces:**
- Consumes: `centavosToPesos` from `@/lib/tracking/currency` (Task 1)
- Produces: `interface Ga4Item { item_id: string; item_name: string; price: number; quantity?: number; item_category?: string }`, `buildGa4Item(product: { id: string; name: string; category: string }, priceCentavos: number, quantity?: number): Ga4Item`, `trackViewItem(product, priceCentavos): void`, `trackAddToCart(product, priceCentavos, quantity?): void`, `trackBeginCheckout(items: Ga4Item[], valueCentavos: number): void`, `trackPurchase(args: { transactionId: string; valueCentavos: number; items: Ga4Item[] }): void`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/tracking/ga4.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildGa4Item, trackViewItem, trackPurchase } from '../../lib/tracking/ga4'

describe('buildGa4Item', () => {
  it('converts price to pesos and defaults quantity to 1', () => {
    const item = buildGa4Item({ id: 'p1', name: 'Ramen', category: 'noodles' }, 15000)
    expect(item).toEqual({
      item_id: 'p1',
      item_name: 'Ramen',
      price: 150,
      quantity: 1,
      item_category: 'noodles',
    })
  })
})

describe('trackViewItem', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when window.gtag is unavailable', () => {
    vi.stubGlobal('window', {})
    expect(() => trackViewItem({ id: 'p1', name: 'Ramen', category: 'noodles' }, 15000)).not.toThrow()
  })

  it('calls window.gtag with view_item event', () => {
    const gtag = vi.fn()
    vi.stubGlobal('window', { gtag })
    trackViewItem({ id: 'p1', name: 'Ramen', category: 'noodles' }, 15000)
    expect(gtag).toHaveBeenCalledWith('event', 'view_item', {
      currency: 'MXN',
      value: 150,
      items: [{ item_id: 'p1', item_name: 'Ramen', price: 150, quantity: 1, item_category: 'noodles' }],
    })
  })
})

describe('trackPurchase', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls window.gtag with purchase event and transaction_id', () => {
    const gtag = vi.fn()
    vi.stubGlobal('window', { gtag })
    trackPurchase({
      transactionId: 'order-1',
      valueCentavos: 20000,
      items: [{ item_id: 'p1', item_name: 'Ramen', price: 150, quantity: 1 }],
    })
    expect(gtag).toHaveBeenCalledWith('event', 'purchase', {
      transaction_id: 'order-1',
      currency: 'MXN',
      value: 200,
      items: [{ item_id: 'p1', item_name: 'Ramen', price: 150, quantity: 1 }],
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/tracking/ga4.test.ts`
Expected: FAIL with "Cannot find module '../../lib/tracking/ga4'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/tracking/ga4.ts
'use client'

import { centavosToPesos } from './currency'

type GtagFn = (...args: unknown[]) => void

declare global {
  interface Window {
    gtag?: GtagFn
  }
}

export interface Ga4Item {
  item_id: string
  item_name: string
  price: number
  quantity?: number
  item_category?: string
}

interface TrackableProduct {
  id: string
  name: string
  category?: string
}

function callGtag(...args: unknown[]): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  try {
    window.gtag(...args)
  } catch {
    // tracking must never break the app
  }
}

export function buildGa4Item(product: TrackableProduct, priceCentavos: number, quantity = 1): Ga4Item {
  return {
    item_id: product.id,
    item_name: product.name,
    price: centavosToPesos(priceCentavos),
    quantity,
    item_category: product.category,
  }
}

export function trackViewItem(product: TrackableProduct, priceCentavos: number): void {
  callGtag('event', 'view_item', {
    currency: 'MXN',
    value: centavosToPesos(priceCentavos),
    items: [buildGa4Item(product, priceCentavos)],
  })
}

export function trackAddToCart(product: TrackableProduct, priceCentavos: number, quantity = 1): void {
  callGtag('event', 'add_to_cart', {
    currency: 'MXN',
    value: centavosToPesos(priceCentavos * quantity),
    items: [buildGa4Item(product, priceCentavos, quantity)],
  })
}

export function trackBeginCheckout(items: Ga4Item[], valueCentavos: number): void {
  callGtag('event', 'begin_checkout', {
    currency: 'MXN',
    value: centavosToPesos(valueCentavos),
    items,
  })
}

export function trackPurchase(args: { transactionId: string; valueCentavos: number; items: Ga4Item[] }): void {
  callGtag('event', 'purchase', {
    transaction_id: args.transactionId,
    currency: 'MXN',
    value: centavosToPesos(args.valueCentavos),
    items: args.items,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/tracking/ga4.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/tracking/ga4.ts __tests__/tracking/ga4.test.ts
git commit -m "feat: add GA4 ecommerce event helpers"
```

---

### Task 5: Meta Pixel event helpers

**Files:**
- Create: `lib/tracking/meta-pixel.ts`
- Test: `__tests__/tracking/meta-pixel.test.ts`

**Interfaces:**
- Consumes: `centavosToPesos` from `@/lib/tracking/currency` (Task 1)
- Produces: `trackPageView(): void`, `trackViewContent(product: { id: string; name: string }, priceCentavos: number): void`, `trackAddToCart(product: { id: string; name: string }, priceCentavos: number, quantity?: number): void`, `trackInitiateCheckout(contentIds: string[], valueCentavos: number): void`, `trackPurchase(args: { eventId: string; contentIds: string[]; valueCentavos: number }): void`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/tracking/meta-pixel.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { trackViewContent, trackPurchase } from '../../lib/tracking/meta-pixel'

describe('trackViewContent', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when window.fbq is unavailable', () => {
    vi.stubGlobal('window', {})
    expect(() => trackViewContent({ id: 'p1', name: 'Ramen' }, 15000)).not.toThrow()
  })

  it('calls window.fbq with ViewContent event', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq })
    trackViewContent({ id: 'p1', name: 'Ramen' }, 15000)
    expect(fbq).toHaveBeenCalledWith('track', 'ViewContent', {
      content_ids: ['p1'],
      content_name: 'Ramen',
      content_type: 'product',
      currency: 'MXN',
      value: 150,
    })
  })
})

describe('trackPurchase', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls window.fbq with Purchase event and eventID for dedup', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq })
    trackPurchase({ eventId: 'purchase_order-1', contentIds: ['p1'], valueCentavos: 20000 })
    expect(fbq).toHaveBeenCalledWith(
      'track',
      'Purchase',
      { content_ids: ['p1'], content_type: 'product', currency: 'MXN', value: 200 },
      { eventID: 'purchase_order-1' }
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/tracking/meta-pixel.test.ts`
Expected: FAIL with "Cannot find module '../../lib/tracking/meta-pixel'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/tracking/meta-pixel.ts
'use client'

import { centavosToPesos } from './currency'

type FbqFn = (...args: unknown[]) => void

declare global {
  interface Window {
    fbq?: FbqFn
  }
}

interface TrackableProduct {
  id: string
  name: string
}

function callFbq(...args: unknown[]): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  try {
    window.fbq(...args)
  } catch {
    // tracking must never break the app
  }
}

export function trackPageView(): void {
  callFbq('track', 'PageView')
}

export function trackViewContent(product: TrackableProduct, priceCentavos: number): void {
  callFbq('track', 'ViewContent', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    currency: 'MXN',
    value: centavosToPesos(priceCentavos),
  })
}

export function trackAddToCart(product: TrackableProduct, priceCentavos: number, quantity = 1): void {
  callFbq('track', 'AddToCart', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    currency: 'MXN',
    value: centavosToPesos(priceCentavos * quantity),
  })
}

export function trackInitiateCheckout(contentIds: string[], valueCentavos: number): void {
  callFbq('track', 'InitiateCheckout', {
    content_ids: contentIds,
    content_type: 'product',
    currency: 'MXN',
    value: centavosToPesos(valueCentavos),
  })
}

export function trackPurchase(args: { eventId: string; contentIds: string[]; valueCentavos: number }): void {
  callFbq(
    'track',
    'Purchase',
    {
      content_ids: args.contentIds,
      content_type: 'product',
      currency: 'MXN',
      value: centavosToPesos(args.valueCentavos),
    },
    { eventID: args.eventId }
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/tracking/meta-pixel.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/tracking/meta-pixel.ts __tests__/tracking/meta-pixel.test.ts
git commit -m "feat: add Meta Pixel event helpers with CAPI dedup support"
```

---

### Task 6: Clarity helper

**Files:**
- Create: `lib/tracking/clarity.ts`
- Test: `__tests__/tracking/clarity.test.ts`

**Interfaces:**
- Produces: `identifyClarityUser(userId: string): void`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/tracking/clarity.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { identifyClarityUser } from '../../lib/tracking/clarity'

describe('identifyClarityUser', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when window.clarity is unavailable', () => {
    vi.stubGlobal('window', {})
    expect(() => identifyClarityUser('user-1')).not.toThrow()
  })

  it('calls window.clarity with identify', () => {
    const clarity = vi.fn()
    vi.stubGlobal('window', { clarity })
    identifyClarityUser('user-1')
    expect(clarity).toHaveBeenCalledWith('identify', 'user-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/tracking/clarity.test.ts`
Expected: FAIL with "Cannot find module '../../lib/tracking/clarity'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/tracking/clarity.ts
'use client'

type ClarityFn = (...args: unknown[]) => void

declare global {
  interface Window {
    clarity?: ClarityFn
  }
}

export function identifyClarityUser(userId: string): void {
  if (typeof window === 'undefined' || typeof window.clarity !== 'function') return
  try {
    window.clarity('identify', userId)
  } catch {
    // tracking must never break the app
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/tracking/clarity.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/tracking/clarity.ts __tests__/tracking/clarity.test.ts
git commit -m "feat: add Microsoft Clarity identify helper"
```

---

### Task 7: TrackingScripts component + env vars + CSP

**Files:**
- Create: `components/tracking/TrackingScripts.tsx`
- Modify: `.env.example`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `useConsent` from `@/components/consent/ConsentProvider` (Task 3)
- Produces: `TrackingScripts()` — renders `next/script` tags for GA4, Meta Pixel, Clarity, gated by `consent === 'accepted'` and the presence of each env var

- [ ] **Step 1: Write TrackingScripts**

```typescript
// components/tracking/TrackingScripts.tsx
'use client'

import Script from 'next/script'
import { useConsent } from '@/components/consent/ConsentProvider'

export function TrackingScripts() {
  const { consent } = useConsent()
  if (consent !== 'accepted') return null

  const ga4Id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID

  return (
    <>
      {ga4Id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga4Id}');`}
          </Script>
        </>
      )}

      {metaPixelId && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId}');
            fbq('track', 'PageView');`}
        </Script>
      )}

      {clarityId && (
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarityId}");`}
        </Script>
      )}
    </>
  )
}
```

- [ ] **Step 2: Add env vars**

Modify `.env.example`, after the `NEXT_PUBLIC_ENABLE_ANALYTICS=true` line:

```
# Google Analytics 4 (opcional — deja vacío para desactivar)
NEXT_PUBLIC_GA4_MEASUREMENT_ID=

# Meta Pixel + Conversions API (opcional — deja vacío para desactivar)
NEXT_PUBLIC_META_PIXEL_ID=
META_CONVERSIONS_API_TOKEN=

# Microsoft Clarity (opcional — deja vacío para desactivar)
NEXT_PUBLIC_CLARITY_PROJECT_ID=
```

- [ ] **Step 3: Update CSP in next.config.ts**

In `next.config.ts`, replace the `script-src` and `connect-src` lines inside `securityHeaders`:

```typescript
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com https://www.googletagmanager.com https://connect.facebook.net https://www.clarity.ms",
      "style-src 'self' 'unsafe-inline'",
      // Supabase storage for images, Stripe iframes, GA4/Meta/Clarity beacons
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} https://api.stripe.com wss://*.supabase.co https://www.google-analytics.com https://www.facebook.com https://www.clarity.ms`,
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. With `NEXT_PUBLIC_GA4_MEASUREMENT_ID` left blank in `.env.local`, confirm no GA4 script tag appears in the page source after accepting consent (integration self-disables). No CSP violations should appear in the browser console for `googletagmanager.com`, `connect.facebook.net`, or `clarity.ms` once IDs are set (can be verified later once real IDs exist — for now confirm no CSP errors for the existing Stripe/Supabase script/connect sources, i.e. the CSP edit didn't break anything already working).

- [ ] **Step 5: Commit**

```bash
git add components/tracking/TrackingScripts.tsx .env.example next.config.ts
git commit -m "feat: add consent-gated GA4/Meta Pixel/Clarity script loader"
```

---

### Task 8: Wire consent + tracking scripts into the public layout

**Files:**
- Modify: `app/(public)/layout.tsx`

**Interfaces:**
- Consumes: `ConsentProvider` (Task 3), `ConsentBanner` (Task 3), `TrackingScripts` (Task 7)

- [ ] **Step 1: Update the layout**

```typescript
// app/(public)/layout.tsx
import { Suspense } from 'react'
import { Header } from '@/components/layout/Header'
import { ConditionalFooter } from '@/components/layout/ConditionalFooter'
import { CartDrawer } from '@/components/carrito/CartDrawer'
import { CartFlightLayer } from '@/components/carrito/CartFlightLayer'
import { ReferralTracker } from '@/components/ReferralTracker'
import { StoreCheckoutProvider } from '@/components/providers/StoreCheckoutProvider'
import { ConsentProvider } from '@/components/consent/ConsentProvider'
import { ConsentBanner } from '@/components/consent/ConsentBanner'
import { TrackingScripts } from '@/components/tracking/TrackingScripts'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConsentProvider>
      <StoreCheckoutProvider>
        <Suspense fallback={null}>
          <ReferralTracker />
        </Suspense>
        <Header />
        <main className="flex-1">{children}</main>
        <ConditionalFooter />
        <CartDrawer />
        <CartFlightLayer />
        <ConsentBanner />
        <TrackingScripts />
      </StoreCheckoutProvider>
    </ConsentProvider>
  )
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, visit `http://localhost:3500/`. Confirm the page renders normally (no hydration errors in console), the consent banner appears, and the site behaves exactly as before otherwise.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/layout.tsx"
git commit -m "feat: wire consent provider and tracking scripts into public layout"
```

---

### Task 9: Meta Conversions API server helper

**Files:**
- Create: `lib/server/meta-capi.ts`
- Test: `__tests__/server/meta-capi.test.ts`

**Interfaces:**
- Produces: `normalizeEmail(email: string): string`, `normalizePhone(phone: string): string`, `hashEmail(email: string): string`, `hashPhone(phone: string): string`, `interface MetaCapiUserData { email?: string | null; phone?: string | null; clientIpAddress?: string | null; clientUserAgent?: string | null; fbp?: string | null; fbc?: string | null }`, `interface MetaCapiPurchaseInput { orderId: string; eventId: string; eventSourceUrl: string; valuePesos: number; currency: string; contentIds: string[]; userData: MetaCapiUserData }`, `sendMetaPurchaseEvent(input: MetaCapiPurchaseInput): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/server/meta-capi.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizeEmail, normalizePhone, hashEmail, hashPhone, sendMetaPurchaseEvent } from '../../lib/server/meta-capi'
import { createHash } from 'crypto'

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Test@Example.COM ')).toBe('test@example.com')
  })
})

describe('normalizePhone', () => {
  it('strips non-digits and adds MX country code for 10-digit numbers', () => {
    expect(normalizePhone('(55) 1234-5678')).toBe('5255123 45678'.replace(/\s/g, ''))
  })

  it('leaves already-prefixed numbers unchanged', () => {
    expect(normalizePhone('+52 55 1234 5678')).toBe('525512345678')
  })

  it('strips leading zeros', () => {
    expect(normalizePhone('0445512345678')).toBe('445512345678')
  })
})

describe('hashEmail / hashPhone', () => {
  it('returns sha256 hex of the normalized value', () => {
    expect(hashEmail('Test@Example.com')).toBe(createHash('sha256').update('test@example.com').digest('hex'))
    expect(hashPhone('5512345678')).toBe(createHash('sha256').update('525512345678').digest('hex'))
  })
})

describe('sendMetaPurchaseEvent', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '')
    vi.stubEnv('META_CONVERSIONS_API_TOKEN', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('no-ops and returns ok:true when env vars are unset', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await sendMetaPurchaseEvent({
      orderId: 'order-1',
      eventId: 'purchase_order-1',
      eventSourceUrl: 'https://nurei.mx/pedido/order-1',
      valuePesos: 200,
      currency: 'MXN',
      contentIds: ['p1'],
      userData: {},
    })
    expect(result).toEqual({ ok: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('posts to the Graph API v25.0 events endpoint when configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', 'pixel-123')
    vi.stubEnv('META_CONVERSIONS_API_TOKEN', 'token-abc')
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, text: async () => '' } as Response)

    const result = await sendMetaPurchaseEvent({
      orderId: 'order-1',
      eventId: 'purchase_order-1',
      eventSourceUrl: 'https://nurei.mx/pedido/order-1',
      valuePesos: 200,
      currency: 'MXN',
      contentIds: ['p1'],
      userData: { email: 'Test@Example.com', clientIpAddress: '1.2.3.4', clientUserAgent: 'UA' },
    })

    expect(result).toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, options] = fetchSpy.mock.calls[0]
    expect(String(url)).toBe('https://graph.facebook.com/v25.0/pixel-123/events?access_token=token-abc')
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.data[0].event_name).toBe('Purchase')
    expect(body.data[0].event_id).toBe('purchase_order-1')
    expect(body.data[0].action_source).toBe('website')
    expect(body.data[0].user_data.em).toEqual([hashEmail('Test@Example.com')])
    expect(body.data[0].user_data.client_ip_address).toBe('1.2.3.4')
    expect(body.data[0].custom_data.value).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/server/meta-capi.test.ts`
Expected: FAIL with "Cannot find module '../../lib/server/meta-capi'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/server/meta-capi.ts
import { createHash } from 'crypto'

const GRAPH_API_VERSION = 'v25.0'

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '')
  return digits.length === 10 ? `52${digits}` : digits
}

export function hashEmail(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex')
}

export function hashPhone(phone: string): string {
  return createHash('sha256').update(normalizePhone(phone)).digest('hex')
}

export interface MetaCapiUserData {
  email?: string | null
  phone?: string | null
  clientIpAddress?: string | null
  clientUserAgent?: string | null
  fbp?: string | null
  fbc?: string | null
}

export interface MetaCapiPurchaseInput {
  orderId: string
  eventId: string
  eventSourceUrl: string
  valuePesos: number
  currency: string
  contentIds: string[]
  userData: MetaCapiUserData
}

export async function sendMetaPurchaseEvent(
  input: MetaCapiPurchaseInput
): Promise<{ ok: boolean; error?: string }> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN?.trim()
  if (!pixelId || !accessToken) return { ok: true }

  const { orderId, eventId, eventSourceUrl, valuePesos, currency, contentIds, userData } = input

  const user_data: Record<string, unknown> = {}
  if (userData.email) user_data.em = [hashEmail(userData.email)]
  if (userData.phone) user_data.ph = [hashPhone(userData.phone)]
  if (userData.clientIpAddress) user_data.client_ip_address = userData.clientIpAddress
  if (userData.clientUserAgent) user_data.client_user_agent = userData.clientUserAgent
  if (userData.fbp) user_data.fbp = userData.fbp
  if (userData.fbc) user_data.fbc = userData.fbc

  const body = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: eventSourceUrl,
        action_source: 'website',
        user_data,
        custom_data: {
          currency,
          value: valuePesos,
          content_ids: contentIds,
          order_id: orderId,
        },
      },
    ],
  }

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      return { ok: false, error: `Meta CAPI ${response.status}: ${await response.text()}` }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Meta CAPI request failed' }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/server/meta-capi.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/server/meta-capi.ts __tests__/server/meta-capi.test.ts
git commit -m "feat: add Meta Conversions API server helper with PII hashing"
```

---

### Task 10: Capture fbp/fbc + IP/UA into Stripe checkout metadata

**Files:**
- Modify: `app/api/payment/create-checkout/route.ts`

**Interfaces:**
- Produces: Stripe session metadata now includes `fbp`, `fbc`, `client_ip`, `client_ua` (all optional, empty string when absent — Stripe metadata values must be strings)

- [ ] **Step 1: Add capture logic and extend metadata**

In `app/api/payment/create-checkout/route.ts`, after the existing `referralLinkId` line (currently line 63), add:

```typescript
    // Forward referral cookie so webhook can attribute the order
    const referralLinkId = request.cookies.get('_nurei_ref')?.value ?? null

    // Meta Pixel sets these first-party cookies automatically once loaded (consent-gated).
    // Forwarded to the webhook so server-side Conversions API can match/dedupe with the browser pixel.
    const fbp = request.cookies.get('_fbp')?.value ?? ''
    const fbc = request.cookies.get('_fbc')?.value ?? ''
    const clientIp =
      request.headers.get('x-real-ip') ??
      request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ??
      ''
    const clientUa = request.headers.get('user-agent') ?? ''
```

Then extend both `metadata` objects (the one inside `payment_intent_data` and the top-level `metadata`, currently lines 71-76 and 89-94) to include the new fields:

```typescript
      payment_intent_data: {
        metadata: {
          order_id: order.id,
          short_id: order.short_id,
          customer_name: order.customer_name ?? '',
          ...(referralLinkId ? { referral_link_id: referralLinkId } : {}),
          ...(fbp ? { fbp } : {}),
          ...(fbc ? { fbc } : {}),
          ...(clientIp ? { client_ip: clientIp } : {}),
          ...(clientUa ? { client_ua: clientUa } : {}),
        },
      },
      ...(order.coupon_discount > 0
        ? {
            discounts: [
              {
                coupon: await getOrCreateStripeCoupon(stripe, order.coupon_discount, order.id),
              },
            ],
          }
        : {}),
      success_url: `${appUrl}/pedido/${order.id}?success=true&token=${order.public_access_token}`,
      cancel_url: `${appUrl}/checkout?step=3`,
      metadata: {
        order_id: order.id,
        short_id: order.short_id,
        customer_name: order.customer_name,
        ...(referralLinkId ? { referral_link_id: referralLinkId } : {}),
        ...(fbp ? { fbp } : {}),
        ...(fbc ? { fbc } : {}),
        ...(clientIp ? { client_ip: clientIp } : {}),
        ...(clientUa ? { client_ua: clientUa } : {}),
      },
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`. Use the Stripe CLI or dashboard test mode to start a checkout with `document.cookie` containing a fake `_fbp=fb.1.123.456` value set before hitting checkout, and confirm (via `stripe.checkout.sessions.retrieve` in the Stripe dashboard, or a temporary `console.error` removed after checking) that `session.metadata.fbp` is populated. Remove any temporary debug logging before committing.

- [ ] **Step 3: Commit**

```bash
git add app/api/payment/create-checkout/route.ts
git commit -m "feat: forward Meta click/browser IDs and client IP/UA to Stripe metadata"
```

---

### Task 11: Fire Meta CAPI Purchase from the Stripe webhook

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Consumes: `sendMetaPurchaseEvent` from `@/lib/server/meta-capi` (Task 9), `centavosToPesos` from `@/lib/tracking/currency` (Task 1)

- [ ] **Step 1: Extend the order query and add the CAPI call**

In `app/api/webhooks/stripe/route.ts`, the `checkout.session.completed` case currently ends with (lines 63-77):

```typescript
        const { data: order } = await supabase
          .from('orders')
          .select('total, coupon_code')
          .eq('id', orderId)
          .single()

        if (order) {
          void executeAffiliateAttribution({
            orderId,
            couponCode: order.coupon_code ?? null,
            cookieHeader: session.metadata?.referral_link_id
              ? `_nurei_ref=${session.metadata.referral_link_id}`
              : null,
          }).catch(() => {})
        }
        break
      }
```

Replace it with:

```typescript
        const { data: order } = await supabase
          .from('orders')
          .select('total, coupon_code, customer_email, customer_phone, items')
          .eq('id', orderId)
          .single()

        if (order) {
          void executeAffiliateAttribution({
            orderId,
            couponCode: order.coupon_code ?? null,
            cookieHeader: session.metadata?.referral_link_id
              ? `_nurei_ref=${session.metadata.referral_link_id}`
              : null,
          }).catch(() => {})

          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const orderItems = (order.items as Array<{ product_id: string }>) ?? []
          void sendMetaPurchaseEvent({
            orderId,
            eventId: `purchase_${orderId}`,
            eventSourceUrl: `${appUrl}/pedido/${orderId}`,
            valuePesos: centavosToPesos(order.total),
            currency: 'MXN',
            contentIds: orderItems.map((item) => item.product_id),
            userData: {
              email: order.customer_email ?? undefined,
              phone: order.customer_phone ?? undefined,
              fbp: session.metadata?.fbp ?? undefined,
              fbc: session.metadata?.fbc ?? undefined,
              clientIpAddress: session.metadata?.client_ip ?? undefined,
              clientUserAgent: session.metadata?.client_ua ?? undefined,
            },
          }).catch(() => {})
        }
        break
      }
```

- [ ] **Step 2: Add the import**

At the top of `app/api/webhooks/stripe/route.ts`, add alongside the existing imports:

```typescript
import { sendMetaPurchaseEvent } from '@/lib/server/meta-capi'
import { centavosToPesos } from '@/lib/tracking/currency'
```

- [ ] **Step 3: Run the existing webhook-adjacent test suite (if any) and typecheck**

Run: `npx tsc --noEmit`
Expected: No new type errors introduced by this change.

- [ ] **Step 4: Manual verification**

With `NEXT_PUBLIC_META_PIXEL_ID` and `META_CONVERSIONS_API_TOKEN` set to real test values, complete a full Stripe test-mode checkout locally (using the Stripe CLI to forward webhooks: `stripe listen --forward-to localhost:3500/api/webhooks/stripe`), then check Meta Events Manager → Test Events for the account, and confirm a `Purchase` event with the correct `order_id` in `custom_data` arrives within a minute.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/stripe/route.ts
git commit -m "feat: fire Meta Conversions API Purchase event from Stripe webhook"
```

---

### Task 12: view_item / ViewContent on product detail page

**Files:**
- Modify: `app/(public)/producto/[slug]/ProductDetailClient.tsx`

**Interfaces:**
- Consumes: `trackViewItem` from `@/lib/tracking/ga4` (Task 4), `trackViewContent` from `@/lib/tracking/meta-pixel` (Task 5)

- [ ] **Step 1: Add the tracking call**

In `app/(public)/producto/[slug]/ProductDetailClient.tsx`, add to the imports:

```typescript
import { trackViewItem } from '@/lib/tracking/ga4'
import { trackViewContent } from '@/lib/tracking/meta-pixel'
```

Add a new `useEffect` right after the component receives `product` (near the existing `useEffect` at line 92), firing once per mount:

```typescript
  useEffect(() => {
    const priceCentavos = product.base_price ?? product.price
    trackViewItem({ id: product.id, name: product.name, category: product.category }, priceCentavos)
    trackViewContent({ id: product.id, name: product.name }, priceCentavos)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per product page view
  }, [product.id])
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, visit a product detail page with consent accepted and `window.gtag`/`window.fbq` stubbed via the browser console (e.g. `window.gtag = console.log`), confirm the `view_item` call logs with the expected product data.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/producto/[slug]/ProductDetailClient.tsx"
git commit -m "feat: track view_item/ViewContent on product detail page"
```

---

### Task 13: add_to_cart / AddToCart from the cart store

**Files:**
- Modify: `lib/stores/cart.ts`

**Interfaces:**
- Consumes: `trackAddToCart` from `@/lib/tracking/ga4` (Task 4) and `@/lib/tracking/meta-pixel` (Task 5)

- [ ] **Step 1: Add the tracking calls inside addItem**

In `lib/stores/cart.ts`, add to the imports:

```typescript
import { trackAddToCart as trackGa4AddToCart } from '@/lib/tracking/ga4'
import { trackAddToCart as trackMetaAddToCart } from '@/lib/tracking/meta-pixel'
```

Modify the `addItem` action (currently lines 35-59) to fire tracking after computing the item, before `set`:

```typescript
      addItem: (product: Product, variant?: Pick<ProductVariant, 'id' | 'name' | 'image' | 'price'> | null) => {
        const priceCentavos = variant?.price ?? product.base_price ?? product.price
        trackGa4AddToCart({ id: product.id, name: product.name, category: product.category }, priceCentavos)
        trackMetaAddToCart({ id: product.id, name: product.name }, priceCentavos)

        set((state) => {
          const existing = state.items.find((item) =>
            itemMatches(item, product.id, variant?.id)
          )
          if (existing) {
            return {
              items: state.items.map((item) =>
                itemMatches(item, product.id, variant?.id)
                  ? { ...item, quantity: item.quantity + 1 }
                  : item
              ),
            }
          }
          const newItem: CartItem = {
            product,
            quantity: 1,
            variant_id: variant?.id ?? null,
            variant_label: variant?.name ?? null,
            variant_image: variant?.image ?? null,
            variant_price: variant?.price ?? null,
          }
          return { items: [...state.items, newItem] }
        })
      },
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, add a product to the cart with consent accepted and `window.gtag`/`window.fbq` stubbed to `console.log`. Confirm `add_to_cart`/`AddToCart` fires exactly once per click, with the correct product id/name/price.

- [ ] **Step 3: Commit**

```bash
git add lib/stores/cart.ts
git commit -m "feat: track add_to_cart/AddToCart from cart store addItem"
```

---

### Task 14: begin_checkout / InitiateCheckout on checkout step 2→3 transition

**Files:**
- Modify: `app/(public)/checkout/page.tsx`

**Interfaces:**
- Consumes: `trackBeginCheckout`, `Ga4Item` from `@/lib/tracking/ga4` (Task 4); `trackInitiateCheckout` from `@/lib/tracking/meta-pixel` (Task 5)

- [ ] **Step 1: Add the tracking call**

In `app/(public)/checkout/page.tsx`, add to the imports:

```typescript
import { trackBeginCheckout, buildGa4Item } from '@/lib/tracking/ga4'
import { trackInitiateCheckout } from '@/lib/tracking/meta-pixel'
```

In `handleContinue`, inside the `if (activeStep === 2)` branch (currently lines 698-705), fire tracking right before `goToStep(3)`:

```typescript
    if (activeStep === 2) {
      if (!validateShippingStep()) {
        triggerPanelShake()
        return
      }
      const ga4Items = items.map((item) =>
        buildGa4Item(
          { id: item.product.id, name: item.product.name, category: item.product.category },
          item.variant_price ?? item.product.base_price ?? item.product.price,
          item.quantity
        )
      )
      trackBeginCheckout(ga4Items, subtotal)
      trackInitiateCheckout(items.map((item) => item.product.id), subtotal)
      goToStep(3)
      return
    }
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, add items to cart, go through checkout to the payment step (step 3) with `window.gtag`/`window.fbq` stubbed to `console.log`. Confirm `begin_checkout`/`InitiateCheckout` fires exactly once with the correct item list and subtotal.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/checkout/page.tsx"
git commit -m "feat: track begin_checkout/InitiateCheckout on payment step entry"
```

---

### Task 15: purchase / Purchase on the order tracking page

**Files:**
- Modify: `app/(public)/pedido/[id]/page.tsx`

**Interfaces:**
- Consumes: `trackPurchase`, `buildGa4Item` from `@/lib/tracking/ga4` (Task 4); `trackPurchase` from `@/lib/tracking/meta-pixel` (Task 5, aliased to avoid name collision)

- [ ] **Step 1: Add the tracking effect**

In `app/(public)/pedido/[id]/page.tsx`, add to the imports:

```typescript
import { trackPurchase as trackGa4Purchase, buildGa4Item } from '@/lib/tracking/ga4'
import { trackPurchase as trackMetaPurchase } from '@/lib/tracking/meta-pixel'
```

Add a new effect right after the cart-clearing effect (currently lines 286-292), mirroring its idempotency-guard pattern:

```typescript
  // Fire client-side purchase tracking once per order, the moment it's confirmed
  // paid — covers every payment method that lands here with payment_status='paid',
  // not just the Stripe success=true redirect. Deduplicated server-side against
  // Meta CAPI (Stripe path only) via the shared event_id.
  useEffect(() => {
    if (!order || order.payment_status !== 'paid') return
    const flagKey = `nurei-purchase-tracked-${order.id}`
    if (sessionStorage.getItem(flagKey)) return
    sessionStorage.setItem(flagKey, '1')

    const ga4Items = order.items.map((item) =>
      buildGa4Item({ id: item.product_id, name: item.name, category: '' }, item.unit_price, item.quantity)
    )
    trackGa4Purchase({ transactionId: order.id, valueCentavos: order.total, items: ga4Items })
    trackMetaPurchase({
      eventId: `purchase_${order.id}`,
      contentIds: order.items.map((item) => item.product_id),
      valueCentavos: order.total,
    })
  }, [order])
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, complete a full test checkout (Stripe test card) with consent accepted and `window.gtag`/`window.fbq` stubbed to `console.log` before landing on the order page. Confirm `purchase`/`Purchase` fires exactly once, with `event_id` matching the format `purchase_{order.id}` used by the server-side CAPI call from Task 11 (open two browser tabs pointed at the same paid order to confirm the sessionStorage guard prevents a second fire).

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/pedido/[id]/page.tsx"
git commit -m "feat: track purchase/Purchase on order confirmation page"
```

---

### Task 16: Full test suite + manual QA pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass, including the new `__tests__/tracking/*.test.ts` and `__tests__/server/meta-capi.test.ts` files.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Manual QA checklist**

Document these as follow-up steps for the user (require real account credentials this plan does not have access to):
- Create a GA4 property, set `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, open GA4 DebugView, walk through view_item → add_to_cart → begin_checkout → purchase, confirm each event with correct values.
- Create a Meta Pixel + generate a Conversions API access token (Events Manager → Data Sources → your Pixel → Settings → Conversions API), set `NEXT_PUBLIC_META_PIXEL_ID` and `META_CONVERSIONS_API_TOKEN`, open Events Manager → Test Events, walk through the same flow, confirm the `Purchase` event shows "Deduplicated" (browser + server matched via `event_id`).
- Create a Clarity project, set `NEXT_PUBLIC_CLARITY_PROJECT_ID`, confirm session recordings appear in the Clarity dashboard within a few minutes of a test session.
- Verify the consent banner appears for first-time visitors, and that rejecting it prevents any GA4/Meta/Clarity network requests (check the Network tab for requests to `googletagmanager.com`, `facebook.net`, `clarity.ms` — none should fire after reject).

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "test: verify marketing tracking integrations end to end"
```
