# Refund System — Design Spec
**Date:** 2026-07-16
**App:** Nurei (Next.js + Supabase + Stripe)
**Status:** Approved

---

## 1. Overview

Nurei has no working refund system today. Investigation found a partially-built stub:

- `OrderStatus` has a `'refunded'` value in the TypeScript type, in `ORDER_STATUS_MAP`, in `VALID_STATUS_TRANSITIONS`, and in the zod schema — but the `orders.status` CHECK constraint in the DB never got a migration to accept it. When an admin picks "Reembolsado" from the generic status dropdown, `updateOrderStatus()` silently rewrites it to `status='cancelled'` (only `payment_status='refunded'` and a breadcrumb in `order_updates.metadata.logical_status` preserve the real intent).
- The admin order **detail** page explicitly filters `'refunded'` out of its primary action button, so it's unreachable there. The order **list** page's generic dropdown *does* expose it, but the confirm modal only captures an optional free-text note — no amount, no refund method, no Stripe call.
- `order_refunds` (amount_cents, reason, refund_method, processed_by, notes) already exists as a table, RLS-locked admin-read-only, with a migration comment stating "no app code writes this." Analytics (`getRefundsAnalysis`) reads it and will always show zero.
- No `stripe.refunds.create()` call exists anywhere. No `charge.refunded` webhook handler exists.
- `affiliate_attributions.payout_status` has no reversal/clawback state. Refunding an order never touches the affiliate ledger.
- No email is ever sent for `cancelled` or `refunded` orders.

This spec builds the real thing: a permissioned, auditable refund flow that executes the actual money movement (Stripe API or manual/transfer acknowledgment), keeps order and affiliate-commission state consistent, and makes refunded orders clearly visible to affiliates so the "create fake order + cancel it, keep the commission" fraud path is closed.

---

## 2. Scope

**In scope:**
- New `reembolsos` permission module, enforced server-side on the refund endpoint (existing granular `admin_roles.permissions` system is currently defined but not enforced anywhere — this spec enforces it for refunds specifically, not retroactively for other admin routes).
- Refund eligible from any order status where `payment_status` is `'paid'` or `'partially_refunded'` (not just `delivered`/`cancelled`).
- Partial or full refunds, amount editable up to the remaining refundable balance.
- Stripe refunds executed automatically via `stripe.refunds.create()`. Transfer/cash/other methods recorded as manually-confirmed refunds (no bank API integration exists to automate these).
- Proportional affiliate commission adjustment: reduces unpaid commission, or creates a clawback debt if the commission was already paid out.
- Refunded/cancelled orders clearly flagged in the affiliate-facing dashboard (sales list + payouts), including any clawback debt.
- Refund confirmation email to the customer.
- Removing the unsafe generic-dropdown refund path (list page).
- Fixing/removing the divergent legacy status route if it turns out to be dead code (see §8).

**Out of scope:**
- Maker-checker (two-person approval) — user chose single-permission + confirmation.
- Retrofitting granular permission enforcement onto all other admin routes.
- Automated bank transfer refund execution (no provider integration exists).
- Automatic inventory restock on refund (not requested; can be a follow-up).
- Multi-currency (Nurei operates in MXN only).

---

## 3. Database Schema

### 3.1 Modified tables

**`orders`**
```sql
-- Widen status CHECK to accept the real 'refunded' value (was silently mapped to 'cancelled')
alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'failed', 'refunded'));

-- Widen payment_status to distinguish partial from full refund
alter table public.orders drop constraint orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded'));

alter table public.orders add column refunded_amount_cents bigint not null default 0
  check (refunded_amount_cents >= 0);
alter table public.orders add column refunded_at timestamptz;
```

