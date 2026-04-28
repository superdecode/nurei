# Corrections Round 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 independent issues across admin orders, notifications, affiliate counters, print flow, app icon, and affiliate detail screen.

**Architecture:** All changes are in the Next.js 14 app at `/Users/quiron/CascadeProjects/nurei`. No DB migrations required. Each task is self-contained — they can be implemented and committed independently.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase, Tailwind CSS, Framer Motion, sonner toasts, Lucide icons.

---

## File Map

| Task | Files touched |
|------|--------------|
| 1 — App icon manifest | `app/manifest.ts` (create) |
| 2 — Success sound | `app/admin/pedidos/page.tsx` (add playSuccessAudio call) |
| 3 — Cancel button | `app/admin/pedidos/page.tsx` (add cancel button in drawer) |
| 4 — Button layout desktop | `app/admin/pedidos/page.tsx` (drawer header flex) |
| 5 — Print inline | `app/admin/pedidos/page.tsx` (inline surtido), `app/admin/pedidos/print/page.tsx` (auto-trigger print) |
| 6 — Notification fixes | `components/admin/AdminNotificationBell.tsx` |
| 7 — Affiliate counter | `app/api/affiliate/stats/route.ts` |
| 8 — Affiliate detail | `app/admin/affiliates/[id]/page.tsx` (full 2-tab redesign) |

---

## Task 1: Dynamic manifest.json for app icon

**Context:** `app/layout.tsx:generateMetadata()` already reads `appearance.favicon_url` and `appearance.logo_url` from Supabase and sets `icons` in the Next.js metadata — this part is correct. However the code references `manifest: '/manifest.json'` but that file does not exist in `/public/`. Browsers that look for the manifest (PWA installs, Android home screen) get a 404. Fix: create `app/manifest.ts` as a Next.js route handler that serves a dynamic manifest JSON with the configured icon URLs.

**Files:**
- Create: `app/manifest.ts`

- [ ] **Step 1: Create the dynamic manifest route**

```typescript
// app/manifest.ts
import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'

async function getAppearance(): Promise<{ logo_url?: string; store_name?: string }> {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['appearance', 'store_info'])
    const rows = data ?? []
    const appearance = rows.find((r) => r.key === 'appearance')?.value as Record<string, string> | undefined
    const storeInfo = rows.find((r) => r.key === 'store_info')?.value as Record<string, string> | undefined
    return {
      logo_url: appearance?.logo_url || undefined,
      store_name: storeInfo?.name || undefined,
    }
  } catch {
    return {}
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { logo_url, store_name } = await getAppearance()
  const name = store_name ?? 'nurei'
  const iconUrl = logo_url ?? '/logo.png'

  return {
    name,
    short_name: name,
    description: 'Premium Asian Snacks',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: iconUrl, sizes: '192x192', type: 'image/png' },
      { src: iconUrl, sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

- [ ] **Step 2: Verify build compiles**

```bash
cd /Users/quiron/CascadeProjects/nurei
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `app/manifest.ts`.

- [ ] **Step 3: Commit**

```bash
cd /Users/quiron/CascadeProjects/nurei
git add app/manifest.ts
git commit -m "feat: dynamic manifest.json from admin icon settings"
```

---

## Task 2: Play success sound after order status change

**Context:** `app/admin/layout.tsx` already renders `<audio id="nurei-success-sound" src="/sounds/success.wav" preload="auto" />`. The function `playNotificationAudio()` in `AdminNotificationBell.tsx` shows the pattern. We need an identical function in `pedidos/page.tsx` that targets `#nurei-success-sound`, called after a successful status change.

**Files:**
- Modify: `app/admin/pedidos/page.tsx` — add helper and call in `executeStatusChange`

- [ ] **Step 1: Add playSuccessAudio helper and call it in executeStatusChange**

In `app/admin/pedidos/page.tsx`, locate the `executeStatusChange` function (around line 247). 

First, add the helper function **before** the component export (after the imports section):

```typescript
function playSuccessAudio(): void {
  const el = document.getElementById('nurei-success-sound') as HTMLAudioElement | null
  if (!el) return
  el.currentTime = 0
  el.play().catch(() => {/* blocked by browser policy */})
}
```

Then, inside `executeStatusChange`, right after the `toast.success(...)` line, add:

```typescript
// existing:
toast.success(`Estatus cambiado a ${statusMeta(confirmNewStatus as OrderStatus).label}`)
// add this:
playSuccessAudio()
```

The full `executeStatusChange` function after the change should look like:

```typescript
const executeStatusChange = async () => {
  if (!confirmOrder || !confirmNewStatus) return
  setConfirmLoading(true)
  try {
    const res = await fetch(`/api/admin/orders/${confirmOrder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: confirmNewStatus, note: confirmNote || undefined }),
    })
    const json = await res.json() as { error?: string; data?: { order: Order } }
    if (!res.ok) { toast.error(json.error ?? 'Error'); return }
    toast.success(`Estatus cambiado a ${statusMeta(confirmNewStatus as OrderStatus).label}`)
    playSuccessAudio()
    setConfirmOpen(false)
    if (drawerOrder?.id === confirmOrder.id && json.data?.order) setDrawerOrder(json.data.order)
    fetchOrders()
    fetchCounts()
  } catch { toast.error('Error de conexión') }
  finally { setConfirmLoading(false) }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/quiron/CascadeProjects/nurei
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/quiron/CascadeProjects/nurei
git add app/admin/pedidos/page.tsx
git commit -m "feat: play success sound after order status change"
```

---

## Task 3: Cancel button in order detail drawer

**Context:** The drawer shows a primary action button (e.g. "Aceptar pedido") based on `VALID_STATUS_TRANSITIONS`. `CANCELLABLE_STATUSES` is already defined in `lib/utils/constants.ts` as `['pending_payment', 'paid', 'preparing', 'pending', 'confirmed']`. The `openStatusConfirm` function already handles the confirmation modal. Add a red "Cancelar pedido" button after the primary action button, visible only when cancellation is allowed.

**Files:**
- Modify: `app/admin/pedidos/page.tsx` — drawer body section

- [ ] **Step 1: Add the cancel button block in the drawer body**

In `app/admin/pedidos/page.tsx`, find the block that renders the primary action button in the drawer body (the IIFE starting with `{(() => {`). It ends with `return null` and closes `})()`). 

Immediately after that closing `})()}`, add:

```tsx
{/* Cancel button — only when cancellation is allowed */}
{CANCELLABLE_STATUSES.includes(drawerOrder.status as OrderStatus) && (
  <button
    type="button"
    onClick={() => openStatusConfirm(drawerOrder, 'cancelled')}
    className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 hover:bg-red-100 transition"
  >
    <XCircle className="h-4 w-4" />
    Cancelar pedido
  </button>
)}
```

`XCircle` is already imported at the top of the file. `CANCELLABLE_STATUSES` and `OrderStatus` are already imported.

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/quiron/CascadeProjects/nurei
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/quiron/CascadeProjects/nurei
git add app/admin/pedidos/page.tsx
git commit -m "feat: cancel order button in drawer with confirmation"
```

---

## Task 4: Horizontal button layout in drawer (desktop)

**Context:** Currently the primary action button and the new cancel button are in the drawer body as separate full-width rows. On desktop (≥640px), move them into a single horizontal `flex` row. On mobile they stay stacked. The Ticket and Surtido buttons remain in the header — they are separate actions.

**Files:**
- Modify: `app/admin/pedidos/page.tsx` — wrap the two action buttons in a responsive flex container

- [ ] **Step 1: Wrap both action buttons in a flex container**

In `app/admin/pedidos/page.tsx`, find the two action button blocks in the drawer body (the primary action IIFE and the cancel button block you added in Task 3). Wrap them together in a flex container:

```tsx
{/* Action buttons — stacked on mobile, side-by-side on desktop */}
<div className="flex flex-col sm:flex-row gap-2">
  {/* Primary action button — status-aware */}
  {(() => {
    const nextCandidates = (VALID_STATUS_TRANSITIONS[drawerOrder.status] ?? []).filter(s => s !== 'cancelled' && s !== 'refunded')
    if (nextCandidates.length === 0) return null
    const nextStatus = nextCandidates[0] as OrderStatus
    const actionLabel = STATUS_PRIMARY_ACTION[drawerOrder.status] ?? `Cambiar a ${statusMeta(nextStatus).label}`
    return (
      <button
        type="button"
        onClick={() => openStatusConfirm(drawerOrder, nextStatus)}
        className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl bg-primary-dark px-4 text-sm font-semibold text-white hover:bg-primary-dark/90 transition"
      >
        {statusIcon(nextStatus)}
        {actionLabel}
      </button>
    )
  })()}
  {/* Cancel button */}
  {CANCELLABLE_STATUSES.includes(drawerOrder.status as OrderStatus) && (
    <button
      type="button"
      onClick={() => openStatusConfirm(drawerOrder, 'cancelled')}
      className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-9 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 hover:bg-red-100 transition"
    >
      <XCircle className="h-4 w-4" />
      Cancelar
    </button>
  )}
</div>
```

