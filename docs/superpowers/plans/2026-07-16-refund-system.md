# Refund System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a permissioned, auditable refund flow for Nurei orders that executes real money movement (Stripe API refund or manual/transfer acknowledgment), keeps order and affiliate-commission state consistent, and makes refunded/cancelled orders visible to affiliates so fake-order commission fraud is closed.

**Architecture:** A new Postgres RPC (`process_order_refund_atomic`) does the atomic DB write (order + `order_refunds` + affiliate commission adjustment) in one transaction; a thin Next.js API route calls Stripe first (if applicable) then the RPC; a new `reembolsos` admin permission gates who can trigger it; the existing generic status-dropdown path that currently fakes a "refund" is closed off.

**Tech Stack:** Next.js App Router API routes, Supabase Postgres (RPC + RLS), Stripe Node SDK, Resend (email), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-16-refund-system-design.md`

## Global Constraints

- All money fields are integer cents (`_cents` suffix), matching existing convention (`order.total`, `commission_amount_cents`, etc. are already cents — see `lib/utils/format.ts:formatPrice` which divides by 100).
- No `console.log` in shipped code — use `console.error`/`console.warn` for real errors only, matching existing files.
- Reuse `createServiceClient()` for all service-role DB writes (bypasses RLS) — same pattern as `lib/supabase/queries/adminOrders.ts` and `lib/server/affiliate-attribution.ts`.
- Follow the existing DI-friendly style where business logic functions take `supabase: SupabaseClient` as an explicit first parameter (see `updateOrderStatus(supabase, ...)` in `lib/supabase/queries/adminOrders.ts`), keeping permission/auth checks in the route handler, not in the business-logic function — mirrors how `requireAdmin()` is only ever called from route handlers, never from `adminOrders.ts`.
- New pure functions (validation, money math) go in small dedicated files and get direct Vitest unit tests, matching the existing pattern in `lib/affiliate/commission.ts` / `__tests__/affiliate/commission.test.ts` — DB/Stripe-orchestrating wrapper functions are verified via the manual E2E task (Task 17), not mocked unit tests, since no supabase/Stripe test-mocking harness exists anywhere in this repo today.
- `order_refunds.refund_method` CHECK only allows `('stripe', 'cash', 'bank_transfer', 'other')` — there is no `'manual'` value; non-Stripe refunds must resolve to one of `cash`/`bank_transfer`/`other`.

---

## Task 1: Database migration — schema, RPC, permission seed

**Files:**
- Create: `supabase/migrations/050_refund_system.sql`

**Interfaces:**
- Produces: `orders.refunded_amount_cents` (bigint), `orders.refunded_at` (timestamptz), `orders.status` CHECK now includes `'refunded'`, `orders.payment_status` CHECK now includes `'partially_refunded'`.
- Produces: `order_refunds.stripe_refund_id` (text), `order_refunds.status` (text, `pending|succeeded|failed`).
- Produces: `affiliate_attributions.payout_status` CHECK now includes `'clawback_pending'`, `'reversed'`. New column `affiliate_attributions.refund_adjustment_cents` (bigint).
- Produces: `affiliate_profiles.clawback_debt_cents` (bigint).
- Produces: Postgres function `public.process_order_refund_atomic(p_order_id uuid, p_amount_cents bigint, p_reason text, p_refund_method text, p_stripe_refund_id text, p_notes text, p_processed_by uuid) returns uuid` — consumed by Task 7 (`lib/server/process-refund.ts`).
- Produces: `admin_roles.permissions` for `super_admin`/`admin`/`operador`/`consulta` gains a `"reembolsos"` key — consumed by Task 6 (`requireAdminPermission`) and Task 11 (role editor UI).

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================
-- 050: REFUND SYSTEM
-- ============================================

-- ─── orders: widen status/payment_status, add refund tracking columns ──────
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'failed', 'refunded'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded'));

alter table public.orders add column if not exists refunded_amount_cents bigint not null default 0
  check (refunded_amount_cents >= 0);
alter table public.orders add column if not exists refunded_at timestamptz;

-- ─── order_refunds: activate the existing dormant table ────────────────────
alter table public.order_refunds add column if not exists stripe_refund_id text;
alter table public.order_refunds add column if not exists status text not null default 'succeeded'
  check (status in ('pending', 'succeeded', 'failed'));

comment on table public.order_refunds is
  'Refund audit trail. Written by lib/server/process-refund.ts via the service-role client (RLS bypassed), same pattern as affiliate_attributions.';

-- ─── affiliate_attributions: clawback states + adjustment tracking ─────────
alter table public.affiliate_attributions drop constraint if exists affiliate_attributions_payout_status_check;
alter table public.affiliate_attributions add constraint affiliate_attributions_payout_status_check
  check (payout_status in ('pending', 'approved', 'paid', 'clawback_pending', 'reversed'));

alter table public.affiliate_attributions add column if not exists refund_adjustment_cents bigint not null default 0
  check (refund_adjustment_cents >= 0);

-- ─── affiliate_profiles: dedicated debt column ──────────────────────────────
-- Separate from pending_payout_cents on purpose: process_affiliate_payout_atomic
-- (026_affiliate_payout_approved.sql) does `greatest(0, pending_payout_cents - v_total_cents)`.
-- If a clawback pushed pending_payout_cents negative, the next payout would silently
-- clamp it back to 0 and erase the debt. Tracking debt separately avoids that.
alter table public.affiliate_profiles add column if not exists clawback_debt_cents bigint not null default 0
  check (clawback_debt_cents >= 0);

-- ─── commission_payments: allow a $0 payout row (fully absorbed by clawback debt) ───
-- Needed by Task 10's fix to app/api/admin/affiliates/[id]/payments/route.ts, which
-- inserts amount_cents: 0 when a payout is entirely netted against clawback_debt_cents.
alter table public.commission_payments drop constraint if exists commission_payments_amount_cents_check;
alter table public.commission_payments add constraint commission_payments_amount_cents_check
  check (amount_cents >= 0);

-- ─── Seed the 'reembolsos' permission module on existing roles ─────────────
update public.admin_roles
set permissions = permissions || '{"reembolsos": "total"}'::jsonb
where name = 'super_admin';

update public.admin_roles
set permissions = permissions || '{"reembolsos": "sin_acceso"}'::jsonb
where name in ('admin', 'operador', 'consulta');

-- ─── RPC: atomic refund write (order + order_refunds + affiliate ledger) ───
create or replace function public.process_order_refund_atomic(
  p_order_id          uuid,
  p_amount_cents      bigint,
  p_reason            text,
  p_refund_method     text,
  p_stripe_refund_id  text,
  p_notes             text,
  p_processed_by      uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_order          record;
  v_attr           record;
  v_new_refunded   bigint;
  v_new_payment_status text;
  v_refund_id      uuid;
  v_fraction       numeric;
  v_adjustment     bigint;
begin
  select id, total, refunded_amount_cents
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'order_not_found';
  end if;

  if p_amount_cents <= 0 or p_amount_cents > (v_order.total - v_order.refunded_amount_cents) then
    raise exception 'invalid_amount';
  end if;

  insert into public.order_refunds (
    order_id, amount_cents, reason, refund_method, stripe_refund_id, notes, processed_by, status
  ) values (
    p_order_id, p_amount_cents, p_reason, p_refund_method, p_stripe_refund_id, p_notes, p_processed_by, 'succeeded'
  )
  returning id into v_refund_id;

  v_new_refunded := v_order.refunded_amount_cents + p_amount_cents;
  v_new_payment_status := case when v_new_refunded >= v_order.total then 'refunded' else 'partially_refunded' end;

  update public.orders
  set refunded_amount_cents = v_new_refunded,
      payment_status = v_new_payment_status,
      status = case when v_new_payment_status = 'refunded' then 'refunded' else status end,
      refunded_at = case when v_new_payment_status = 'refunded' then now() else refunded_at end,
      updated_at = now()
  where id = p_order_id;

  -- Proportional affiliate commission adjustment (no-op if the order has no attribution)
  select * into v_attr from public.affiliate_attributions where order_id = p_order_id for update;

  if v_attr.id is not null then
    v_fraction := p_amount_cents::numeric / v_order.total::numeric;
    v_adjustment := floor(v_attr.commission_amount_cents * v_fraction);

    if v_attr.payout_status in ('pending', 'approved') then
      update public.affiliate_attributions
      set refund_adjustment_cents = refund_adjustment_cents + v_adjustment,
          payout_status = case
            when (commission_amount_cents - (refund_adjustment_cents + v_adjustment)) <= 0 then 'reversed'
            else payout_status
          end
      where id = v_attr.id;

      update public.affiliate_profiles
      set pending_payout_cents = greatest(0, pending_payout_cents - v_adjustment),
          updated_at = now()
      where id = v_attr.affiliate_id;

    elsif v_attr.payout_status = 'paid' then
      update public.affiliate_attributions
      set refund_adjustment_cents = refund_adjustment_cents + v_adjustment,
          payout_status = 'clawback_pending'
      where id = v_attr.id;

      update public.affiliate_profiles
      set total_earned_cents = greatest(0, total_earned_cents - v_adjustment),
          clawback_debt_cents = clawback_debt_cents + v_adjustment,
          updated_at = now()
      where id = v_attr.affiliate_id;
    end if;
  end if;

  insert into public.order_updates (order_id, status, message, updated_by, metadata)
  values (
    p_order_id,
    v_new_payment_status,
    format('Reembolso de $%s MXN procesado: %s', to_char(p_amount_cents / 100.0, 'FM999999990.00'), p_reason),
    p_processed_by::text,
    jsonb_build_object('type', 'refund', 'amount_cents', p_amount_cents, 'refund_id', v_refund_id)
  );

  return v_refund_id;
end;
$$;

-- ─── Fix the existing (currently unused-by-UI but reachable) payout RPC ────
-- so a clawback debt survives a future payout through this code path too.
-- The admin UI's live payout flow is app/api/admin/affiliates/[id]/payments/route.ts
-- (fixed in Task 10) — this RPC is fixed for defense-in-depth consistency.
create or replace function public.process_affiliate_payout_atomic(
  p_affiliate_id      uuid,
  p_attribution_ids   uuid[],
  p_period_from       date,
  p_period_to         date,
  p_paid_by           uuid,
  p_notes             text
)
returns int
language plpgsql
security definer
as $$
declare
  v_total_cents    int;
  v_attr_ids       uuid[];
  v_clawback_debt  int;
  v_net_payable    int;
begin
  select
    sum(commission_amount_cents - refund_adjustment_cents)::int,
    array_agg(id)
  into v_total_cents, v_attr_ids
  from public.affiliate_attributions
  where id = any(p_attribution_ids)
    and affiliate_id = p_affiliate_id
    and payout_status = 'approved'
  for update;

  if v_total_cents is null or v_total_cents <= 0 then
    return 0;
  end if;

  select clawback_debt_cents into v_clawback_debt
  from public.affiliate_profiles
  where id = p_affiliate_id
  for update;

  v_net_payable := greatest(0, v_total_cents - coalesce(v_clawback_debt, 0));

  insert into public.commission_payments (
    affiliate_id, amount_cents, period_from, period_to,
    attribution_ids, notes, paid_by, paid_at
  ) values (
    p_affiliate_id, v_net_payable, p_period_from, p_period_to,
    v_attr_ids,
    case when v_clawback_debt > 0
      then coalesce(p_notes || ' — ', '') || format('Se descontaron $%s MXN de deuda por reembolso previo.', to_char(least(v_total_cents, v_clawback_debt) / 100.0, 'FM999999990.00'))
      else p_notes
    end,
    p_paid_by, now()
  );

  update public.affiliate_attributions
  set payout_status = 'paid', paid_at = now()
  where id = any(v_attr_ids);

  update public.affiliate_profiles
  set
    pending_payout_cents = greatest(0, pending_payout_cents - v_total_cents),
    total_earned_cents   = total_earned_cents + v_net_payable,
    clawback_debt_cents  = greatest(0, coalesce(v_clawback_debt, 0) - v_total_cents),
    updated_at           = now()
  where id = p_affiliate_id;

  return v_net_payable;
end;
$$;
```