**`order_refunds`** (already exists — activated, not recreated)
```sql
alter table public.order_refunds add column stripe_refund_id text;
alter table public.order_refunds add column status text not null default 'succeeded'
  check (status in ('pending', 'succeeded', 'failed'));

-- Replace the admin-read-only-only policy comment/intent: app code now writes this
-- via the service-role client in processRefund(), same pattern as other admin
-- financial writes (e.g. record_attribution_atomic). No new RLS policy needed
-- for the service-role path; existing admin-read policy stays for dashboard reads.
```

**`affiliate_attributions`**
```sql
alter table public.affiliate_attributions drop constraint affiliate_attributions_payout_status_check;
alter table public.affiliate_attributions add constraint affiliate_attributions_payout_status_check
  check (payout_status in ('pending', 'approved', 'paid', 'clawback_pending', 'reversed'));

alter table public.affiliate_attributions add column refund_adjustment_cents bigint not null default 0
  check (refund_adjustment_cents >= 0);
```

**`affiliate_profiles`**
```sql
-- Dedicated debt column instead of letting pending_payout_cents go negative.
-- Reason (found during design self-review): process_affiliate_payout_atomic
-- (026_affiliate_payout_approved.sql) does
--   pending_payout_cents = greatest(0, pending_payout_cents - v_total_cents)
-- as a defensive floor. If a clawback pushed pending_payout_cents negative,
-- the very next payout run would silently clamp it back to 0 and erase the
-- debt. Tracking debt separately avoids corrupting that existing invariant.
alter table public.affiliate_profiles add column clawback_debt_cents bigint not null default 0
  check (clawback_debt_cents >= 0);
```

### 3.2 Types (`types/index.ts`)
```ts
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'clawback_pending' | 'reversed'

// Order gains:
refunded_amount_cents: number
refunded_at: string | null

// AffiliateProfile gains:
clawback_debt_cents: number

// AffiliateAttribution gains:
refund_adjustment_cents: number
```

---

## 4. Permissions

- Add `'reembolsos'` to `AdminModule` (`types/index.ts`).
- Seed default permission levels in the `admin_roles` migration: `super_admin = 'total'`; `admin`, `operador`, `consulta` = `'sin_acceso'` (configurable afterward via the existing admin-roles management UI — no code change needed to grant it to another role later).
- New helper `requireAdminPermission(req, module: AdminModule, minLevel: PermissionLevel)` in `lib/server/`, alongside the existing `requireAdmin()`. It loads `user_profiles.admin_role_id → admin_roles.permissions[module]` and enforces `total`/`escritura` as sufficient, `lectura`/`sin_acceso` as insufficient, per an explicit rank order.
- Applied to: `POST /api/admin/orders/[id]/refund` (execute) requires `escritura`+; refund history read (already covered by existing order GET) requires `lectura`+.
- This does **not** change `requireAdmin()` itself or retrofit permission checks onto unrelated admin routes — scoped strictly to the new refund endpoint.

---

## 5. Refund Execution Flow

New endpoint: `POST /api/admin/orders/[id]/refund`
Body: `{ amountCents: number, reason: string, referenceNote?: string }`

Server logic (`lib/server/process-refund.ts`, new):

1. `requireAdminPermission(req, 'reembolsos', 'escritura')`.
2. Load order. Validate:
   - `payment_status` is `'paid'` or `'partially_refunded'`.
   - `amountCents > 0` and `amountCents <= (order.total_cents - order.refunded_amount_cents)`.
   - `reason` non-empty.
3. Branch on `order.payment_method`:
   - `stripe_card` / `card` / `stripe`: call `stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id, amount: amountCents, reason: 'requested_by_customer' })`. On failure, return an error to the admin UI — no DB writes happen (fail closed, nothing partially applied).
   - `transfer` / `bank_transfer` / `cash` / `oxxo` / other: no external call. `referenceNote` (e.g. transfer folio) is stored in `order_refunds.notes`. Treated as immediately `succeeded` since the admin performed the transfer outside the system before confirming here.
