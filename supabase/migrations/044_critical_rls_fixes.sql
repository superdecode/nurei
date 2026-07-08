-- Critical security fixes found in security audit:
--
-- 1. order_items / order_refunds had RLS never enabled at all — full anonymous
--    read/write/delete via the public anon key (order_items carries cost/margin
--    data extracted from every order; order_refunds carries refund amounts).
-- 2. "Orders: anyone can create" used `with check (true)` with no ownership or
--    status constraints — anyone with the anon key could POST a fabricated
--    order with payment_status='paid', status='delivered', and an arbitrary
--    user_id, planting fake history in another customer's account.
-- 3. "Attributions: system insert" / "Referral clicks: system insert" also used
--    `with check (true)`. Both tables are written exclusively via the
--    service-role client (lib/server/affiliate-attribution.ts, app/r/[slug],
--    app/api/referral/click) which bypasses RLS entirely — these anon-facing
--    policies serve no legitimate purpose and let a malicious affiliate craft
--    a fake paid order + matching commission attribution for a real payout.

-- ─── order_items: lock down, admin read-only ───────────────────────────────
alter table public.order_items enable row level security;

create policy "Order items: admin read" on public.order_items
  for select using (public.is_admin());

-- The extraction trigger must keep working when orders are inserted via the
-- session-scoped client (app/api/orders POST), not just the service role —
-- make it SECURITY DEFINER so it bypasses RLS on order_items regardless of
-- the invoking role, with a locked search_path to avoid hijacking.
alter function public.handle_order_items_trigger() security definer set search_path = public;
alter function public.extract_order_items() security definer set search_path = public;

-- ─── order_refunds: lock down, admin read-only (no app code writes this) ───
alter table public.order_refunds enable row level security;

create policy "Order refunds: admin read" on public.order_refunds
  for select using (public.is_admin());

-- ─── orders: tighten the wide-open insert policy ───────────────────────────
drop policy if exists "Orders: anyone can create" on public.orders;

create policy "Orders: create own pending" on public.orders
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and payment_status = 'pending'
    and (user_id is null or user_id = auth.uid())
  );

-- ─── affiliate_attributions: remove unused anon-facing insert policy ───────
-- All writes go through lib/server/affiliate-attribution.ts using the
-- service-role client, which bypasses RLS — no legitimate path needs this.
drop policy if exists "Attributions: system insert" on public.affiliate_attributions;

-- ─── referral_clicks: same — only written via service-role client ─────────
drop policy if exists "Referral clicks: system insert" on public.referral_clicks;