- [ ] **Step 2: Review with the database-reviewer agent**

Dispatch the `database-reviewer` agent on the migration file above before applying it — this migration touches money (refund amounts, commission clawback) and modifies an existing function (`process_affiliate_payout_atomic`), matching the project's convention of reviewing schema changes that touch payments (see spec §11).

- [ ] **Step 3: Apply the migration**

Run: `cd /Users/quiron/CascadeProjects/nurei && supabase db push`
Expected: migration `050_refund_system.sql` applies with no errors; confirm the target project is the linked Nurei Supabase project before confirming the push prompt.

- [ ] **Step 4: Verify the constraint and RPC exist**

Run: `supabase db execute --sql "select conname from pg_constraint where conname = 'orders_status_check'; select proname from pg_proc where proname = 'process_order_refund_atomic';"` (or run the equivalent query from the Supabase SQL editor if the CLI `execute` subcommand isn't available in this environment).
Expected: both rows return.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/050_refund_system.sql
git commit -m "feat: add refund system database schema and RPCs"
```

---

## Task 2: Update TypeScript types

**Files:**
- Modify: `types/index.ts:24` (PaymentStatus), `types/index.ts:41-44` (AdminModule), `types/index.ts:51` (AffiliatePayoutStatus), `types/index.ts:53-64` (AffiliateProfile), `types/index.ts:84-95` (AffiliateAttribution), `types/index.ts:222-263` (Order)

**Interfaces:**
- Consumes: nothing (pure type changes).
- Produces: `PaymentStatus` includes `'partially_refunded'`; `AdminModule` includes `'reembolsos'`; `AffiliatePayoutStatus` includes `'approved' | 'clawback_pending' | 'reversed'`; `Order.refunded_amount_cents: number`, `Order.refunded_at: string | null`; `AffiliateProfile.clawback_debt_cents: number`; `AffiliateAttribution.refund_adjustment_cents: number` — consumed by every later task that touches these interfaces.

- [ ] **Step 1: Update `PaymentStatus` and `AdminModule`**

In `types/index.ts:24`, replace:
```ts
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
```
with:
```ts
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
```

In `types/index.ts:41-44`, replace:
```ts
export type AdminModule =
  | 'dashboard' | 'pedidos' | 'productos' | 'categorias'
  | 'inventario' | 'cupones' | 'multimedia' | 'clientes'
  | 'usuarios' | 'roles' | 'configuracion' | 'analytics' | 'pagos' | 'afiliados'
```
with:
```ts
export type AdminModule =
  | 'dashboard' | 'pedidos' | 'productos' | 'categorias'
  | 'inventario' | 'cupones' | 'multimedia' | 'clientes'
  | 'usuarios' | 'roles' | 'configuracion' | 'analytics' | 'pagos' | 'afiliados'
  | 'reembolsos'
```

- [ ] **Step 2: Update `AffiliatePayoutStatus`, `AffiliateProfile`, `AffiliateAttribution`**

In `types/index.ts:51`, replace:
```ts
export type AffiliatePayoutStatus = 'pending' | 'paid'
```
with:
```ts
export type AffiliatePayoutStatus = 'pending' | 'approved' | 'paid' | 'clawback_pending' | 'reversed'
```

In `types/index.ts:53-64`, add `clawback_debt_cents` to `AffiliateProfile`:
```ts
export interface AffiliateProfile {
  id: string
  handle: string
  bio: string | null
  commission_coupon_pct: number
  commission_cookie_pct: number
  total_earned_cents: number
  pending_payout_cents: number
  clawback_debt_cents: number
  is_active: boolean
  created_at: string
  updated_at: string
}
```

In `types/index.ts:84-95`, add `refund_adjustment_cents` to `AffiliateAttribution`:
```ts
export interface AffiliateAttribution {
  id: string
  order_id: string
  affiliate_id: string
  attribution_type: AffiliateAttributionType
  coupon_id: string | null
  commission_pct: number
  commission_amount_cents: number
  refund_adjustment_cents: number
  payout_status: AffiliatePayoutStatus
  paid_at: string | null
  created_at: string
}
```

- [ ] **Step 3: Add refund fields to `Order`**

In `types/index.ts:222-263`, insert after the `payment_status: PaymentStatus` line (currently `types/index.ts:251`):
```ts
  payment_status: PaymentStatus
  refunded_amount_cents: number
  refunded_at: string | null
  paid_at: string | null
```
(keeping the existing `paid_at` line immediately below — the diff only inserts the two new fields between `payment_status` and `paid_at`.)

- [ ] **Step 4: Type-check**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx tsc --noEmit`
Expected: no new type errors from this file (pre-existing unrelated errors, if any, are out of scope).

- [ ] **Step 5: Commit**

```bash
git add types/index.ts
git commit -m "feat: add refund and clawback fields to shared types"
```

---

## Task 3: Close the legacy generic-dropdown refund path

**Files:**
- Modify: `lib/utils/constants.ts:40-53` (`VALID_STATUS_TRANSITIONS`), `lib/utils/constants.ts:57-65` (`STATUS_PRIMARY_ACTION`)
- Modify: `lib/supabase/queries/adminOrders.ts:194-233` (`DB_STATUS_MAP`, `timestampField`, `updateOrderStatus`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `VALID_STATUS_TRANSITIONS` no longer offers `'refunded'` as a target from any status — this is what makes the admin list-page dropdown (`app/admin/pedidos/page.tsx:708`) stop offering "Reembolsado" as a bare status change, and is consumed (read, unchanged behavior) by `app/admin/pedidos/[id]/page.tsx:307-309`.

- [ ] **Step 1: Remove `refunded` from `VALID_STATUS_TRANSITIONS` and the dead primary-action label**

In `lib/utils/constants.ts:40-53`, replace:
```ts
export const VALID_STATUS_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid:            ['preparing', 'cancelled'],
  preparing:       ['shipped', 'cancelled'],
  ready_to_ship:   ['shipped', 'cancelled'], // legacy compat
  shipped:         ['delivered', 'cancelled'],
  delivered:       ['refunded'],
  cancelled:       ['refunded'],
  refunded:        [],
  // Legacy
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  failed:    [],
}
```
with:
```ts
export const VALID_STATUS_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid:            ['preparing', 'cancelled'],
  preparing:       ['shipped', 'cancelled'],
  ready_to_ship:   ['shipped', 'cancelled'], // legacy compat
  shipped:         ['delivered', 'cancelled'],
  delivered:       [],
  cancelled:       [],
  refunded:        [],
  // Legacy
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  failed:    [],
}
```

Refunds are no longer a generic status transition — the only path is the dedicated `POST /api/admin/orders/[id]/refund` endpoint built in Task 8.

In `lib/utils/constants.ts:57-65`, remove the now-unreachable `delivered: 'Marcar reembolsado'` entry:
```ts
export const STATUS_PRIMARY_ACTION: Partial<Record<OrderStatus, string>> = {
  pending_payment: 'Confirmar pago',
  paid: 'Aceptar pedido',
  preparing: 'Marcar en camino',
  shipped: 'Marcar entregado',
  pending: 'Confirmar pedido',
  confirmed: 'Marcar enviado',
}
```

- [ ] **Step 2: Remove the now-incorrect `refunded` mapping in `DB_STATUS_MAP`**

In `lib/supabase/queries/adminOrders.ts:194-200`, replace:
```ts
const DB_STATUS_MAP: Record<string, string> = {
  pending_payment: 'pending',
  paid: 'confirmed',
  preparing: 'confirmed',
  ready_to_ship: 'confirmed',
  refunded: 'cancelled',
}
```
with:
```ts
const DB_STATUS_MAP: Record<string, string> = {
  pending_payment: 'pending',
  paid: 'confirmed',
  preparing: 'confirmed',
  ready_to_ship: 'confirmed',
}
```

`updateOrderStatus()` is no longer a valid path to reach `refunded` (Step 1 removed it from every transitions list, and the admin detail page already filters `refunded`/`cancelled` out of `nextStatuses` at `app/admin/pedidos/[id]/page.tsx:307-309`), so the old silent `refunded → cancelled` rewrite would only ever fire from a hand-crafted API call — removing it makes that call fail loudly (`status` would no longer be in `DB_STATUS_MAP`, so `toDbStatus('refunded')` now returns `'refunded'` itself via the `?? status` fallback, which correctly hits the widened CHECK constraint from Task 1 instead of silently becoming `'cancelled'`).

Also remove the matching dead lines further down in the same function. In `lib/supabase/queries/adminOrders.ts:215-233`, replace:
```ts
  const timestampField: Record<string, string> = {
    paid: 'confirmed_at',
    confirmed: 'confirmed_at',
    preparing: 'confirmed_at',
    ready_to_ship: 'confirmed_at',
    shipped: 'shipped_at',
    delivered: 'delivered_at',
    cancelled: 'cancelled_at',
    refunded: 'cancelled_at',
  }

  const updatePayload: Record<string, unknown> = {
    status: dbStatus,
    updated_at: new Date().toISOString(),
  }
  const tsField = timestampField[newStatus]
  if (tsField) updatePayload[tsField] = new Date().toISOString()
  if (newStatus === 'paid' || newStatus === 'confirmed') updatePayload.payment_status = 'paid'
  if (newStatus === 'refunded') updatePayload.payment_status = 'refunded'
```
with:
```ts
  const timestampField: Record<string, string> = {
    paid: 'confirmed_at',
    confirmed: 'confirmed_at',
    preparing: 'confirmed_at',
    ready_to_ship: 'confirmed_at',
    shipped: 'shipped_at',
    delivered: 'delivered_at',
    cancelled: 'cancelled_at',
  }

  const updatePayload: Record<string, unknown> = {
    status: dbStatus,
    updated_at: new Date().toISOString(),
  }
  const tsField = timestampField[newStatus]
  if (tsField) updatePayload[tsField] = new Date().toISOString()
  if (newStatus === 'paid' || newStatus === 'confirmed') updatePayload.payment_status = 'paid'
```

Refunds now exclusively go through `process_order_refund_atomic`, which sets `refunded_at`/`payment_status` itself — `updateOrderStatus()` no longer needs to know about `'refunded'` at all.

- [ ] **Step 3: Verify the list-page dropdown no longer offers "Reembolsado"**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx tsc --noEmit`
Expected: no new type errors. (Full behavioral verification of the dropdown happens in Task 17's browser check.)

- [ ] **Step 4: Commit**

```bash
git add lib/utils/constants.ts lib/supabase/queries/adminOrders.ts
git commit -m "fix: remove unsafe generic-dropdown refund path"
```

---

## Task 4: Pure refund validation and commission-adjustment math

**Files:**
- Create: `lib/server/refund-validation.ts`
- Modify: `lib/affiliate/commission.ts`
- Test: `__tests__/server/refund-validation.test.ts`
- Test: `__tests__/affiliate/commission.test.ts` (extend)

**Interfaces:**
- Produces: `validateRefundRequest(order, amountCents, reason): RefundValidationResult`, `resolveRefundMethod(paymentMethod): RefundMethod`, `RefundMethod = 'stripe' | 'cash' | 'bank_transfer' | 'other'` — consumed by Task 7 (`process-refund.ts`).
- Produces: `calculateCommissionAdjustment(commissionAmountCents, orderTotalCents, refundAmountCents): number` — consumed by nothing in app code (the equivalent math lives in the SQL RPC from Task 1), but kept as a directly-tested reference implementation of the same formula so the SQL and the spec's documented math can be verified to agree in a fast unit test.

- [ ] **Step 1: Write the failing tests for `refund-validation.ts`**

Create `__tests__/server/refund-validation.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { validateRefundRequest, resolveRefundMethod } from '../../lib/server/refund-validation'

describe('validateRefundRequest', () => {
  const paidOrder = { total: 50000, refunded_amount_cents: 0, payment_status: 'paid' }

  it('accepts a full refund of a paid order', () => {
    const result = validateRefundRequest(paidOrder, 50000, 'Producto defectuoso')
    expect(result.ok).toBe(true)
    expect(result.remainingCents).toBe(50000)
  })

  it('accepts a partial refund', () => {
    const result = validateRefundRequest(paidOrder, 10000, 'Error en el pedido')
    expect(result.ok).toBe(true)
  })

  it('rejects an empty reason', () => {
    const result = validateRefundRequest(paidOrder, 10000, '   ')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/motivo/i)
  })

  it('rejects a zero or negative amount', () => {
    expect(validateRefundRequest(paidOrder, 0, 'Otro').ok).toBe(false)
    expect(validateRefundRequest(paidOrder, -100, 'Otro').ok).toBe(false)
  })

  it('rejects a non-integer amount', () => {
    expect(validateRefundRequest(paidOrder, 100.5, 'Otro').ok).toBe(false)
  })

  it('rejects an amount exceeding the refundable balance', () => {
    const result = validateRefundRequest(paidOrder, 50001, 'Otro')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/excede/i)
  })

  it('accounts for a previous partial refund when checking the remaining balance', () => {
    const partiallyRefunded = { total: 50000, refunded_amount_cents: 30000, payment_status: 'partially_refunded' }
    expect(validateRefundRequest(partiallyRefunded, 20000, 'Otro').ok).toBe(true)
    expect(validateRefundRequest(partiallyRefunded, 20001, 'Otro').ok).toBe(false)
  })

  it('rejects an order that is not paid', () => {
    const pendingOrder = { total: 50000, refunded_amount_cents: 0, payment_status: 'pending' }
    expect(validateRefundRequest(pendingOrder, 10000, 'Otro').ok).toBe(false)
  })

  it('rejects an order that is already fully refunded', () => {
    const refundedOrder = { total: 50000, refunded_amount_cents: 50000, payment_status: 'refunded' }
    expect(validateRefundRequest(refundedOrder, 100, 'Otro').ok).toBe(false)
  })
})