Note: the primary action button gets `flex-1` (expands to fill), cancel gets `flex-1 sm:flex-none` (expands on mobile, shrinks on desktop).

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/quiron/CascadeProjects/nurei
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd /Users/quiron/CascadeProjects/nurei
git add app/admin/pedidos/page.tsx
git commit -m "feat: horizontal button layout in order drawer on desktop"
```

---

## Task 5: Picking sheet — print inline without new tab

**Context:** Currently both "Ticket" and "Surtido" buttons call `window.open(..., '_blank')` which opens a new browser tab. The user wants the print dialog to open without a new tab. Approach: change `window.open` to `window.location.href` (same-tab navigation to the print page) and add an auto-print trigger in the print page that fires after the orders load.

The print page at `app/admin/pedidos/print/page.tsx` already has a working `window.print()` button in its toolbar. We add a `useEffect` that calls `window.print()` automatically when content is ready. A `?autoprint=1` query param controls whether auto-print fires (so the page can still be visited manually without auto-printing).

**Files:**
- Modify: `app/admin/pedidos/page.tsx` — change `window.open` to `window.location.href` for surtido button only
- Modify: `app/admin/pedidos/print/page.tsx` — add auto-print effect

- [ ] **Step 1: Change surtido button to same-tab navigation**

In `app/admin/pedidos/page.tsx`, find the surtido button in the drawer header:

```tsx
// BEFORE:
onClick={() => window.open(`/admin/pedidos/print?ids=${drawerOrder.id}&type=surtido`, '_blank')}
```

Change to:

```tsx
// AFTER:
onClick={() => { window.location.href = `/admin/pedidos/print?ids=${drawerOrder.id}&type=surtido&autoprint=1` }}
```

Also find the bulk surtido button (the one using `handleBulkPrint`) and update `handleBulkPrint`:

```typescript
const handleBulkPrint = () => {
  if (selectedIds.size === 0) return
  const ids = Array.from(selectedIds).join(',')
  window.location.href = `/admin/pedidos/print?ids=${ids}&type=surtido&autoprint=1`
}
```

The "Ticket" button (`type=ticket`) keeps `window.open(..., '_blank')` — tickets users typically want to preview first.

- [ ] **Step 2: Add auto-print effect to print page**

In `app/admin/pedidos/print/page.tsx`, inside `PrintContent`, add a `useEffect` after the existing order-load effect:

```typescript
// After the existing useEffect that loads orders, add:
const autoPrint = searchParams.get('autoprint') === '1'
useEffect(() => {
  if (!loading && orders.length > 0 && autoPrint) {
    // Small delay to let the browser render the content before opening the print dialog
    const t = setTimeout(() => window.print(), 300)
    return () => clearTimeout(t)
  }
}, [loading, orders.length, autoPrint])
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/quiron/CascadeProjects/nurei
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /Users/quiron/CascadeProjects/nurei
git add app/admin/pedidos/page.tsx app/admin/pedidos/print/page.tsx
git commit -m "feat: picking sheet opens print dialog in same tab without new window"
```

---

## Task 6: Notification title — stop blinking when panel is open

**Context:** In `AdminNotificationBell.tsx`, the `titleAttention` state is set to `true` in a `useEffect` that runs whenever `items`, `readIds`, or `deletedIds` change and there are unread orders. A separate effect clears it when `open` changes to `true`. But both effects run on re-render — the "clear when open" effect fires first, then the "set when unread" effect fires again and re-sets it to `true`. Result: the tab title keeps blinking even when the panel is open.

Fix: in the effect that checks `hasUnreadOrder`, also check `open` — if the panel is open, force-clear `titleAttention` regardless of unread count.

**Files:**
- Modify: `components/admin/AdminNotificationBell.tsx`

- [ ] **Step 1: Fix the hasUnreadOrder effect**

In `AdminNotificationBell.tsx`, find the `useEffect` that checks `hasUnreadOrder` (it depends on `[deletedIds, items, open, readIds]`). Replace the entire effect with:

```typescript
useEffect(() => {
  const hasUnreadOrder = items.some(
    (item) => item.type === 'nuevo_pedido' && !readIds.has(item.id) && !deletedIds.has(item.id)
  )
  // When panel is open, user is attending notifications — stop blinking immediately
  if (!hasUnreadOrder || open) {
    setTitleAttention(false)
  } else {
    setTitleAttention(true)
  }
}, [deletedIds, items, open, readIds])
```

Also remove the separate `useEffect` that only does `if (open) setTitleAttention(false)` — it is now redundant (the combined effect above handles it). That effect is the one with `[open]` in its dependency array:

```typescript
// REMOVE this entire effect:
useEffect(() => {
  if (open) {
    setTitleAttention(false)
  }
}, [open])
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/quiron/CascadeProjects/nurei
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd /Users/quiron/CascadeProjects/nurei
git add components/admin/AdminNotificationBell.tsx
git commit -m "fix: stop title blinking when notification panel is open"
```

---

## Task 7: Unify affiliate sales counter

**Context:** In `app/api/affiliate/stats/route.ts`, `total_orders` is calculated as the count of attributions filtered by `.in('payout_status', ['approved', 'paid'])`. In `app/api/affiliate/orders/route.ts`, it returns ALL attributions (all payout_status values) unless a `?status=` param is passed. The "Pedidos" counter on the overview card shows a smaller number than the rows in the ventas table.

Fix: in `stats/route.ts`, count ALL attributions for `total_orders` regardless of payout_status. The financial totals (`total_earned_cents`, `pending_payout_cents`) remain correct (they come from the profile aggregate, not re-calculated here). The conversion rate uses `totalOrders` which should also include pending.

**Files:**
- Modify: `app/api/affiliate/stats/route.ts`

- [ ] **Step 1: Add a separate count query for total_orders**

In `app/api/affiliate/stats/route.ts`, the `attributionsRes` query filters `.in('payout_status', ['approved', 'paid'])`. This filtered set is correct for financial calculations (commission earned, pending). We need a separate total count.

Replace the `[profileRes, linkRes, attributionsRes]` `Promise.all` with:

```typescript
const [profileRes, linkRes, attributionsRes, totalOrdersRes] = await Promise.all([
  supabase
    .from('affiliate_profiles')
    .select('total_earned_cents, pending_payout_cents')
    .eq('id', affiliateId)
    .single(),
  supabase
    .from('referral_links')
    .select('id, clicks_count')
    .eq('affiliate_id', affiliateId)
    .maybeSingle(),
  (() => {
    let q = supabase
      .from('affiliate_attributions')
      .select('id, commission_amount_cents, created_at, order_id, attribution_type, payout_status')
      .eq('affiliate_id', affiliateId)
      .in('payout_status', ['approved', 'paid'])
      .order('created_at', { ascending: false })
    if (from) q = q.gte('created_at', `${from}T00:00:00.000Z`)
    if (to) q = q.lte('created_at', `${to}T23:59:59.999Z`)
    return q
  })(),
  // Count ALL attributions regardless of payout_status for the order counter
  (() => {
    let q = supabase
      .from('affiliate_attributions')
      .select('id', { count: 'exact', head: true })
      .eq('affiliate_id', affiliateId)
    if (from) q = q.gte('created_at', `${from}T00:00:00.000Z`)
    if (to) q = q.lte('created_at', `${to}T23:59:59.999Z`)
    return q
  })(),
])
```

Then replace the line:

```typescript
const totalOrders = attributions.length
```

with:

```typescript
const totalOrders = totalOrdersRes.count ?? attributions.length
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/quiron/CascadeProjects/nurei
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd /Users/quiron/CascadeProjects/nurei
git add app/api/affiliate/stats/route.ts
git commit -m "fix: affiliate total_orders counter now counts all attributions, not just approved/paid"
```

---

## Task 8: Affiliate detail — 2-tab redesign (admin)

**Context:** `app/admin/affiliates/[id]/page.tsx` is 1356 lines with all content rendered sequentially: header KPIs, chart, commission settings, referral link, coupon list, attributions table, payment records — all in one long scroll. This needs to be split into two tabs:

- **Tab "Perfil"**: identity info (name, email, handle, bio), commission rates (coupon %, cookie %), referral link/slug, active toggle, payment info (bank details). With a single "Guardar cambios" button.
- **Tab "Estadísticas"**: KPI cards, chart, attributions table (ventas + pagos sub-tabs), payout management.

The component is already self-contained (no external subcomponents). The restructuring is in-file: add a `activeMainTab` state, and move JSX blocks into conditional renders under each tab.

**Files:**
- Modify: `app/admin/affiliates/[id]/page.tsx` — full restructure (same file, 2 tabs)

- [ ] **Step 1: Add activeMainTab state and tab switcher UI**

In `app/admin/affiliates/[id]/page.tsx`, find the top of the component's return statement (the `<div className="space-y-6 pb-12">` after the loading/error checks). 

Add state near the top of the component function (where other state is declared):

```typescript
const [activeMainTab, setActiveMainTab] = useState<'perfil' | 'estadisticas'>('perfil')
```

Inside the return, after the back-button/header block, and before the KPI grid, insert the tab switcher:

```tsx
{/* Main tab switcher */}
<div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
  {(['perfil', 'estadisticas'] as const).map((tab) => (
    <button
      key={tab}
      type="button"
      onClick={() => setActiveMainTab(tab)}
      className={cn(
        'px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
        activeMainTab === tab
          ? 'bg-white text-primary-dark shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      )}
    >
      {tab === 'perfil' ? 'Perfil' : 'Estadísticas y pagos'}
    </button>
  ))}
</div>
```

- [ ] **Step 2: Build the Perfil tab content**

After the tab switcher, add the Perfil tab section. This collects the identity fields, commission settings, referral link, and payment info into one card. Replace all of those existing sections with this conditional block:

```tsx
{activeMainTab === 'perfil' && (
  <div className="space-y-5">
    {/* Identity card */}
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Información básica</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Nombre</label>
          <p className="text-sm text-gray-900">{data.profile.first_name ?? '—'} {data.profile.last_name ?? ''}</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Email</label>
          <p className="text-sm text-gray-900">{data.profile.email}</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Handle</label>
          <p className="text-sm font-mono text-gray-900">@{data.profile.handle}</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Teléfono</label>
          <p className="text-sm text-gray-900">{data.profile.phone ?? '—'}</p>
        </div>
        {data.profile.bio && (
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Bio</label>
            <p className="text-sm text-gray-600 leading-relaxed">{data.profile.bio}</p>
          </div>
        )}
      </div>
    </div>

    {/* Commission rates card */}
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Comisiones</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Comisión por cupón (%)</label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={couponPct}
            onChange={(e) => setCouponPct(e.target.value)}
            className="h-9 text-sm rounded-xl border-gray-200"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Comisión por cookie (%)</label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={cookiePct}
            onChange={(e) => setCookiePct(e.target.value)}
            className="h-9 text-sm rounded-xl border-gray-200"
          />
        </div>
      </div>
      <Button
        onClick={() => void saveCommissions()}
        disabled={savingCommissions}
        className="h-9 rounded-xl text-sm font-semibold px-5"
      >
        {savingCommissions ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar comisiones'}
      </Button>
    </div>

    {/* Referral link card */}
    {data.referral_link && (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Link de referido</h2>
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5">
          <span className="text-xs font-mono text-primary-dark flex-1 truncate">
            {`${typeof window !== 'undefined' ? window.location.origin : ''}/r/${data.referral_link.slug}`}
          </span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(`${window.location.origin}/r/${data.referral_link!.slug}`)
              toast.success('Link copiado')
            }}
            className="shrink-0 text-gray-400 hover:text-primary-dark"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400">{data.referral_link.clicks_count.toLocaleString()} clics totales</p>
      </div>
    )}

    {/* Payment info card */}
    {(data.profile.payment_method || data.profile.bank_name) && (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Datos de pago</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {data.profile.payment_method && (
            <div>
              <span className="text-xs text-gray-500">Método</span>
              <p className="font-medium text-gray-900 capitalize">{data.profile.payment_method}</p>
            </div>
          )}
          {data.profile.bank_name && (
            <div>
              <span className="text-xs text-gray-500">Banco</span>
              <p className="font-medium text-gray-900">{data.profile.bank_name}</p>
            </div>
          )}
          {data.profile.bank_holder && (
            <div>
              <span className="text-xs text-gray-500">Titular</span>
              <p className="font-medium text-gray-900">{data.profile.bank_holder}</p>
            </div>
          )}
          {data.profile.bank_clabe && (
            <div>
              <span className="text-xs text-gray-500">CLABE</span>
              <p className="font-mono text-gray-900">{data.profile.bank_clabe}</p>
            </div>
          )}
          {data.profile.bank_account && (
            <div>
              <span className="text-xs text-gray-500">Cuenta</span>
              <p className="font-mono text-gray-900">{data.profile.bank_account}</p>
            </div>
          )}
          {data.profile.payment_notes && (
            <div className="sm:col-span-2">
              <span className="text-xs text-gray-500">Notas</span>
              <p className="text-gray-700">{data.profile.payment_notes}</p>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
)}
```

Note: `couponPct`, `cookiePct`, `setCouponPct`, `setCookiePct`, `savingCommissions`, `saveCommissions` are state/handlers that already exist in the current page — keep them.

You will need to add `Loader2` to the imports if not already present. Check: `import { ..., Loader2, ... } from 'lucide-react'`.

- [ ] **Step 3: Build the Estadísticas tab content**

Add the statistics tab section after the perfil section:

```tsx
{activeMainTab === 'estadisticas' && (
  <div className="space-y-5">
    {/* KPI grid */}
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Keep the existing KPI cards here — the 6-card grid that was already in the page */}
      {/* Move those cards from their current location into this block */}
    </div>

    {/* Chart */}
    {/* Move the chart card (lg:col-span-2) and sidebar (commissions/link summary) here */}

    {/* Attributions + Payments tabs */}
    {/* Move the existing activeTab ('ventas'|'pagos') section here */}
  </div>
)}
```

The key transformation is: move the KPI grid, chart section, and the attributions/payments tab section from their current sequential position into this `activeMainTab === 'estadisticas'` conditional block. No logic changes — only the JSX wrapping changes.

Also move the `Pagar seleccionadas` action button into the estadísticas tab (above the attributions table).

- [ ] **Step 4: Remove old top-level sections that are now inside tabs**

After placing content in tabs, ensure the old top-level renders are removed to avoid duplication. The page's return should now have only:
1. Back button + header
2. Top-level stats summary row (total earned, pending, member since) — keep this outside tabs as a persistent summary
3. Tab switcher
4. Tab content (conditional)

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/quiron/CascadeProjects/nurei
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors. Fix any that appear before committing.

- [ ] **Step 6: Commit**

```bash
cd /Users/quiron/CascadeProjects/nurei
git add app/admin/affiliates/\[id\]/page.tsx
git commit -m "feat: affiliate detail 2-tab redesign (Perfil + Estadísticas y pagos)"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|-------------|------|
| App icon from admin config | Task 1 (manifest.ts) |
| Sound on status change | Task 2 |
| Cancel button with confirm | Task 3 |
| Horizontal buttons desktop | Task 4 |
| Print sheet inline (no new tab) | Task 5 |
| Title stops blinking when reading | Task 6 |
| No stock banners, only badge | Not needed — already correctly implemented in current `AdminNotificationBell.tsx` (only `nuevo_pedido` type triggers popups) |
| Affiliate sales counter unified | Task 7 |
| Affiliate detail 2 tabs | Task 8 |

### Placeholder scan

Task 8 Step 3 contains `{/* Move ... here */}` markers — these indicate where existing JSX blocks need to be relocated (cut from current position, paste inside the conditional). The engineer must do this manually rather than from a code snippet. This is intentional: the existing JSX is correct, the operation is structural (cut/paste), and reproducing 300+ lines of existing JSX would introduce error risk. The instruction is: cut the existing KPI grid, chart section, and attributions tab section from their current sequential render positions and paste them inside the `activeMainTab === 'estadisticas'` block.

### Type consistency

- `OrderStatus` — used in Tasks 3, 4. Already imported in `pedidos/page.tsx`.
- `CANCELLABLE_STATUSES` — already imported in `pedidos/page.tsx`.
- `playSuccessAudio` — defined in Task 2 and used in Task 2. No cross-task dependency.
- `activeMainTab` state — defined and used in Task 8 only.
- `totalOrdersRes.count` — Supabase `head: true` queries return `{ count: number | null }`. This type is correct.