4. Call RPC `process_order_refund_atomic(order_id, amount_cents, reason, refund_method, stripe_refund_id, notes, processed_by)` — new Postgres function following the existing atomic-RPC pattern (`record_attribution_atomic`, `process_affiliate_payout_atomic`). Inside one transaction it:
   a. Inserts the `order_refunds` row.
   b. Updates `orders.refunded_amount_cents` (+= amount), `payment_status` (`'refunded'` if fully covered, else `'partially_refunded'`), `status = 'refunded'` and `refunded_at = now()` **only** when the refund is full.
   c. Finds the order's `affiliate_attributions` row (if any) and applies a proportional adjustment: `refundFraction = amountCents / order.total_cents`; `adjustment = floor(commission_amount_cents * refundFraction)`.
      - If `payout_status` in `('pending','approved')`: increase `refund_adjustment_cents` by `adjustment`; decrement `affiliate_profiles.pending_payout_cents` by `adjustment` (mirrors the increment done at attribution-creation time, so the affiliate's real-time pending balance stays accurate); if `commission_amount_cents - refund_adjustment_cents <= 0`, set `payout_status = 'reversed'`.
      - If `payout_status = 'paid'`: set `payout_status = 'clawback_pending'`, increase `refund_adjustment_cents`, decrement `affiliate_profiles.total_earned_cents` by `adjustment` (floored at 0, it's a lifetime stat) and increase `affiliate_profiles.clawback_debt_cents` by `adjustment` — this is the debt recovered from the affiliate's *next* payout (see §5.2), not a negative `pending_payout_cents`.
   d. Inserts an `order_updates` audit row (`action: 'refund'`, admin id, amount, reason).
5. On RPC success: send the refund confirmation email (best-effort, logged but not fatal if it fails — matches the existing pattern for other order emails).
6. If the Stripe call succeeded but the RPC write fails afterward, this is logged as a critical/high-severity error (can't roll back a real Stripe refund) rather than silently swallowed, surfaced for manual reconciliation. This is a known, documented edge case — not a fully automated resolution.

### 5.1 Stripe webhook
Add `charge.refunded` and `refund.updated` handlers to `app/api/webhooks/stripe/route.ts` to reconcile `order_refunds.status` (`pending → succeeded/failed`) via `stripe_refund_id`, covering refunds that don't settle synchronously.

### 5.2 Required change to the existing payout RPC

`process_affiliate_payout_atomic` (`026_affiliate_payout_approved.sql`) must change in two ways, or clawbacks silently disappear:

1. Its `v_total_cents` sum currently uses `commission_amount_cents` directly. It must instead sum `(commission_amount_cents - refund_adjustment_cents)` so a partially-refunded-but-still-approved attribution pays out its net amount, not its original gross amount.
2. Before disbursing, net the payout against any standing debt: `v_net_payable := greatest(0, v_total_cents - v_clawback_debt)`, where `v_clawback_debt := (select clawback_debt_cents from affiliate_profiles where id = p_affiliate_id for update)`. Reduce `clawback_debt_cents` by `least(v_total_cents, clawback_debt_cents)`, insert the `commission_payments` row with `amount_cents = v_net_payable`, and note the debt deduction in `commission_payments.notes` when non-zero, so it's auditable. `pending_payout_cents` continues to decrement by the full `v_total_cents` as today (that part isn't touched) — only the *actual cash disbursed* is reduced by the debt.

This is a real change to existing, already-shipped code, not just new code — flagging it explicitly since it affects a function other flows depend on.

---

## 6. Admin UI

**Order detail page** (`app/admin/pedidos/[id]/page.tsx`):
- New "Reembolsar" button, shown only when the signed-in admin has `reembolsos ≥ escritura` and `order.total_cents - order.refunded_amount_cents > 0` on a paid order.
- Opens `RefundModal`: shows payment method, total paid, already refunded, remaining refundable balance; amount input (default = remaining balance, editable down); reason dropdown (`Producto defectuoso`, `Cliente cambió de opinión`, `Error en el pedido`, `Otro`) + free-text notes; for non-Stripe methods, a required reference/folio field. Confirm button states plainly what will happen (e.g. "Se reembolsarán $450.00 MXN a la tarjeta vía Stripe" / "...marcado como reembolso manual por transferencia").
- New refund history section listing `order_refunds` rows (date, amount, method, reason, processed by, status).

**Order list page** (`app/admin/pedidos/page.tsx`):
- Remove `'refunded'` from the generic status dropdown entirely — the only path to a refund becomes the dedicated modal/endpoint above. This closes the current gap where any admin could "refund" via a bare status change with just a free-text note.

**Badges**: extend existing status badge components to render `payment_status = 'partially_refunded'` distinctly from `'refunded'`.

---

## 7. Affiliate-Facing Visibility

**`app/affiliate/ventas/page.tsx`**: when the joined order has `status = 'refunded'` or `payment_status = 'partially_refunded'`, render a clear inline note (e.g. "⚠️ Pedido reembolsado — comisión ajustada") next to that row, and extend `PAYOUT_STATUS_CONFIG` with `clawback_pending` ("Recuperación pendiente") and `reversed` ("Cancelada") entries.

**`app/affiliate/pagos/page.tsx`**: if `clawback_debt_cents > 0`, show it plainly as a debt netted against the next payout — e.g. "Saldo a favor de la tienda: $X — se descontará de tu próximo pago."

---

## 8. Legacy Route Cleanup

`app/api/orders/[id]/status/route.ts` writes `orders.status` directly, bypassing `DB_STATUS_MAP`. It would break (CHECK violation risk pre-migration, and now bypasses the new refund-specific validation/RPC post-migration) if ever called with `'refunded'`. Before touching it: grep the codebase for callers. If unused, delete it. If used for something unrelated to refunds, leave its non-refund behavior intact but ensure it cannot be used to set `status='refunded'` (route refund attempts through the new endpoint only).

---

## 9. Email

New template `renderOrderRefundedHtml(props)` in `lib/email/templates/order-emails-html.ts` (amount refunded, reason, method, remaining balance if partial) and `sendOrderRefundEmail(orderId, refundDetails)` in `lib/email/send-order-emails.ts`, called from the refund flow (§5 step 5). Follows the same structure as the existing `preparing`/`shipped`/`delivered` emails.

---

## 10. Testing Plan

Given this moves real money (Stripe API calls, affiliate payout ledger), tests are required before this ships, not optional:

- **Unit**: `process-refund.ts` eligibility validation (over-refund rejected, zero/negative amount rejected, wrong payment_status rejected); proportional commission math (full refund, partial refund, rounding via `Math.floor`); permission gate (denied for `sin_acceso`/`lectura`, allowed for `escritura`/`total`).
- **Integration**: refund RPC atomicity — order + `order_refunds` + `affiliate_attributions` + `affiliate_profiles` updated together; Stripe client mocked for both success and failure paths (failure must leave zero DB writes). Also cover the modified `process_affiliate_payout_atomic`: a payout after a clawback correctly nets `clawback_debt_cents` out of the disbursed amount and does not resurrect the debt on a subsequent unrelated payout.
- **E2E / manual browser check**: admin without `reembolsos` permission cannot see/trigger the button; full-refund happy path via Stripe test mode; partial refund reduces balance correctly and leaves order status unchanged; manual/transfer refund path; affiliate dashboard shows the refunded-order note and clawback balance after a refund on a paid-out commission.

---

## 11. Migration File Plan

One new migration: `050_refund_system.sql` (latest at spec time is `049_fix_claim_coupon_atomic_column.sql`) covering all of §3.1 plus the `process_order_refund_atomic` RPC from §5, using `drop constraint if exists` / `add constraint` on the default-named checks (`orders_status_check`, `orders_payment_status_check`, `affiliate_attributions_payout_status_check`), matching the pattern already used in `026_affiliate_payout_approved.sql`. Reviewed with the `database-reviewer` agent before execution, per project convention for schema changes touching money.