describe('resolveRefundMethod', () => {
  it('resolves stripe payment methods', () => {
    expect(resolveRefundMethod('stripe_card')).toBe('stripe')
    expect(resolveRefundMethod('card')).toBe('stripe')
    expect(resolveRefundMethod('stripe')).toBe('stripe')
  })

  it('resolves bank transfer methods', () => {
    expect(resolveRefundMethod('transfer')).toBe('bank_transfer')
    expect(resolveRefundMethod('bank_transfer')).toBe('bank_transfer')
  })

  it('resolves cash methods', () => {
    expect(resolveRefundMethod('cash')).toBe('cash')
    expect(resolveRefundMethod('cash_on_delivery')).toBe('cash')
  })

  it('falls back to other for unknown or missing methods', () => {
    expect(resolveRefundMethod('mercado_pago')).toBe('other')
    expect(resolveRefundMethod(null)).toBe('other')
    expect(resolveRefundMethod(undefined)).toBe('other')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx vitest run __tests__/server/refund-validation.test.ts`
Expected: FAIL — `Cannot find module '../../lib/server/refund-validation'`.

- [ ] **Step 3: Implement `lib/server/refund-validation.ts`**

```ts
export interface RefundableOrder {
  total: number
  refunded_amount_cents: number
  payment_status: string
}

export interface RefundValidationResult {
  ok: boolean
  error?: string
  remainingCents?: number
}

export function validateRefundRequest(
  order: RefundableOrder,
  amountCents: number,
  reason: string
): RefundValidationResult {
  if (!reason || !reason.trim()) {
    return { ok: false, error: 'El motivo es requerido' }
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: 'El monto debe ser mayor a 0' }
  }
  if (order.payment_status !== 'paid' && order.payment_status !== 'partially_refunded') {
    return { ok: false, error: 'El pedido no está pagado o ya fue reembolsado por completo' }
  }

  const remainingCents = order.total - order.refunded_amount_cents
  if (amountCents > remainingCents) {
    return {
      ok: false,
      error: `El monto excede el saldo reembolsable ($${(remainingCents / 100).toFixed(2)} MXN)`,
    }
  }

  return { ok: true, remainingCents }
}

export type RefundMethod = 'stripe' | 'cash' | 'bank_transfer' | 'other'

const STRIPE_PAYMENT_METHODS = new Set(['stripe_card', 'card', 'stripe'])
const BANK_TRANSFER_METHODS = new Set(['transfer', 'bank_transfer'])
const CASH_METHODS = new Set(['cash', 'cash_on_delivery'])

export function resolveRefundMethod(paymentMethod: string | null | undefined): RefundMethod {
  const method = paymentMethod ?? ''
  if (STRIPE_PAYMENT_METHODS.has(method)) return 'stripe'
  if (BANK_TRANSFER_METHODS.has(method)) return 'bank_transfer'
  if (CASH_METHODS.has(method)) return 'cash'
  return 'other'
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx vitest run __tests__/server/refund-validation.test.ts`
Expected: PASS, all 15 assertions green.

- [ ] **Step 5: Add the commission-adjustment function and its tests**

Append to `lib/affiliate/commission.ts`:
```ts
export function calculateCommissionAdjustment(params: {
  commissionAmountCents: number
  orderTotalCents: number
  refundAmountCents: number
}): number {
  if (params.orderTotalCents <= 0) return 0
  const fraction = params.refundAmountCents / params.orderTotalCents
  return Math.floor(params.commissionAmountCents * fraction)
}
```

Append to `__tests__/affiliate/commission.test.ts`:
```ts
import { calculateCommissionAdjustment } from '../../lib/affiliate/commission'

describe('calculateCommissionAdjustment', () => {
  it('claws back the full commission on a full refund', () => {
    const result = calculateCommissionAdjustment({
      commissionAmountCents: 1000,
      orderTotalCents: 10000,
      refundAmountCents: 10000,
    })
    expect(result).toBe(1000)
  })

  it('claws back a proportional share on a partial refund', () => {
    const result = calculateCommissionAdjustment({
      commissionAmountCents: 1000,
      orderTotalCents: 10000,
      refundAmountCents: 3000,
    })
    expect(result).toBe(300)
  })

  it('floors fractional centavos', () => {
    const result = calculateCommissionAdjustment({
      commissionAmountCents: 999,
      orderTotalCents: 10000,
      refundAmountCents: 3333,
    })
    expect(result).toBe(Math.floor(999 * (3333 / 10000)))
  })

  it('returns 0 when order total is 0', () => {
    const result = calculateCommissionAdjustment({
      commissionAmountCents: 1000,
      orderTotalCents: 0,
      refundAmountCents: 0,
    })
    expect(result).toBe(0)
  })
})
```

(Note: the existing top of `__tests__/affiliate/commission.test.ts` already imports `{ describe, it, expect }` from `'vitest'` and `{ calculateCommission }` from `'../../lib/affiliate/commission'` — add `calculateCommissionAdjustment` to that same import line rather than a second import statement.)

- [ ] **Step 6: Run the full test file to verify it passes**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx vitest run __tests__/affiliate/commission.test.ts`
Expected: PASS, all assertions green (original 4 + new 4).

- [ ] **Step 7: Commit**

```bash
git add lib/server/refund-validation.ts lib/affiliate/commission.ts __tests__/server/refund-validation.test.ts __tests__/affiliate/commission.test.ts
git commit -m "feat: add pure refund validation and commission-adjustment math"
```

---

## Task 5: Refund confirmation email

**Files:**
- Modify: `lib/email/templates/order-emails-html.ts`
- Modify: `lib/email/send-order-emails.ts`

**Interfaces:**
- Consumes: `OrderStatusEmailProps` type (`lib/email/templates/order-emails-html.ts:144-153`), `escapeHtml` (`lib/email/escape-html.ts`), `formatPrice` (`lib/utils/format.ts`).
- Produces: `renderOrderRefundedHtml(props: OrderRefundEmailProps): string`, `sendOrderRefundEmail(orderId: string, details: { amountCents: number; reason: string; refundMethod: string }): Promise<{ sent: boolean; reason?: string }>` — consumed by Task 7 (`process-refund.ts`).

- [ ] **Step 1: Add the email template**

In `lib/email/templates/order-emails-html.ts`, add after `renderOrderDeliveredHtml` (after line 282, before the `renderAdminNewOrderHtml` function at line 285):

```ts
export type OrderRefundEmailProps = OrderStatusEmailProps & {
  amountCents: number
  reason: string
  remainingCents: number
}

/** Correo al cliente cuando se procesa un reembolso (total o parcial) de su pedido. */
export function renderOrderRefundedHtml(p: OrderRefundEmailProps): string {
  const isPartial = p.remainingCents > 0
  const amountLabel = formatPrice(p.amountCents)
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>Pedido ${escapeHtml(p.shortId)} reembolsado</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 10px 40px rgba(17,24,39,0.08);border:1px solid ${CARD_BORDER};">
        <tr><td style="background:linear-gradient(135deg,#F9FAFB 0%,#FFF 60%);padding:28px 24px;text-align:center;border-bottom:3px solid #6B7280;">
          <div style="font-size:40px;line-height:1;margin-bottom:8px;">↩️</div>
          <p style="margin:0;font-size:22px;font-weight:800;color:${TEXT_DARK};letter-spacing:-0.02em;">${isPartial ? 'Reembolso parcial procesado' : 'Reembolso procesado'}</p>
          <p style="margin:10px 0 0;font-size:15px;color:${TEXT_MUTED};">Hola <strong style="color:${TEXT_DARK};">${escapeHtml(p.customerName)}</strong>, procesamos un reembolso de tu pedido.</p>
          <div style="margin-top:16px;display:inline-block;background:${TEXT_DARK};color:#FFFFFF;font-family:ui-monospace,monospace;font-size:13px;font-weight:700;padding:8px 14px;border-radius:999px;letter-spacing:0.05em;">${escapeHtml(p.shortId)}</div>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border-radius:16px;border:2px solid #E5E7EB;margin-bottom:24px;">
            <tr><td style="padding:20px 22px;">
              <p style="margin:0;font-size:15px;font-weight:800;color:${TEXT_DARK};">Monto reembolsado: ${amountLabel}</p>
              <p style="margin:8px 0 0;font-size:13px;color:${TEXT_MUTED};"><strong style="color:${TEXT_DARK};">Motivo:</strong> ${escapeHtml(p.reason)}</p>
              ${isPartial ? `<p style="margin:8px 0 0;font-size:13px;color:${TEXT_MUTED};">Este fue un reembolso parcial. El resto de tu pedido sigue vigente.</p>` : ''}
            </td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr><td align="center" bgcolor="${BRAND_AMBER}" style="border-radius:14px;">
              <a href="${escapeHtml(p.orderUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:800;color:${TEXT_DARK};text-decoration:none;border-radius:14px;background:${BRAND_AMBER};border:2px solid ${TEXT_DARK};box-shadow:0 4px 0 ${TEXT_DARK};">Ver mi pedido →</a>
            </td></tr>
          </table>
          <p style="margin:28px 0 0;text-align:center;font-size:13px;color:${TEXT_MUTED};">¿Alguna duda? Escríbenos por WhatsApp. El equipo de <strong style="color:${TEXT_DARK};">${escapeHtml(p.brandName)}</strong> 💛</p>
        </td></tr>
        <tr><td style="padding:14px 24px;background:#FAFAFA;border-top:1px solid ${CARD_BORDER};text-align:center;font-size:11px;color:${TEXT_MUTED};">© ${new Date().getFullYear()} ${escapeHtml(p.brandName)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
```

- [ ] **Step 2: Add `sendOrderRefundEmail`**

In `lib/email/send-order-emails.ts`, update the import at the top (currently lines 7-14) to include the new template:
```ts
import {
  renderAdminNewOrderHtml,
  renderCustomerOrderConfirmationHtml,
  renderOrderPreparingHtml,
  renderOrderShippedHtml,
  renderOrderDeliveredHtml,
  renderOrderRefundedHtml,
  type OrderEmailLineItem,
} from '@/lib/email/templates/order-emails-html'
```

Append this function at the end of the file, after `sendOrderStatusEmail` (after line 300):
```ts
export async function sendOrderRefundEmail(
  orderId: string,
  details: { amountCents: number; reason: string; refundMethod: string }
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, reason: 'no_api_key' }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('orders')
    .select('short_id, public_access_token, customer_email, customer_name, total, refunded_amount_cents')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !data?.customer_email) return { sent: false, reason: 'order_not_found' }

  const brandName = process.env.NEXT_PUBLIC_APP_NAME ?? 'nurei'
  const baseUrl = resolvePublicUrl()
  const orderUrl = safeAttrUrl(`${baseUrl}/pedido/${orderId}${data.public_access_token ? `?token=${encodeURIComponent(data.public_access_token)}` : ''}`)
  const from = process.env.EMAIL_FROM ?? `${brandName} <onboarding@resend.dev>`

  const resend = new Resend(apiKey)
  const remainingCents = Math.max(0, (data.total ?? 0) - (data.refunded_amount_cents ?? 0))

  const html = renderOrderRefundedHtml({
    brandName,
    shortId: data.short_id,
    customerName: (data.customer_name ?? 'Cliente').trim() || 'Cliente',
    orderUrl,
    amountCents: details.amountCents,
    reason: details.reason,
    remainingCents,
  })

  try {
    await resend.emails.send({
      from,
      to: [data.customer_email],
      subject: `Reembolso procesado: pedido ${data.short_id}`,
      html,
    })
    return { sent: true }
  } catch (e) {
    console.error('[email] Error enviando correo de reembolso:', e)
    return { sent: false, reason: 'resend_failed' }
  }
}
```

- [ ] **Step 3: Type-check**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 4: Commit**

```bash
git add lib/email/templates/order-emails-html.ts lib/email/send-order-emails.ts
git commit -m "feat: add refund confirmation email"
```

---

## Task 6: Admin permission helper

**Files:**
- Create: `lib/server/require-admin-permission.ts`
- Test: `__tests__/server/require-admin-permission.test.ts`

**Interfaces:**
- Consumes: `AdminModule`, `PermissionLevel` types (`types/index.ts`), `createServerSupabaseClient`/`createServiceClient` (`lib/supabase/server.ts`, same signatures as used in `lib/server/require-admin.ts`).
- Produces: `hasSufficientPermission(level, minLevel): boolean` (pure, tested directly), `requireAdminPermission(module: AdminModule, minLevel: PermissionLevel): Promise<{ userId?: string; error?: NextResponse }>` — consumed by Task 8 (refund API route).

- [ ] **Step 1: Write the failing test for the pure ranking function**

Create `__tests__/server/require-admin-permission.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { hasSufficientPermission } from '../../lib/server/require-admin-permission'

describe('hasSufficientPermission', () => {
  it('total satisfies every minimum level', () => {
    expect(hasSufficientPermission('total', 'total')).toBe(true)
    expect(hasSufficientPermission('total', 'escritura')).toBe(true)
    expect(hasSufficientPermission('total', 'lectura')).toBe(true)
    expect(hasSufficientPermission('total', 'sin_acceso')).toBe(true)
  })

  it('escritura satisfies escritura and lower, not total', () => {
    expect(hasSufficientPermission('escritura', 'escritura')).toBe(true)
    expect(hasSufficientPermission('escritura', 'lectura')).toBe(true)
    expect(hasSufficientPermission('escritura', 'total')).toBe(false)
  })

  it('lectura does not satisfy escritura', () => {
    expect(hasSufficientPermission('lectura', 'escritura')).toBe(false)
    expect(hasSufficientPermission('lectura', 'lectura')).toBe(true)
  })

  it('sin_acceso never satisfies anything above sin_acceso', () => {
    expect(hasSufficientPermission('sin_acceso', 'lectura')).toBe(false)
    expect(hasSufficientPermission('sin_acceso', 'sin_acceso')).toBe(true)
  })

  it('treats an undefined level (module missing from a custom role) as sin_acceso', () => {
    expect(hasSufficientPermission(undefined, 'lectura')).toBe(false)
    expect(hasSufficientPermission(undefined, 'sin_acceso')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx vitest run __tests__/server/require-admin-permission.test.ts`
Expected: FAIL — `Cannot find module '../../lib/server/require-admin-permission'`.

- [ ] **Step 3: Implement `lib/server/require-admin-permission.ts`**

```ts
import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import type { AdminModule, PermissionLevel } from '@/types'

const PERMISSION_RANK: Record<PermissionLevel, number> = {
  sin_acceso: 0,
  lectura: 1,
  escritura: 2,
  total: 3,
}

export function hasSufficientPermission(
  level: PermissionLevel | undefined,
  minLevel: PermissionLevel
): boolean {
  return PERMISSION_RANK[level ?? 'sin_acceso'] >= PERMISSION_RANK[minLevel]
}

export async function requireAdminPermission(module: AdminModule, minLevel: PermissionLevel) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('user_profiles')
    .select('role, admin_role:admin_roles(permissions)')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }

  const permissions =
    (profile.admin_role as { permissions?: Record<string, PermissionLevel> } | null)?.permissions ?? {}
  const level = permissions[module]

  if (!hasSufficientPermission(level, minLevel)) {
    return { error: NextResponse.json({ error: 'No tienes permiso para esta acción' }, { status: 403 }) }
  }

  return { userId: user.id }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx vitest run __tests__/server/require-admin-permission.test.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/server/require-admin-permission.ts __tests__/server/require-admin-permission.test.ts
git commit -m "feat: add granular admin permission enforcement helper"
```

---

## Task 7: Refund orchestration function

**Files:**
- Create: `lib/server/process-refund.ts`

**Interfaces:**
- Consumes: `validateRefundRequest`, `resolveRefundMethod` (Task 4), `sendOrderRefundEmail` (Task 5), `process_order_refund_atomic` RPC (Task 1), `Stripe` type from the `stripe` package, `SupabaseClient` from `@supabase/supabase-js`.
- Produces: `processRefund(supabase: SupabaseClient, stripe: Stripe, params: ProcessRefundParams): Promise<ProcessRefundResult>` — consumed by Task 8 (refund API route).

- [ ] **Step 1: Implement `lib/server/process-refund.ts`**

No isolated unit test for this file per the Global Constraints note (it orchestrates a real Supabase RPC call and a real Stripe call with no existing mocking harness in this repo) — it is exercised by Task 17's manual/Stripe-test-mode E2E check, which is where the spec places this tier of testing (spec §10, "E2E / manual browser check").

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { validateRefundRequest, resolveRefundMethod } from './refund-validation'
import { sendOrderRefundEmail } from '@/lib/email/send-order-emails'

export interface ProcessRefundParams {
  orderId: string
  amountCents: number
  reason: string
  referenceNote?: string | null
  processedBy: string
}

export interface ProcessRefundResult {
  ok: boolean
  error?: string
  status?: number
  refundId?: string
}

export async function processRefund(
  supabase: SupabaseClient,
  stripe: Stripe,
  params: ProcessRefundParams
): Promise<ProcessRefundResult> {
  const { orderId, amountCents, reason, referenceNote, processedBy } = params

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, total, refunded_amount_cents, payment_status, payment_method, stripe_payment_intent_id')
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    return { ok: false, error: 'Pedido no encontrado', status: 404 }
  }

  const validation = validateRefundRequest(
    {
      total: order.total,
      refunded_amount_cents: order.refunded_amount_cents ?? 0,
      payment_status: order.payment_status,
    },
    amountCents,
    reason
  )
  if (!validation.ok) {
    return { ok: false, error: validation.error, status: 422 }
  }

  const refundMethod = resolveRefundMethod(order.payment_method)
  let stripeRefundId: string | null = null

  if (refundMethod === 'stripe') {
    if (!order.stripe_payment_intent_id) {
      return { ok: false, error: 'El pedido no tiene un pago de Stripe asociado', status: 422 }
    }
    try {
      const refund = await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        amount: amountCents,
        reason: 'requested_by_customer',
      })
      stripeRefundId = refund.id
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al procesar el reembolso en Stripe'
      return { ok: false, error: message, status: 502 }
    }
  }

  const { data: refundId, error: rpcErr } = await supabase.rpc('process_order_refund_atomic', {
    p_order_id: orderId,
    p_amount_cents: amountCents,
    p_reason: reason.trim(),
    p_refund_method: refundMethod,
    p_stripe_refund_id: stripeRefundId,
    p_notes: referenceNote?.trim() || null,
    p_processed_by: processedBy,
  })

  if (rpcErr) {
    // A Stripe refund can't be undone from here — this must be loud, not swallowed.
    console.error('[refund] CRITICAL: refund executed but DB write failed — manual reconciliation required', {
      orderId,
      stripeRefundId,
      amountCents,
      error: rpcErr.message,
    })
    return {
      ok: false,
      error: 'El reembolso se procesó pero hubo un error al registrarlo. Contacta a soporte técnico.',
      status: 500,
    }
  }

  void sendOrderRefundEmail(orderId, { amountCents, reason: reason.trim(), refundMethod }).catch((e) => {
    console.error('[refund] Error enviando correo de reembolso:', e)
  })

  return { ok: true, refundId: refundId as string }
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/server/process-refund.ts
git commit -m "feat: add refund orchestration (Stripe + atomic DB write)"
```

---

## Task 8: Refund API route

**Files:**
- Create: `app/api/admin/orders/[id]/refund/route.ts`

**Interfaces:**
- Consumes: `requireAdminPermission` (Task 6), `processRefund` (Task 7), `getStripeServer` (`lib/stripe/server.ts:12`), `getOrderDetail` (`lib/supabase/queries/adminOrders.ts:103`), `createServiceClient` (`lib/supabase/server.ts`).
- Produces: `POST /api/admin/orders/[id]/refund` — consumed by Task 12 (RefundModal component).

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminPermission } from '@/lib/server/require-admin-permission'
import { processRefund } from '@/lib/server/process-refund'
import { getStripeServer } from '@/lib/stripe/server'
import { getOrderDetail } from '@/lib/supabase/queries/adminOrders'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminPermission('reembolsos', 'escritura')
  if (guard.error) return guard.error

  try {
    const { id } = await params
    const body = (await req.json()) as {
      amountCents?: number
      reason?: string
      referenceNote?: string
    }

    if (!body.amountCents || !body.reason) {
      return NextResponse.json({ error: 'amountCents y reason son requeridos' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const result = await processRefund(supabase, getStripeServer(), {
      orderId: id,
      amountCents: body.amountCents,
      reason: body.reason,
      referenceNote: body.referenceNote ?? null,
      processedBy: guard.userId!,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 })
    }

    const order = await getOrderDetail(supabase, id)
    return NextResponse.json({ data: { order, refundId: result.refundId } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al procesar el reembolso'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/orders/[id]/refund/route.ts
git commit -m "feat: add refund API endpoint"
```

---

## Task 9: Stripe webhook reconciliation

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Consumes: existing `getStripe()` helper (`app/api/webhooks/stripe/route.ts:8-13`), `createServiceClient` (already imported).
- Produces: reconciles `order_refunds.status` from `pending` to `succeeded`/`failed` when Stripe settles a refund asynchronously — no other task consumes this directly, it's a safety net for refunds that don't settle synchronously.

- [ ] **Step 1: Add the `charge.refunded` and `refund.updated` cases**

In `app/api/webhooks/stripe/route.ts`, add a new case to the `switch (event.type)` block (after the `payment_intent.payment_failed` case, before the closing `}` of the switch at line 101):

```ts
      case 'charge.refunded':
      case 'refund.updated': {
        const refund =
          event.type === 'refund.updated'
            ? (event.data.object as Stripe.Refund)
            : (event.data.object as Stripe.Charge).refunds?.data?.[0]
        if (!refund?.id) break

        const dbStatus = refund.status === 'succeeded' ? 'succeeded' : refund.status === 'failed' ? 'failed' : 'pending'

        await supabase
          .from('order_refunds')
          .update({ status: dbStatus })
          .eq('stripe_refund_id', refund.id)
        break
      }
```

- [ ] **Step 2: Register the new event types in the Stripe webhook endpoint config**

This is a dashboard/CLI configuration step, not a code change: add `charge.refunded` and `refund.updated` to the list of events the Stripe webhook endpoint listens for (Stripe Dashboard → Developers → Webhooks → the endpoint used by `STRIPE_WEBHOOK_SECRET`, or `stripe listen --events charge.refunded,refund.updated,checkout.session.completed,payment_intent.payment_failed` for local testing). Without this, Stripe never sends the event and the code from Step 1 never runs.

- [ ] **Step 3: Type-check**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/webhooks/stripe/route.ts
git commit -m "feat: reconcile async Stripe refund status via webhook"
```

---

## Task 10: Fix the live affiliate payout route for clawback netting

**Files:**
- Modify: `app/api/admin/affiliates/[id]/payments/route.ts:96-165`

**Interfaces:**
- Consumes: `affiliate_attributions.refund_adjustment_cents`, `affiliate_profiles.clawback_debt_cents` (Task 1).
- Produces: the actually-live payout flow (confirmed via `app/admin/affiliates/[id]/page.tsx:416` calling this exact route — the `process_affiliate_payout_atomic` RPC fixed in Task 1 is a separate, currently UI-unreachable route at `app/api/admin/affiliates/[id]/payout/route.ts`, fixed there only for defense-in-depth) now nets out clawback debt and pays net-of-adjustment amounts.

- [ ] **Step 1: Select `refund_adjustment_cents` and net it into the payout total**

In `app/api/admin/affiliates/[id]/payments/route.ts`, replace the attribution fetch and total calculation (currently lines 96-111):
```ts
    const { data: attributions, error: attrErr } = await supabase
      .from('affiliate_attributions')
      .select('id, commission_amount_cents, payout_status, created_at')
      .eq('affiliate_id', id)
      .in('id', attribution_ids)

    if (attrErr || !attributions || attributions.length === 0) {
      return NextResponse.json({ error: 'No se encontraron las atribuciones seleccionadas' }, { status: 404 })
    }

    const totalAmount = attributions.reduce((sum, a) => sum + (a.commission_amount_cents ?? 0), 0)

    if (totalAmount <= 0) {
      return NextResponse.json({ error: 'El monto total debe ser mayor a 0' }, { status: 400 })
    }
```
with:
```ts
    const { data: attributions, error: attrErr } = await supabase
      .from('affiliate_attributions')
      .select('id, commission_amount_cents, refund_adjustment_cents, payout_status, created_at')
      .eq('affiliate_id', id)
      .in('id', attribution_ids)

    if (attrErr || !attributions || attributions.length === 0) {
      return NextResponse.json({ error: 'No se encontraron las atribuciones seleccionadas' }, { status: 404 })
    }

    const grossAmount = attributions.reduce(
      (sum, a) => sum + Math.max(0, (a.commission_amount_cents ?? 0) - (a.refund_adjustment_cents ?? 0)),
      0
    )

    if (grossAmount <= 0) {
      return NextResponse.json({ error: 'El monto total debe ser mayor a 0' }, { status: 400 })
    }

    const { data: affiliateProfile } = await supabase
      .from('affiliate_profiles')
      .select('clawback_debt_cents')
      .eq('id', id)
      .single()

    const clawbackDebt = affiliateProfile?.clawback_debt_cents ?? 0
    const debtDeducted = Math.min(grossAmount, clawbackDebt)
    const totalAmount = grossAmount - debtDeducted
```

- [ ] **Step 2: Insert the net amount and note the deduction**

Replace the `commission_payments` insert (currently lines 117-132):
```ts
    const { data: paymentData, error: insertErr } = await supabase
      .from('commission_payments')
      .insert({
        affiliate_id: id,
        amount_cents: totalAmount,
        period_from: periodFrom.toISOString().slice(0, 10),
        period_to: periodTo.toISOString().slice(0, 10),
        attribution_ids,
        notes: notes || null,
        payment_type: payment_type ?? 'transferencia',
        reference_number: reference_number || null,
        paid_by: guard.userId,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single()
```
with:
```ts
    const debtNote = debtDeducted > 0
      ? `Se descontaron $${(debtDeducted / 100).toFixed(2)} MXN de deuda por reembolso previo.`
      : null

    const { data: paymentData, error: insertErr } = await supabase
      .from('commission_payments')
      .insert({
        affiliate_id: id,
        amount_cents: totalAmount,
        period_from: periodFrom.toISOString().slice(0, 10),
        period_to: periodTo.toISOString().slice(0, 10),
        attribution_ids,
        notes: [notes, debtNote].filter(Boolean).join(' — ') || null,
        payment_type: payment_type ?? 'transferencia',
        reference_number: reference_number || null,
        paid_by: guard.userId,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single()
```

If `totalAmount` is `0` (the whole payout was absorbed by debt), the insert still records a `commission_payments` row with `amount_cents: 0` and the explanatory note — this keeps the paper trail even when no cash actually moved. `commission_payments.amount_cents` originally had `check (amount_cents > 0)` (`013_affiliate_tables.sql:76`), which would reject a `0` insert; Task 1's migration already widens this to `>= 0` for exactly this reason.

- [ ] **Step 3: Reduce `clawback_debt_cents` and net-of-adjustment `pending_payout_cents`**

Replace the profile update (currently lines 150-165):
```ts
    const { data: remainingAttrs } = await supabase
      .from('affiliate_attributions')
      .select('commission_amount_cents')
      .eq('affiliate_id', id)
      .in('payout_status', ['pending', 'approved'])

    const newPending = (remainingAttrs ?? []).reduce((sum, a) => sum + (a.commission_amount_cents ?? 0), 0)

    const { error: profileErr } = await supabase
      .from('affiliate_profiles')
      .update({ pending_payout_cents: newPending })
      .eq('id', id)

    if (profileErr) {
      console.error('[payments API] Error updating profile pending amount:', profileErr)
    }
```
with:
```ts
    const { data: remainingAttrs } = await supabase
      .from('affiliate_attributions')
      .select('commission_amount_cents, refund_adjustment_cents')
      .eq('affiliate_id', id)
      .in('payout_status', ['pending', 'approved'])

    const newPending = (remainingAttrs ?? []).reduce(
      (sum, a) => sum + Math.max(0, (a.commission_amount_cents ?? 0) - (a.refund_adjustment_cents ?? 0)),
      0
    )

    const { error: profileErr } = await supabase
      .from('affiliate_profiles')
      .update({
        pending_payout_cents: newPending,
        clawback_debt_cents: Math.max(0, clawbackDebt - debtDeducted),
      })
      .eq('id', id)

    if (profileErr) {
      console.error('[payments API] Error updating profile pending amount:', profileErr)
    }
```

- [ ] **Step 4: Type-check**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/affiliates/\[id\]/payments/route.ts
git commit -m "fix: net clawback debt out of affiliate payouts"
```

---

## Task 11: Add the "reembolsos" module to the role permission editor

**Files:**
- Modify: `app/admin/usuarios/page.tsx:5-53`

**Interfaces:**
- Consumes: `AdminModule` type (now includes `'reembolsos'` from Task 2).
- Produces: nothing new consumed elsewhere — this is the UI surface where an admin configures which roles get `reembolsos` access above the seeded defaults from Task 1.

- [ ] **Step 1: Import the icon and register the module**

In `app/admin/usuarios/page.tsx:5-9`, add `RotateCcw` to the lucide-react import:
```ts
import {
  Users, Shield, Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight,
  LayoutDashboard, ShoppingCart, Package, FolderTree, Warehouse, Ticket,
  Image, UserCheck, UserCog, Lock, Settings, BarChart3, CreditCard, X, Check, BellRing,
  RotateCcw,
} from 'lucide-react'
```

Replace `ALL_MODULES`, `MODULE_LABELS`, `MODULE_ICONS` (`app/admin/usuarios/page.tsx:32-53`):
```ts
const ALL_MODULES: AdminModule[] = [
  'dashboard', 'pedidos', 'productos', 'categorias', 'inventario',
  'cupones', 'multimedia', 'clientes', 'usuarios', 'roles',
  'configuracion', 'analytics', 'pagos',
  'afiliados', 'reembolsos',
]

const MODULE_LABELS: Record<AdminModule, string> = {
  dashboard: 'Dashboard', pedidos: 'Pedidos', productos: 'Productos',
  categorias: 'Categorías', inventario: 'Inventario', cupones: 'Cupones',
  multimedia: 'Multimedia', clientes: 'Clientes', usuarios: 'Usuarios',
  roles: 'Roles', configuracion: 'Administración', analytics: 'Analytics',
  pagos: 'Pagos', afiliados: 'Afiliados', reembolsos: 'Reembolsos',
}

const MODULE_ICONS: Record<AdminModule, React.ElementType> = {
  dashboard: LayoutDashboard, pedidos: ShoppingCart, productos: Package,
  categorias: FolderTree, inventario: Warehouse, cupones: Ticket,
  multimedia: Image, clientes: UserCheck, usuarios: Users,
  roles: Shield, configuracion: Settings, analytics: BarChart3,
  pagos: CreditCard, afiliados: Users, reembolsos: RotateCcw,
}
```

`DEFAULT_PERMISSIONS` (line 66-68) derives from `ALL_MODULES` automatically, so a newly-created custom role defaults `reembolsos` to `'sin_acceso'` with no further change needed there.

- [ ] **Step 2: Type-check**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/usuarios/page.tsx
git commit -m "feat: expose reembolsos permission module in role editor"
```

---

## Task 12: RefundModal component

**Files:**
- Create: `components/admin/pedidos/RefundModal.tsx`

**Interfaces:**
- Consumes: `Order` type (`types/index.ts`), `Dialog`/`DialogContent`/`DialogTitle` (`components/ui/dialog.tsx`, same import path used in `app/admin/pedidos/[id]/page.tsx:18`), `Button`/`Input` (`components/ui/button.tsx`, `components/ui/input.tsx`), `formatPrice` (`lib/utils/format.ts`), `toast` from `sonner`.
- Produces: `<RefundModal open onOpenChange order onSuccess />` — consumed by Task 13 (order detail page).

- [ ] **Step 1: Implement the component**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { formatPrice } from '@/lib/utils/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'
import type { Order } from '@/types'

const REFUND_REASONS = [
  'Producto defectuoso',
  'Cliente cambió de opinión',
  'Error en el pedido',
  'Otro',
] as const

const STRIPE_PAYMENT_METHODS = new Set(['stripe_card', 'card', 'stripe'])

interface RefundModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order
  onSuccess: (updatedOrder: Order) => void
}

export function RefundModal({ open, onOpenChange, order, onSuccess }: RefundModalProps) {
  const remainingCents = Math.max(0, order.total - (order.refunded_amount_cents ?? 0))
  const isStripe = STRIPE_PAYMENT_METHODS.has(order.payment_method ?? '')

  const [amountPesos, setAmountPesos] = useState(() => (remainingCents / 100).toFixed(2))
  const [reason, setReason] = useState<string>(REFUND_REASONS[0])
  const [referenceNote, setReferenceNote] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setAmountPesos((remainingCents / 100).toFixed(2))
      setReason(REFUND_REASONS[0])
      setReferenceNote('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.id])

  const amountCents = Math.round(parseFloat(amountPesos || '0') * 100)
  const isValidAmount = Number.isFinite(amountCents) && amountCents > 0 && amountCents <= remainingCents
  const isFull = amountCents === remainingCents

  const submit = async () => {
    if (!isValidAmount) {
      toast.error('El monto no es válido')
      return
    }
    if (!isStripe && !referenceNote.trim()) {
      toast.error('Agrega una referencia del reembolso manual (folio de transferencia, etc.)')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, reason, referenceNote: referenceNote.trim() || undefined }),
      })
      const json = (await res.json()) as { data?: { order: Order }; error?: string }
      if (!res.ok) {
        toast.error(json.error ?? 'Error al procesar el reembolso')
        return
      }
      toast.success(isFull ? 'Reembolso completo procesado' : 'Reembolso parcial procesado')
      if (json.data?.order) onSuccess(json.data.order)
      onOpenChange(false)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-2xl duration-200">
        <div className="p-5 space-y-4">
          <DialogTitle className="text-base font-semibold text-gray-900">Reembolsar pedido</DialogTitle>

          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 space-y-1">
            <p>Método de pago: <span className="font-semibold">{PAYMENT_METHOD_LABELS[order.payment_method ?? ''] ?? order.payment_method ?? '—'}</span></p>
            <p>Total pagado: <span className="font-semibold">{formatPrice(order.total)}</span></p>
            {(order.refunded_amount_cents ?? 0) > 0 && (
              <p>Ya reembolsado: <span className="font-semibold">{formatPrice(order.refunded_amount_cents ?? 0)}</span></p>
            )}
            <p>Saldo reembolsable: <span className="font-semibold">{formatPrice(remainingCents)}</span></p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Monto a reembolsar (MXN)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={(remainingCents / 100).toFixed(2)}
              className="h-9 text-sm rounded-xl border-gray-200"
              value={amountPesos}
              onChange={(e) => setAmountPesos(e.target.value)}
            />
            {!isValidAmount && amountPesos !== '' && (
              <p className="text-[11px] text-red-500 mt-1">Monto inválido o mayor al saldo reembolsable</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Motivo</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-9 rounded-xl border border-gray-200 bg-white text-sm px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-cyan/30"
            >
              {REFUND_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {!isStripe && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Referencia del reembolso manual</label>
              <Input
                className="h-9 text-sm rounded-xl border-gray-200"
                value={referenceNote}
                onChange={(e) => setReferenceNote(e.target.value)}
                placeholder="Folio de transferencia, comprobante…"
              />
            </div>
          )}

          <p className="text-xs text-gray-500">
            {isStripe
              ? `Se reembolsarán ${formatPrice(amountCents || 0)} a la tarjeta vía Stripe.`
              : `Se marcará como reembolso manual confirmado por ${PAYMENT_METHOD_LABELS[order.payment_method ?? ''] ?? 'el método de pago'}.`}
          </p>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-9 rounded-xl text-sm">Cancelar</Button>
            <Button
              onClick={() => { void submit() }}
              disabled={loading || !isValidAmount}
              className="flex-1 h-9 rounded-xl text-sm font-semibold"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar reembolso'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/pedidos/RefundModal.tsx
git commit -m "feat: add RefundModal component"
```

---

## Task 13: Wire RefundModal + refund history into the order detail page

**Files:**
- Modify: `app/admin/pedidos/[id]/page.tsx`

**Interfaces:**
- Consumes: `RefundModal` (Task 12), `order.refunded_amount_cents`/`order.refunded_at` (Task 2), `GET /api/admin/orders/[id]/refunds` (new, this task).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Add a refund-history read endpoint**

Create `app/api/admin/orders/[id]/refunds/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('order_refunds')
    .select('id, amount_cents, reason, refund_method, status, notes, processed_by, refunded_at')
    .eq('order_id', id)
    .order('refunded_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Error al obtener reembolsos' }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
```

Reading refund history only requires being an authenticated admin (`requireAdmin()`), not the `reembolsos` permission — matches how other read-only order data (`GET /api/admin/orders/[id]`) is gated in this codebase, while the money-moving `POST .../refund` action (Task 8) is the one gated by the new granular permission.

- [ ] **Step 2: Add state, fetch, and the "Reembolsar" button**

In `app/admin/pedidos/[id]/page.tsx`, add the import (near the existing `TicketSurtidoModal` import at line 29):
```ts
import { TicketSurtidoModal } from '@/components/admin/pedidos/TicketSurtidoModal'
import { RefundModal } from '@/components/admin/pedidos/RefundModal'
```

Add `RotateCcw` to the existing lucide-react import (line 6-11) if not already present — it already is (`RotateCcw` appears at line 10, used by `sIcon`), so no change needed there.

Add state near the existing `printModalOpen` state (line 144):
```ts
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [refunds, setRefunds] = useState<Array<{
    id: string; amount_cents: number; reason: string | null; refund_method: string
    status: string; notes: string | null; refunded_at: string
  }>>([])
```

Add a fetch function and call it alongside `fetchOrder` (after the `fetchOrder` `useCallback` block, currently ending at line 158):
```ts
  const fetchRefunds = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/orders/${id}/refunds`)
      const json = await res.json() as { data?: typeof refunds }
      setRefunds(json.data ?? [])
    } catch { /* refund history is supplementary — fail silently, page still works */ }
  }, [id])

  useEffect(() => { void fetchRefunds() }, [fetchRefunds])
```

Compute the refundable balance and permission-gated visibility near `nextStatuses` (currently line 307-310):
```ts
  const canCancel = CANCELLABLE_STATUSES.includes(order.status)
  const nextStatuses = (VALID_STATUS_TRANSITIONS[order.status] ?? []).filter(
    (s) => s !== 'cancelled' && s !== 'refunded'
  ) as OrderStatus[]
  const nextStatus = nextStatuses[0] ?? null
  const remainingRefundableCents = order.total - (order.refunded_amount_cents ?? 0)
  const canShowRefundButton = (order.payment_status === 'paid' || order.payment_status === 'partially_refunded') && remainingRefundableCents > 0
```

Add the "Reembolsar" button next to the existing "Cancelar" button (currently lines 395-403):
```tsx
              {canCancel && (
                <button
                  type="button"
                  onClick={() => { setCancelReason(''); setCancelOpen(true) }}
                  className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-red-200 bg-white px-3 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition"
                >
                  <Ban className="h-4 w-4" /> Cancelar
                </button>
              )}

              {canShowRefundButton && (
                <button
                  type="button"
                  onClick={() => setRefundModalOpen(true)}
                  className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  <RotateCcw className="h-4 w-4" /> Reembolsar
                </button>
              )}
```

Note: the button is rendered unconditionally on the client here (matching how "Cancelar" and other buttons already behave in this file — no client-side permission check exists yet anywhere in this page). Server-side, `POST .../refund` (Task 8) is the actual enforcement point via `requireAdminPermission`; an admin without the `reembolsos` permission sees the button but gets a 403 with a clear error toast on submit. This matches the codebase's existing security model (server-enforced, not UI-hidden) rather than introducing a new client-side permission-fetching pattern for a single button.

- [ ] **Step 3: Render the modal and the refund-history section**

Add the modal near the existing `TicketSurtidoModal` render (currently lines 684-690):
```tsx
      <TicketSurtidoModal
        open={printModalOpen}
        onOpenChange={setPrintModalOpen}
        orderIds={[order.id]}
        type="ticket"
        autoPrint
      />

      <RefundModal
        open={refundModalOpen}
        onOpenChange={setRefundModalOpen}
        order={order}
        onSuccess={(updated) => { setOrder(updated); void fetchRefunds() }}
      />
```

Add a refund-history card in the right column, after the "Notes" card (currently ending at line 649, before the closing `</div>` of the right column at line 650):
```tsx
          {refunds.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Historial de reembolsos</p>
              <div className="space-y-2">
                {refunds.map((r) => (
                  <div key={r.id} className="rounded-lg bg-gray-50/70 border border-gray-100 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-800">{formatPrice(r.amount_cents)}</span>
                      <span className="text-[10px] text-gray-400">{formatDate(r.refunded_at)}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{r.reason} · {PAYMENT_METHOD_LABELS[r.refund_method] ?? r.refund_method}</p>
                    {r.notes && <p className="text-[10px] text-gray-400 mt-0.5">{r.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 4: Type-check**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/[id]/refunds/route.ts app/admin/pedidos/[id]/page.tsx
git commit -m "feat: wire refund action and history into order detail page"
```

---

## Task 14: Affiliate-facing refund visibility — ventas page

**Files:**
- Modify: `app/api/affiliate/orders/route.ts:22-27`
- Modify: `app/affiliate/ventas/page.tsx`

**Interfaces:**
- Consumes: `AffiliatePayoutStatus` type (now includes `clawback_pending`/`reversed` from Task 2).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Select `payment_status` on the joined order and `refund_adjustment_cents`**

In `app/api/affiliate/orders/route.ts:22-27`, replace:
```ts
    .select(`
      id, order_id, attribution_type, coupon_id, coupon_code,
      commission_pct, commission_amount_cents, payout_status, paid_at, created_at,
      orders ( short_id, total, created_at, status, payment_method ),
      coupons ( code )
    `)
```
with:
```ts
    .select(`
      id, order_id, attribution_type, coupon_id, coupon_code,
      commission_pct, commission_amount_cents, refund_adjustment_cents, payout_status, paid_at, created_at,
      orders ( short_id, total, created_at, status, payment_method, payment_status ),
      coupons ( code )
    `)
```

Also update `VALID_PAYOUT_STATUSES` (line 5) to include the new states so the `?status=` filter accepts them:
```ts
const VALID_PAYOUT_STATUSES = ['pending', 'approved', 'paid', 'clawback_pending', 'reversed'] as const
```

- [ ] **Step 2: Extend `PayoutStatus` and `PAYOUT_STATUS_CONFIG`, add the refunded-order note**

In `app/affiliate/ventas/page.tsx:8`, replace:
```ts
type PayoutStatus = 'pending' | 'approved' | 'paid'
```
with:
```ts
type PayoutStatus = 'pending' | 'approved' | 'paid' | 'clawback_pending' | 'reversed'
```

Update the `AttributionRow` interface (currently lines 10-22) to include the new fields:
```ts
interface AttributionRow {
  id: string
  order_id: string
  attribution_type: 'coupon' | 'cookie'
  coupon_id: string | null
  coupon_code: string | null
  commission_pct: number
  commission_amount_cents: number
  refund_adjustment_cents: number
  payout_status: PayoutStatus
  paid_at: string | null
  created_at: string
  orders: { short_id: string; total: number; created_at: string; status: string; payment_method: string | null; payment_status: string | null } | null
}
```

Update `PAYOUT_STATUS_CONFIG` (currently lines 24-28):
```ts
const PAYOUT_STATUS_CONFIG: Record<PayoutStatus, { label: string; className: string }> = {
  pending:          { label: 'Pendiente de pago',      className: 'bg-gray-100 text-gray-600' },
  approved:         { label: 'Para pago al afiliado',  className: 'bg-blue-100 text-blue-700' },
  paid:             { label: 'Pagado',                 className: 'bg-emerald-100 text-emerald-700' },
  clawback_pending: { label: 'Recuperación pendiente',  className: 'bg-amber-100 text-amber-700' },
  reversed:         { label: 'Cancelada',               className: 'bg-red-100 text-red-700' },
}
```

Add the refunded-order note in the table row, right after the commission cell (currently lines 233-238):
```tsx
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-primary-dark text-xs">
                      {formatPrice(row.commission_amount_cents - row.refund_adjustment_cents)}
                    </span>
                    <span className="text-gray-400 text-[10px] ml-1">({row.commission_pct}%)</span>
                    {(row.orders?.status === 'refunded' || row.orders?.payment_status === 'partially_refunded') && (
                      <p className="text-[10px] text-amber-600 font-semibold mt-0.5">⚠️ Pedido reembolsado — comisión ajustada</p>
                    )}
                  </td>
```

- [ ] **Step 3: Type-check**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/affiliate/orders/route.ts app/affiliate/ventas/page.tsx
git commit -m "feat: show refund adjustment and status to affiliates"
```

---

## Task 15: Affiliate-facing clawback debt — overview/stats

**Files:**
- Modify: `app/api/affiliate/stats/route.ts:16-19,106-120`
- Modify: `app/affiliate/AffiliateOverview.tsx`

**Interfaces:**
- Consumes: `affiliate_profiles.clawback_debt_cents` (Task 1).
- Produces: nothing consumed elsewhere. (This targets `AffiliateOverview.tsx`/`/api/affiliate/stats`, the file that actually renders `pending_payout_cents`/`total_earned_cents` today — not `app/affiliate/pagos/page.tsx`, which only lists past `commission_payments` and has no current-balance summary.)

- [ ] **Step 1: Select and return `clawback_debt_cents`**

In `app/api/affiliate/stats/route.ts:16-19`, replace:
```ts
    supabase
      .from('affiliate_profiles')
      .select('total_earned_cents, pending_payout_cents')
      .eq('id', affiliateId)
      .single(),
```
with:
```ts
    supabase
      .from('affiliate_profiles')
      .select('total_earned_cents, pending_payout_cents, clawback_debt_cents')
      .eq('id', affiliateId)
      .single(),
```

In the response object (currently lines 106-120), add the field:
```ts
  return NextResponse.json({
    data: {
      total_earned_cents: profile?.total_earned_cents ?? 0,
      pending_payout_cents: profile?.pending_payout_cents ?? 0,
      clawback_debt_cents: profile?.clawback_debt_cents ?? 0,
      total_commission_period: totalCommission,
      pending_commission_period: pendingCommission,
      total_orders: totalOrders,
      total_clicks: totalClicks,
      unique_clicks: uniqueClicks,
      conversion_rate: conversionRate,
      chartData,
      weekly_sales,
      top_products: [] as { product_name: string; units: number }[],
    },
  })
```

- [ ] **Step 2: Show the debt banner in `AffiliateOverview.tsx`**

In `app/affiliate/AffiliateOverview.tsx`, add `clawback_debt_cents` to the `StatsData` interface (currently lines 9-17):
```ts
interface StatsData {
  total_earned_cents: number
  pending_payout_cents: number
  clawback_debt_cents: number
  total_orders: number
  total_clicks: number
  conversion_rate: number
  weekly_sales?: Array<{ week: string; amount_cents: number; orders: number }>
  top_products?: Array<{ product_name: string; units: number }>
}
```

Add a debt banner right after the "Ganancias totales" card closes (after the `</div>` that closes the `bg-gradient-to-br from-emerald-50...` card block — the block starting at line 67; insert the banner immediately before the `<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">` stats row that currently follows it):
```tsx
      {stats.clawback_debt_cents > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-amber-800">Saldo a favor de la tienda</p>
            <p className="text-xs text-amber-700 mt-0.5">Por un reembolso previo — se descontará de tu próximo pago.</p>
          </div>
          <p className="text-lg font-black text-amber-800">{formatPrice(stats.clawback_debt_cents)}</p>
        </div>
      )}
```

- [ ] **Step 3: Type-check**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/affiliate/stats/route.ts app/affiliate/AffiliateOverview.tsx
git commit -m "feat: show clawback debt balance to affiliates"
```

---

## Task 16: Remove the dead legacy status route

**Files:**
- Delete: `app/api/orders/[id]/status/route.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (confirmed zero callers in the codebase — verified via `grep -rn "orders/\[id\]/status\|api/orders/.*status"` across `app`, `lib`, `components` during plan research, no matches outside the route file itself).

- [ ] **Step 1: Confirm there are still no callers before deleting**

Run: `cd /Users/quiron/CascadeProjects/nurei && grep -rn "api/orders/\[id\]/status\|orders/\${.*}/status" app lib components --include="*.ts" --include="*.tsx"`
Expected: no output (only the route file itself would match, and it's excluded by the pattern not matching route definitions).

- [ ] **Step 2: Delete the file**

```bash
git rm app/api/orders/\[id\]/status/route.ts
```

This route bypassed `DB_STATUS_MAP` entirely (wrote `orders.status` directly) and would have accepted `'refunded'` per `updateStatusSchema` (`lib/validations/order.ts:27`) without any of the new refund logic — a second, inconsistent path to reach the same status this whole feature is built around. Since Task 3 already closed the primary generic-dropdown path and this route has no callers, removing it now closes the last unguarded way to fake a refund.

- [ ] **Step 3: Type-check and confirm the build still resolves routes correctly**

Run: `cd /Users/quiron/CascadeProjects/nurei && npx tsc --noEmit`
Expected: no new type errors (deleting an unreferenced route file cannot break other files that don't import it — Next.js route files are never imported directly).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove dead legacy order status route"
```

---

## Task 17: Manual E2E verification

**Files:** none (verification only).

**Interfaces:** Consumes the full feature built in Tasks 1-16.

- [ ] **Step 1: Run the full test suite**

Run: `cd /Users/quiron/CascadeProjects/nurei && npm test`
Expected: all tests pass, including the new files from Tasks 4 and 6.

- [ ] **Step 2: Start the dev server**

Run: `cd /Users/quiron/CascadeProjects/nurei && npm run dev` (background)
Expected: server starts on the configured port with no build errors.

- [ ] **Step 3: Browser check — permission gating**

Using an admin account whose role has `reembolsos: 'sin_acceso'` (the seeded default for `admin`/`operador`/`consulta` from Task 1), open an order detail page for a paid order.
Expected: the "Reembolsar" button is visible (client doesn't hide it, per Task 13's design note) but clicking "Confirmar reembolso" returns a 403 toast ("No tienes permiso para esta acción").

Then log in as a `super_admin` (or grant `reembolsos: 'total'` to the test role via `app/admin/usuarios` → Roles, built in Task 11) and confirm the button now succeeds.

- [ ] **Step 4: Browser check — full Stripe refund**

Using Stripe test mode (`STRIPE_SECRET_KEY` starting with `sk_test_`), place a test order paid by card, then from the order detail page click "Reembolsar", confirm the full remaining amount, and submit.
Expected: success toast, `order.payment_status` becomes `refunded`, `order.status` becomes `refunded`, the refund appears in the new "Historial de reembolsos" section, and the Stripe test-mode dashboard shows the refund against the payment intent.

- [ ] **Step 5: Browser check — partial refund**

On a different paid test order, refund a partial amount (e.g. half the total).
Expected: `payment_status` becomes `partially_refunded`, `status` is unchanged, "Reembolsar" is still available with the reduced remaining balance, and a second refund up to the remaining balance succeeds.

- [ ] **Step 6: Browser check — manual/transfer refund**

On a test order with `payment_method` set to `transfer`/`bank_transfer`/`cash`, open the refund modal and confirm the reference-note field is required and no Stripe call happens (check server logs / network tab — no request to `api.stripe.com`).
Expected: refund succeeds and is recorded with `refund_method` = `bank_transfer` or `cash` per Task 4's `resolveRefundMethod` mapping.

- [ ] **Step 7: Browser check — affiliate commission clawback**

Using an affiliate coupon/link, place and confirm an order so a commission attribution is created (`payout_status: 'approved'`), then refund that order fully from the admin side.
Expected: in the affiliate's `/affiliate/ventas` page, the order row shows the "⚠️ Pedido reembolsado — comisión ajustada" note and the commission amount reflects the adjustment (`commission_amount_cents - refund_adjustment_cents`). Repeat with an attribution already marked `paid` (via `app/admin/affiliates/[id]/page.tsx`'s "Registrar pago" flow) and confirm `/affiliate` (overview) now shows the amber "Saldo a favor de la tienda" banner with the clawed-back amount, and that the next payout for that affiliate (Task 10) nets it out.

- [ ] **Step 8: Browser check — generic dropdown no longer offers "Reembolsado"**

On `/admin/pedidos`, open the status dropdown for a `delivered` or `cancelled` order.
Expected: "Reembolsado" is no longer in the list (Task 3's fix) — the dedicated modal on the detail page is the only path.

- [ ] **Step 9: Report results**

Summarize pass/fail for each check above. Any failure blocks marking this plan complete — go back to the relevant task, fix, and re-run this task's checks from Step 1.
