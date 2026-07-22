# Programa de Lealtad y Gamificación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a points/tier loyalty system ("Nurei Coins") with 5 lifetime-points tiers, a cart-triggered prize wheel, and point redemption in checkout — fully integrated with nurei's existing Supabase schema, coupon engine, and Stripe payment webhook.

**Architecture:** All point/tier state lives in two Postgres tables (`loyalty_points`, `loyalty_ledger`) mutated only through `SECURITY DEFINER` RPCs (mirrors the existing `claim_coupon_atomic` / `process_order_refund_atomic` pattern — no direct client writes, RLS grants read-only). Points are earned and redeemed at the same lifecycle point coupons are claimed: Stripe's `checkout.session.completed` webhook, not at order creation. Wheel prizes and tier-up rewards are issued as ordinary coupons through the existing `coupons` / `user_coupons` tables — no new discount-application code path.

**Tech Stack:** Next.js 16 (App Router, TypeScript), Supabase (Postgres + RLS + RPC), Zustand, framer-motion (already a dependency), Zod, Vitest.

## Global Constraints

- All money amounts are integers in **centavos** (never pesos, never floats) — matches every existing table (`orders.total`, `coupons.value`, etc.).
- Every new table/column follows the lower-case snake_case SQL style used throughout `supabase/migrations/*.sql`.
- Every RPC that mutates loyalty state is `SECURITY DEFINER`, sets `search_path = public, pg_temp`, and is `REVOKE`d from `public, anon, authenticated` then `GRANT`ed only to `service_role` — exactly like `supabase/migrations/041_atomic_coupon_claim.sql` and `053_fix_refund_rpc_security_and_math.sql`.
- Points are earned/redeemed only for **authenticated** users (`orders.user_id` not null). Guest checkout never touches loyalty tables.
- Tier is computed from `lifetime_points` (never decreases on redemption — only `refund_clawback` may lower it, which is a deliberate anti-fraud exception).
- Tier thresholds (lifetime points): Curioso 0–999, Antojadizo 1,000–2,499, Fanático 2,500–6,499, Snack Lover 6,500–17,499, Leyenda 17,500+.
- Tier multipliers on purchase points: Curioso/Antojadizo 1.0x, Fanático 1.2x, Snack Lover/Leyenda 1.5x.
- Purchase points: `floor(chargeable_cents / 100)` before multiplier, where `chargeable_cents = max(0, subtotal - coupon_discount - points_discount)` (shipping and points-redeemed cents never earn points).
- Signup bonus: 100 points, awarded exactly once per user via the existing `handle_new_user()` trigger (covers email/password and Google OAuth signups alike).
- Redemption rate: 100 pts = 1000 centavos ($10 MXN), minimum redemption 100 pts, must be a multiple of 100.
- Points discount is additive with coupon discount: `total = max(0, subtotal + shipping_fee - coupon_discount - points_discount)`, and `points_discount ≤ (subtotal - coupon_discount)`.
- Wheel trigger: cart subtotal ≥ 39900 centavos ($399 MXN), one spin per `cart_session_id`, resolved server-side only.
- Anti-invasividad: the wheel auto-opens at most once per `cart_session_id`; the loyalty widget never opens itself; tier-up notice is a single toast, never a blocking modal or repeated banner.

---

## File Structure

```
supabase/migrations/
  20260722120000_loyalty_core_schema.sql       # tables, tier config, award_points_atomic, signup hook
  20260722121000_loyalty_wheel.sql             # wheel_spins, resolve_wheel_spin_atomic, seed wheel coupons
  20260722122000_loyalty_orders_and_refunds.sql # orders/order_refunds columns, claim + refund-reversal RPCs

lib/server/loyalty/
  points.ts            # pure functions: tier lookup table, points-earned calc, redemption-discount calc (unit tested)
  engine.ts            # server-side orchestration: awardPointsForPaidOrder, claimRedeemedPointsForPaidOrder, validateRedemption

lib/supabase/queries/
  loyalty.ts           # getLoyaltyStatus, getLedgerHistory (thin Supabase reads, mirrors profile.ts)

app/api/loyalty/
  status/route.ts           # GET current balance/tier/history for the authenticated user
  redeem/validate/route.ts  # POST validate a points redemption amount against subtotal (mirrors apply-coupon)
  wheel/spin/route.ts       # POST resolve a wheel spin for the current cart session

app/api/orders/create/route.ts        # MODIFY: accept points_redeemed, compute/validate points_discount
app/api/webhooks/stripe/route.ts      # MODIFY: award + claim points on payment; restore points on failed-refund reversal
lib/server/process-refund.ts          # MODIFY: claw back points proportional to the refunded amount
lib/validations/order-create-payload.ts # MODIFY: add points_redeemed field

lib/stores/
  loyaltyStore.ts       # zustand: caches status from /api/loyalty/status, pending wheel spin result
  cart.ts               # MODIFY: add cartSessionId (uuid, regenerated on clearCart)

components/loyalty/
  LoyaltyTierBadge.tsx           # small reusable badge for the current tier
  LoyaltyWidget.tsx              # passive floating button + Sheet drawer (balance, tier, history, coupons)
  GamificationWheel.tsx          # Dialog-based wheel, framer-motion spin + CSS confetti
  CheckoutLoyaltyRedemption.tsx  # range input to redeem points as checkout discount

app/(public)/layout.tsx        # MODIFY: mount LoyaltyWidget + GamificationWheel
app/(public)/checkout/page.tsx # MODIFY: wire CheckoutLoyaltyRedemption into totals + order payload

__tests__/loyalty/
  points.test.ts        # unit tests for lib/server/loyalty/points.ts
```

---

### Task 1: Core schema — tables, tier config, `award_points_atomic`, signup hook

**Files:**
- Create: `supabase/migrations/20260722120000_loyalty_core_schema.sql`

**Interfaces:**
- Produces: table `public.loyalty_points(user_id uuid pk, balance int, lifetime_points int, tier text, active_multiplier_expires_at timestamptz, updated_at timestamptz)`.
- Produces: table `public.loyalty_ledger(id uuid pk, user_id uuid, delta int, reason text, order_id uuid nullable, created_at timestamptz)`, with `reason in ('signup','purchase','redemption','refund_clawback','refund_clawback_reversed')`.
- Produces: table `public.loyalty_tier_config(tier text pk, min_points int, multiplier numeric, tier_up_coupon_code text nullable)`, seeded with the 5 tiers.
- Produces: function `public.loyalty_tier_for_points(p_points integer) returns text`.
- Produces: RPC `public.award_points_atomic(p_user_id uuid, p_base_delta integer, p_reason text, p_order_id uuid default null) returns jsonb` — later tasks call this by exact name/signature.
- Produces: 4 seed rows in `public.coupons` with codes `NIVEL-ANTOJADIZO` ($25), `NIVEL-FANATICO` ($75), `NIVEL-SNACKLOVER` ($150), `NIVEL-LEYENDA` ($250), all `type='fixed'`.
- Modifies: `public.handle_new_user()` (originally defined in `001_schema.sql:254-261`) to also award 100 signup points.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================
-- LOYALTY: core schema (points, ledger, tiers)
-- ============================================

create table if not exists public.loyalty_points (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  tier text not null default 'curioso',
  active_multiplier_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('signup', 'purchase', 'redemption', 'refund_clawback', 'refund_clawback_reversed')),
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_loyalty_ledger_user on public.loyalty_ledger(user_id, created_at desc);

-- Only one 'purchase' ledger row per order — makes award_points_atomic idempotent
-- against Stripe webhook retries.
create unique index idx_loyalty_ledger_purchase_once
  on public.loyalty_ledger(order_id)
  where reason = 'purchase' and order_id is not null;

create table if not exists public.loyalty_tier_config (
  tier text primary key,
  min_points integer not null unique,
  multiplier numeric not null default 1,
  tier_up_coupon_code text
);

insert into public.loyalty_tier_config (tier, min_points, multiplier, tier_up_coupon_code) values
  ('curioso',     0,     1.0, null),
  ('antojadizo',  1000,  1.0, 'NIVEL-ANTOJADIZO'),
  ('fanatico',    2500,  1.2, 'NIVEL-FANATICO'),
  ('snack_lover', 6500,  1.5, 'NIVEL-SNACKLOVER'),
  ('leyenda',     17500, 1.5, 'NIVEL-LEYENDA')
on conflict (tier) do nothing;

-- Seed the 4 tier-up reward coupons (fixed-amount, unlimited global uses —
-- user_coupons.unique(user_id, coupon_id) is what makes each user only ever
-- receive one, at the moment award_points_atomic crosses that tier).
insert into public.coupons (code, type, value, min_order_amount, max_uses, is_active, description) values
  ('NIVEL-ANTOJADIZO',  'fixed', 2500,  0, null, true, 'Recompensa por alcanzar el nivel Antojadizo'),
  ('NIVEL-FANATICO',    'fixed', 7500,  0, null, true, 'Recompensa por alcanzar el nivel Fanático'),
  ('NIVEL-SNACKLOVER',  'fixed', 15000, 0, null, true, 'Recompensa por alcanzar el nivel Snack Lover'),
  ('NIVEL-LEYENDA',     'fixed', 25000, 0, null, true, 'Recompensa por alcanzar el nivel Leyenda')
on conflict (code) do nothing;

alter table public.loyalty_points enable row level security;
alter table public.loyalty_ledger enable row level security;
alter table public.loyalty_tier_config enable row level security;

create policy "loyalty_points: users read own"
  on public.loyalty_points for select using (user_id = auth.uid());

create policy "loyalty_ledger: users read own"
  on public.loyalty_ledger for select using (user_id = auth.uid());

create policy "loyalty_tier_config: anyone can read"
  on public.loyalty_tier_config for select using (true);

-- ─── Tier lookup ────────────────────────────────────────────────────────────
create or replace function public.loyalty_tier_for_points(p_points integer)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select tier from public.loyalty_tier_config
  where min_points <= p_points
  order by min_points desc
  limit 1;
$$;

-- ─── award_points_atomic ────────────────────────────────────────────────────
-- Single entry point for every points change except redemption (see
-- claim_redeemed_points_atomic in a later migration). Applies the tier
-- multiplier + any active wheel 2x window for reason='purchase' only.
-- Idempotent per order for reason='purchase' via the partial unique index above.
create or replace function public.award_points_atomic(
  p_user_id     uuid,
  p_base_delta  integer,
  p_reason      text,
  p_order_id    uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row            public.loyalty_points%rowtype;
  v_multiplier     numeric := 1;
  v_effective_delta integer;
  v_old_tier       text;
  v_new_tier       text;
  v_old_min        integer;
  v_new_min        integer;
  v_coupon_code    text;
  v_coupon_id      uuid;
  v_ledger_id      uuid;
begin
  if p_base_delta = 0 then
    return jsonb_build_object('ok', true, 'delta', 0);
  end if;

  insert into public.loyalty_points (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_row from public.loyalty_points where user_id = p_user_id for update;
  v_old_tier := v_row.tier;

  if p_reason = 'purchase' then
    select multiplier into v_multiplier from public.loyalty_tier_config where tier = v_row.tier;
    if v_row.active_multiplier_expires_at is not null and v_row.active_multiplier_expires_at > now() then
      v_multiplier := v_multiplier * 2;
    end if;
    v_effective_delta := floor(p_base_delta * v_multiplier)::integer;
  else
    v_effective_delta := p_base_delta;
  end if;

  insert into public.loyalty_ledger (user_id, delta, reason, order_id)
  values (p_user_id, v_effective_delta, p_reason, p_order_id)
  on conflict (order_id) where reason = 'purchase' and order_id is not null do nothing
  returning id into v_ledger_id;

  if v_ledger_id is null and p_reason = 'purchase' then
    -- Already awarded for this order (webhook retry) — no-op.
    return jsonb_build_object(
      'ok', true, 'delta', 0, 'balance', v_row.balance,
      'lifetime_points', v_row.lifetime_points, 'tier', v_row.tier, 'tier_changed', false
    );
  end if;

  update public.loyalty_points
  set balance = greatest(0, balance + v_effective_delta),
      lifetime_points = greatest(0, lifetime_points + case
        when p_reason = 'refund_clawback' then v_effective_delta
        when v_effective_delta > 0 then v_effective_delta
        else 0
      end),
      updated_at = now()
  where user_id = p_user_id
  returning * into v_row;

  v_new_tier := public.loyalty_tier_for_points(v_row.lifetime_points);

  if v_new_tier <> v_old_tier then
    update public.loyalty_points set tier = v_new_tier where user_id = p_user_id;

    select min_points into v_old_min from public.loyalty_tier_config where tier = v_old_tier;
    select min_points into v_new_min from public.loyalty_tier_config where tier = v_new_tier;

    if v_new_min > v_old_min then
      select tier_up_coupon_code into v_coupon_code from public.loyalty_tier_config where tier = v_new_tier;
      if v_coupon_code is not null then
        select id into v_coupon_id from public.coupons where upper(code) = upper(v_coupon_code);
        if v_coupon_id is not null then
          insert into public.user_coupons (user_id, coupon_id)
          values (p_user_id, v_coupon_id)
          on conflict (user_id, coupon_id) do nothing;
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'delta', v_effective_delta,
    'balance', v_row.balance,
    'lifetime_points', v_row.lifetime_points,
    'tier', v_new_tier,
    'tier_changed', v_new_tier <> v_old_tier
  );
end;
$$;

revoke all on function public.award_points_atomic(uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.award_points_atomic(uuid, integer, text, uuid) to service_role;

-- ─── Signup hook: 100 pts on account creation ───────────────────────────────
-- Replaces the 001_schema.sql body verbatim, adding the loyalty award. Keeps
-- the same trigger binding (create trigger already points at this function name).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');

  perform public.award_points_atomic(new.id, 100, 'signup', null);

  return new;
end;
$$;
```

- [ ] **Step 2: Apply the migration locally**

Run: `supabase db push` (or `supabase migration up` per this project's normal workflow — check `package.json`/`supabase/config.toml` if unsure, this repo uses `supabase db push` per project memory).
Expected: migration applies with no errors; `loyalty_points`, `loyalty_ledger`, `loyalty_tier_config` exist in the `public` schema.

- [ ] **Step 3: Manually verify the signup hook**

Run in the Supabase SQL editor (or `psql`):
```sql
select public.award_points_atomic(
  (select id from auth.users order by created_at desc limit 1),
  0, 'purchase', null
); -- sanity call, should return {"ok": true, "delta": 0}
```
Then sign up a brand-new test user through the app and check:
```sql
select * from public.loyalty_points where user_id = '<new-user-id>';
-- expect balance = 100, lifetime_points = 100, tier = 'curioso'
select * from public.loyalty_ledger where user_id = '<new-user-id>';
-- expect one row: delta=100, reason='signup'
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260722120000_loyalty_core_schema.sql
git commit -m "feat: add loyalty points core schema and signup bonus"
```

---

### Task 2: Wheel of Snacks — table, RPC, seed coupons

**Files:**
- Create: `supabase/migrations/20260722121000_loyalty_wheel.sql`

**Interfaces:**
- Consumes: `public.loyalty_points` (Task 1), `public.coupons`/`public.user_coupons` (existing).
- Produces: table `public.wheel_spins(id uuid pk, user_id uuid, cart_session_id text, prize_type text, coupon_code text nullable, spun_at timestamptz)`.
- Produces: RPC `public.resolve_wheel_spin_atomic(p_user_id uuid, p_cart_session_id text, p_cart_subtotal_cents integer) returns jsonb` — later tasks call this by exact name/signature.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================
-- LOYALTY: Wheel of Snacks
-- ============================================

create table if not exists public.wheel_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cart_session_id text not null,
  prize_type text not null check (prize_type in ('no_prize', 'discount_pct_5', 'discount_pct_10', 'free_shipping', 'points_multiplier_2x')),
  coupon_code text,
  spun_at timestamptz not null default now(),
  unique (user_id, cart_session_id)
);

create index idx_wheel_spins_user on public.wheel_spins(user_id);

alter table public.wheel_spins enable row level security;

create policy "wheel_spins: users read own"
  on public.wheel_spins for select using (user_id = auth.uid());

-- Seed the wheel's coupon-backed prizes. RULETA-ENVIO's value is a
-- placeholder for the standard shipping fee — adjust it from /admin/cupones
-- if the real fee differs, no code change needed.
insert into public.coupons (code, type, value, min_order_amount, max_uses, is_active, description) values
  ('RULETA-5',     'percentage', 5,    0, null, true, 'Premio de la Ruleta de Snacks: 5% de descuento'),
  ('RULETA-10',    'percentage', 10,   0, null, true, 'Premio de la Ruleta de Snacks: 10% de descuento'),
  ('RULETA-ENVIO', 'fixed',      9900, 0, null, true, 'Premio de la Ruleta de Snacks: envío gratis')
on conflict (code) do nothing;

-- ─── resolve_wheel_spin_atomic ──────────────────────────────────────────────
-- One spin per (user, cart_session_id) — enforced by the unique index above,
-- not by an application-side check, so concurrent double-clicks can't win twice.
create or replace function public.resolve_wheel_spin_atomic(
  p_user_id             uuid,
  p_cart_session_id     text,
  p_cart_subtotal_cents integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_roll         numeric;
  v_prize_type   text;
  v_coupon_code  text;
  v_coupon_id    uuid;
  v_spin_id      uuid;
begin
  if p_cart_subtotal_cents < 39900 then
    return jsonb_build_object('ok', false, 'reason', 'below_threshold');
  end if;

  v_roll := random();

  if v_roll < 0.35 then
    v_prize_type := 'no_prize';           v_coupon_code := null;
  elsif v_roll < 0.60 then
    v_prize_type := 'discount_pct_5';     v_coupon_code := 'RULETA-5';
  elsif v_roll < 0.80 then
    v_prize_type := 'discount_pct_10';    v_coupon_code := 'RULETA-10';
  elsif v_roll < 0.92 then
    v_prize_type := 'free_shipping';      v_coupon_code := 'RULETA-ENVIO';
  else
    v_prize_type := 'points_multiplier_2x'; v_coupon_code := null;
  end if;

  begin
    insert into public.wheel_spins (user_id, cart_session_id, prize_type, coupon_code)
    values (p_user_id, p_cart_session_id, v_prize_type, v_coupon_code)
    returning id into v_spin_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_spun');
  end;

  if v_coupon_code is not null then
    select id into v_coupon_id from public.coupons where upper(code) = upper(v_coupon_code);
    if v_coupon_id is not null then
      insert into public.user_coupons (user_id, coupon_id)
      values (p_user_id, v_coupon_id)
      on conflict (user_id, coupon_id) do nothing;
    end if;
  end if;

  if v_prize_type = 'points_multiplier_2x' then
    insert into public.loyalty_points (user_id) values (p_user_id)
    on conflict (user_id) do nothing;

    update public.loyalty_points
    set active_multiplier_expires_at = now() + interval '24 hours', updated_at = now()
    where user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'ok', true, 'spin_id', v_spin_id, 'prize_type', v_prize_type, 'coupon_code', v_coupon_code
  );
end;
$$;

revoke all on function public.resolve_wheel_spin_atomic(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.resolve_wheel_spin_atomic(uuid, text, integer) to service_role;
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push`
Expected: no errors; `wheel_spins` table exists; 3 new rows in `coupons` (`RULETA-5`, `RULETA-10`, `RULETA-ENVIO`).

- [ ] **Step 3: Manually verify idempotency**

```sql
select public.resolve_wheel_spin_atomic('<some-user-id>', 'test-session-1', 40000);
-- expect {"ok": true, "prize_type": ..., ...}
select public.resolve_wheel_spin_atomic('<some-user-id>', 'test-session-1', 40000);
-- expect {"ok": false, "reason": "already_spun"}
select public.resolve_wheel_spin_atomic('<some-user-id>', 'test-session-2', 10000);
-- expect {"ok": false, "reason": "below_threshold"}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260722121000_loyalty_wheel.sql
git commit -m "feat: add Wheel of Snacks table and resolve_wheel_spin_atomic RPC"
```

---

### Task 3: Orders/refunds integration — columns, claim RPC, refund clawback RPCs

**Files:**
- Create: `supabase/migrations/20260722122000_loyalty_orders_and_refunds.sql`

**Interfaces:**
- Consumes: `public.loyalty_ledger`, `public.loyalty_tier_for_points` (Task 1).
- Produces: columns `orders.points_redeemed integer`, `orders.points_discount integer`, `orders.points_claimed_at timestamptz`.
- Produces: column `order_refunds.points_clawback integer`.
- Produces: RPC `public.claim_redeemed_points_atomic(p_order_id uuid) returns text` — called from the Stripe webhook (Task 6).
- Produces: RPC `public.reverse_loyalty_points_for_refund_atomic(p_order_id uuid, p_refund_id uuid, p_amount_cents bigint) returns void` — called from `lib/server/process-refund.ts` (Task 7).
- Produces: RPC `public.restore_loyalty_points_for_reversed_refund_atomic(p_refund_id uuid) returns void` — called from the Stripe webhook's failed-refund branch (Task 6).

- [ ] **Step 1: Write the migration**

```sql
-- ============================================
-- LOYALTY: orders integration + refund clawback
-- ============================================

alter table public.orders add column if not exists points_redeemed integer not null default 0;
alter table public.orders add column if not exists points_discount integer not null default 0;
alter table public.orders add column if not exists points_claimed_at timestamptz;
alter table public.order_refunds add column if not exists points_clawback integer not null default 0;

-- ─── claim_redeemed_points_atomic ───────────────────────────────────────────
-- Mirrors claimCouponForPaidOrder: the discount is only realized (points
-- actually deducted) once the order is paid. Idempotent via points_claimed_at.
create or replace function public.claim_redeemed_points_atomic(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order record;
begin
  select id, user_id, points_redeemed, points_claimed_at
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    return 'order_not_found';
  end if;

  if v_order.points_claimed_at is not null then
    return 'already_claimed';
  end if;

  if v_order.points_redeemed <= 0 or v_order.user_id is null then
    update public.orders set points_claimed_at = now() where id = p_order_id;
    return 'nothing_to_claim';
  end if;

  if not exists (
    select 1 from public.loyalty_points
    where user_id = v_order.user_id and balance >= v_order.points_redeemed
  ) then
    -- Balance dropped below the redeemed amount since checkout (e.g. spent
    -- elsewhere first) — never deduct below zero, just close out the order.
    update public.orders set points_claimed_at = now() where id = p_order_id;
    return 'insufficient_balance_skipped';
  end if;

  update public.loyalty_points
  set balance = balance - v_order.points_redeemed, updated_at = now()
  where user_id = v_order.user_id;

  insert into public.loyalty_ledger (user_id, delta, reason, order_id)
  values (v_order.user_id, -v_order.points_redeemed, 'redemption', p_order_id);

  update public.orders set points_claimed_at = now() where id = p_order_id;

  return 'ok';
end;
$$;

revoke all on function public.claim_redeemed_points_atomic(uuid) from public, anon, authenticated;
grant execute on function public.claim_redeemed_points_atomic(uuid) to service_role;

-- ─── reverse_loyalty_points_for_refund_atomic ───────────────────────────────
-- Claws back purchase points proportional to the refunded amount, using the
-- same fraction formula as the affiliate commission clawback in
-- 053_fix_refund_rpc_security_and_math.sql (base = subtotal - coupon_discount).
create or replace function public.reverse_loyalty_points_for_refund_atomic(
  p_order_id      uuid,
  p_refund_id     uuid,
  p_amount_cents  bigint
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order    record;
  v_earned   integer;
  v_base     numeric;
  v_fraction numeric;
  v_clawback integer;
begin
  select user_id, subtotal, coupon_discount into v_order
  from public.orders where id = p_order_id;

  if v_order.user_id is null then
    return;
  end if;

  select coalesce(sum(delta), 0) into v_earned
  from public.loyalty_ledger
  where order_id = p_order_id and reason = 'purchase';

  if v_earned <= 0 then
    return;
  end if;

  v_base := greatest(coalesce(v_order.subtotal, 0) - coalesce(v_order.coupon_discount, 0), 1);
  v_fraction := least(1, p_amount_cents::numeric / v_base);
  v_clawback := floor(v_earned * v_fraction)::integer;

  if v_clawback <= 0 then
    return;
  end if;

  update public.loyalty_points
  set balance = greatest(0, balance - v_clawback),
      lifetime_points = greatest(0, lifetime_points - v_clawback),
      updated_at = now()
  where user_id = v_order.user_id;

  update public.loyalty_points
  set tier = public.loyalty_tier_for_points(lifetime_points)
  where user_id = v_order.user_id;

  insert into public.loyalty_ledger (user_id, delta, reason, order_id)
  values (v_order.user_id, -v_clawback, 'refund_clawback', p_order_id);

  update public.order_refunds set points_clawback = v_clawback where id = p_refund_id;
end;
$$;

revoke all on function public.reverse_loyalty_points_for_refund_atomic(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.reverse_loyalty_points_for_refund_atomic(uuid, uuid, bigint) to service_role;

-- ─── restore_loyalty_points_for_reversed_refund_atomic ──────────────────────
-- Undoes a clawback when a Stripe refund later resolves to 'failed' (mirrors
-- reverse_failed_refund_atomic in 054_reverse_failed_refund.sql). Idempotent:
-- zeroes points_clawback after restoring, so a retry is a no-op.
create or replace function public.restore_loyalty_points_for_reversed_refund_atomic(
  p_refund_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund record;
  v_amount integer;
  v_user_id uuid;
begin
  select order_id, points_clawback into v_refund
  from public.order_refunds where id = p_refund_id for update;

  if v_refund.order_id is null or coalesce(v_refund.points_clawback, 0) <= 0 then
    return;
  end if;

  v_amount := v_refund.points_clawback;

  select user_id into v_user_id from public.orders where id = v_refund.order_id;
  if v_user_id is null then
    return;
  end if;

  update public.loyalty_points
  set balance = balance + v_amount,
      lifetime_points = lifetime_points + v_amount,
      updated_at = now()
  where user_id = v_user_id;

  update public.loyalty_points
  set tier = public.loyalty_tier_for_points(lifetime_points)
  where user_id = v_user_id;

  insert into public.loyalty_ledger (user_id, delta, reason, order_id)
  values (v_user_id, v_amount, 'refund_clawback_reversed', v_refund.order_id);

  update public.order_refunds set points_clawback = 0 where id = p_refund_id;
end;
$$;

revoke all on function public.restore_loyalty_points_for_reversed_refund_atomic(uuid) from public, anon, authenticated;
grant execute on function public.restore_loyalty_points_for_reversed_refund_atomic(uuid) to service_role;
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push`
Expected: no errors; `orders.points_redeemed`/`points_discount`/`points_claimed_at` and `order_refunds.points_clawback` exist.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260722122000_loyalty_orders_and_refunds.sql
git commit -m "feat: add points redemption claim and refund clawback RPCs"
```

---

### Task 4: Pure points calculation functions (unit tested)

**Files:**
- Create: `lib/server/loyalty/points.ts`
- Test: `__tests__/loyalty/points.test.ts`

**Interfaces:**
- Produces: `TIER_CONFIG: Array<{ tier: string; minPoints: number; multiplier: number }>` (frontend-safe mirror of `loyalty_tier_config`, used for client-side progress bars — the DB is still the source of truth for actual tier assignment).
- Produces: `tierForLifetimePoints(lifetimePoints: number): string`
- Produces: `pointsEarnedForPurchase(chargeableCents: number): number` — base points BEFORE multiplier (multiplier is applied by `award_points_atomic`, never client-side).
- Produces: `redemptionDiscountCents(points: number): number`
- Produces: `validateRedemptionAmount(params: { points: number; balance: number; subtotal: number; couponDiscount: number }): { valid: boolean; discountCents: number; error?: string }` — consumed by Task 8 and Task 10.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import {
  tierForLifetimePoints,
  pointsEarnedForPurchase,
  redemptionDiscountCents,
  validateRedemptionAmount,
} from '../../lib/server/loyalty/points'

describe('tierForLifetimePoints', () => {
  it('returns curioso at 0', () => {
    expect(tierForLifetimePoints(0)).toBe('curioso')
  })
  it('returns curioso just under the antojadizo boundary', () => {
    expect(tierForLifetimePoints(999)).toBe('curioso')
  })
  it('returns antojadizo exactly at the boundary', () => {
    expect(tierForLifetimePoints(1000)).toBe('antojadizo')
  })
  it('returns fanatico at 2500', () => {
    expect(tierForLifetimePoints(2500)).toBe('fanatico')
  })
  it('returns snack_lover at 6500', () => {
    expect(tierForLifetimePoints(6500)).toBe('snack_lover')
  })
  it('returns leyenda at 17500 and above', () => {
    expect(tierForLifetimePoints(17500)).toBe('leyenda')
    expect(tierForLifetimePoints(999999)).toBe('leyenda')
  })
})

describe('pointsEarnedForPurchase', () => {
  it('awards 10 points per $10 MXN (1000 centavos)', () => {
    expect(pointsEarnedForPurchase(1000)).toBe(10)
  })
  it('floors partial hundreds of centavos', () => {
    expect(pointsEarnedForPurchase(1099)).toBe(10)
  })
  it('returns 0 for 0 or negative amounts', () => {
    expect(pointsEarnedForPurchase(0)).toBe(0)
    expect(pointsEarnedForPurchase(-500)).toBe(0)
  })
})

describe('redemptionDiscountCents', () => {
  it('converts 100 points to 1000 centavos ($10 MXN)', () => {
    expect(redemptionDiscountCents(100)).toBe(1000)
  })
  it('scales linearly', () => {
    expect(redemptionDiscountCents(500)).toBe(5000)
  })
})

describe('validateRedemptionAmount', () => {
  it('rejects amounts below the 100-point minimum', () => {
    const result = validateRedemptionAmount({ points: 50, balance: 1000, subtotal: 50000, couponDiscount: 0 })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/mínimo/i)
  })
  it('rejects amounts not a multiple of 100', () => {
    const result = validateRedemptionAmount({ points: 150, balance: 1000, subtotal: 50000, couponDiscount: 0 })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/múltiplo/i)
  })
  it('rejects amounts exceeding the available balance', () => {
    const result = validateRedemptionAmount({ points: 200, balance: 100, subtotal: 50000, couponDiscount: 0 })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/saldo/i)
  })
  it('rejects a discount that would exceed subtotal minus coupon discount', () => {
    const result = validateRedemptionAmount({ points: 1000, balance: 5000, subtotal: 5000, couponDiscount: 4500 })
    // subtotal(5000) - couponDiscount(4500) = 500 centavos ceiling; 1000 pts = 10000 centavos discount
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/excede/i)
  })
  it('accepts a valid redemption and returns the discount', () => {
    const result = validateRedemptionAmount({ points: 300, balance: 1000, subtotal: 50000, couponDiscount: 0 })
    expect(result.valid).toBe(true)
    expect(result.discountCents).toBe(3000)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/loyalty/points.test.ts`
Expected: FAIL with "Cannot find module '../../lib/server/loyalty/points'"

- [ ] **Step 3: Write the implementation**

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

/** Base points before any tier/wheel multiplier — award_points_atomic applies those server-side. */
export function pointsEarnedForPurchase(chargeableCents: number): number {
  if (chargeableCents <= 0) return 0
  return Math.floor(chargeableCents / 100)
}

export function redemptionDiscountCents(points: number): number {
  return points * 10
}

export function validateRedemptionAmount(params: {
  points: number
  balance: number
  subtotal: number
  couponDiscount: number
}): { valid: boolean; discountCents: number; error?: string } {
  const { points, balance, subtotal, couponDiscount } = params

  if (points < 100) {
    return { valid: false, discountCents: 0, error: 'El canje mínimo es de 100 puntos' }
  }
  if (points % 100 !== 0) {
    return { valid: false, discountCents: 0, error: 'Los puntos deben canjearse en múltiplos de 100' }
  }
  if (points > balance) {
    return { valid: false, discountCents: 0, error: 'No tienes saldo de puntos suficiente' }
  }

  const discountCents = redemptionDiscountCents(points)
  const ceiling = Math.max(0, subtotal - couponDiscount)
  if (discountCents > ceiling) {
    return { valid: false, discountCents: 0, error: 'El descuento de puntos excede el subtotal disponible' }
  }

  return { valid: true, discountCents }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/loyalty/points.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/server/loyalty/points.ts __tests__/loyalty/points.test.ts
git commit -m "feat: add loyalty points/tier pure calculation functions"
```

---

### Task 5: Server orchestration — `lib/server/loyalty/engine.ts`

**Files:**
- Create: `lib/server/loyalty/engine.ts`

**Interfaces:**
- Consumes: `pointsEarnedForPurchase` (Task 4), RPCs `award_points_atomic` (Task 1) and `claim_redeemed_points_atomic` (Task 3).
- Produces: `awardPointsForPaidOrder(orderId: string): Promise<void>` — called from the Stripe webhook (Task 6).
- Produces: `claimRedeemedPointsForPaidOrder(orderId: string): Promise<void>` — called from the Stripe webhook (Task 6).

- [ ] **Step 1: Write the implementation**

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { pointsEarnedForPurchase } from './points'

/**
 * Awards purchase points once an order is confirmed paid. Mirrors
 * claimCouponForPaidOrder's read-then-act shape (lib/server/coupons/engine.ts).
 * Idempotent against webhook retries via the partial unique index on
 * loyalty_ledger(order_id) where reason='purchase'.
 */
export async function awardPointsForPaidOrder(orderId: string): Promise<void> {
  if (!orderId) return
  const supabase = createServiceClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, user_id, subtotal, coupon_discount, points_discount, payment_status')
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    console.error('[loyalty] awardPointsForPaidOrder load order', error.message)
    return
  }
  if (!order || !order.user_id) return
  if (order.payment_status !== 'paid') return

  const chargeableCents = Math.max(
    0,
    (order.subtotal ?? 0) - (order.coupon_discount ?? 0) - (order.points_discount ?? 0)
  )
  const basePoints = pointsEarnedForPurchase(chargeableCents)
  if (basePoints <= 0) return

  const { error: rpcError } = await supabase.rpc('award_points_atomic', {
    p_user_id: order.user_id,
    p_base_delta: basePoints,
    p_reason: 'purchase',
    p_order_id: orderId,
  })

  if (rpcError) {
    console.error('[loyalty] award_points_atomic error', rpcError.message)
  }
}

/**
 * Deducts previously-redeemed points once an order is confirmed paid. Mirrors
 * claimCouponForPaidOrder exactly: the discount is displayed at checkout but
 * only realized against the user's balance at payment confirmation.
 */
export async function claimRedeemedPointsForPaidOrder(orderId: string): Promise<void> {
  if (!orderId) return
  const supabase = createServiceClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, points_redeemed, payment_status')
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    console.error('[loyalty] claimRedeemedPointsForPaidOrder load order', error.message)
    return
  }
  if (!order || !order.points_redeemed) return
  if (order.payment_status !== 'paid') return

  const { data: result, error: rpcError } = await supabase.rpc('claim_redeemed_points_atomic', {
    p_order_id: orderId,
  })

  if (rpcError) {
    console.error('[loyalty] claim_redeemed_points_atomic error', rpcError.message)
    return
  }

  if (result !== 'ok' && result !== 'already_claimed' && result !== 'nothing_to_claim' && result !== 'insufficient_balance_skipped') {
    console.warn('[loyalty] claim_redeemed_points_atomic unexpected result', { orderId, result })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add lib/server/loyalty/engine.ts
git commit -m "feat: add loyalty points award/claim orchestration for paid orders"
```

---

### Task 6: Wire points into the Stripe webhook

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts:1-10` (imports), `:60-67` (checkout.session.completed), `:145-155` (charge.refunded / refund.updated → failed branch)

**Interfaces:**
- Consumes: `awardPointsForPaidOrder`, `claimRedeemedPointsForPaidOrder` (Task 5); RPC `restore_loyalty_points_for_reversed_refund_atomic` (Task 3).

- [ ] **Step 1: Add the import**

In `app/api/webhooks/stripe/route.ts`, alongside the existing coupon import:

```typescript
import { claimCouponForPaidOrder } from '@/lib/server/coupons/engine'
import { awardPointsForPaidOrder, claimRedeemedPointsForPaidOrder } from '@/lib/server/loyalty/engine'
```

- [ ] **Step 2: Award and claim points right after the coupon claim**

Immediately after this existing block:

```typescript
        await claimCouponForPaidOrder(orderId).catch((err) => {
          console.error('[stripe webhook] claimCouponForPaidOrder failed', { orderId, err })
        })
```

add:

```typescript
        await claimRedeemedPointsForPaidOrder(orderId).catch((err) => {
          console.error('[stripe webhook] claimRedeemedPointsForPaidOrder failed', { orderId, err })
        })

        await awardPointsForPaidOrder(orderId).catch((err) => {
          console.error('[stripe webhook] awardPointsForPaidOrder failed', { orderId, err })
        })
```

- [ ] **Step 3: Restore clawed-back points when a refund reverses**

In the `charge.refunded` / `refund.updated` case, immediately after the existing:

```typescript
        if (dbStatus === 'failed') {
          const { error: reverseErr } = await supabase.rpc('reverse_failed_refund_atomic', {
            p_stripe_refund_id: refund.id,
          })
          if (reverseErr) {
            console.error('[stripe-webhook] Error reversing failed refund:', reverseErr)
          }
```

add, still inside the `if (dbStatus === 'failed')` block:

```typescript
          const { data: refundRow } = await supabase
            .from('order_refunds')
            .select('id')
            .eq('stripe_refund_id', refund.id)
            .maybeSingle()

          if (refundRow?.id) {
            const { error: restoreErr } = await supabase.rpc('restore_loyalty_points_for_reversed_refund_atomic', {
              p_refund_id: refundRow.id,
            })
            if (restoreErr) {
              console.error('[stripe-webhook] Error restoring loyalty points:', restoreErr)
            }
          }
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint app/api/webhooks/stripe/route.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/stripe/route.ts
git commit -m "feat: award and claim loyalty points from the Stripe webhook"
```

---

### Task 7: Claw back points on refund

**Files:**
- Modify: `lib/server/process-refund.ts`

**Interfaces:**
- Consumes: RPC `reverse_loyalty_points_for_refund_atomic` (Task 3).

- [ ] **Step 1: Read the full current file to find the exact insertion point**

`processRefund()` calls `process_order_refund_atomic` via Supabase RPC and gets back a refund id — find that call (it returns `refundId` in `ProcessRefundResult`). Locate the line where the RPC result is captured (grep for `process_order_refund_atomic` in this file).

- [ ] **Step 2: Add the loyalty clawback call right after the refund RPC succeeds**

Immediately after the `process_order_refund_atomic` RPC call resolves successfully and before `return { ok: true, refundId }` (or equivalent success return), add:

```typescript
  await supabase
    .rpc('reverse_loyalty_points_for_refund_atomic', {
      p_order_id: orderId,
      p_refund_id: refundId,
      p_amount_cents: amountCents,
    })
    .then(({ error }) => {
      if (error) {
        console.error('[process-refund] reverse_loyalty_points_for_refund_atomic failed', {
          orderId,
          refundId,
          error: error.message,
        })
      }
    })
```

Use the exact local variable names already in scope at that point in the file (`orderId`, `refundId`, `amountCents` come from `ProcessRefundParams`/the RPC return — match whatever names the existing code uses).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/server/process-refund.ts
git commit -m "feat: claw back loyalty points proportional to refunded amount"
```

---

### Task 8: Extend order creation with points redemption

**Files:**
- Modify: `lib/validations/order-create-payload.ts` (schema)
- Modify: `app/api/orders/create/route.ts` (validation + persistence)

**Interfaces:**
- Consumes: `validateRedemptionAmount` (Task 4).
- Produces: `orders.points_redeemed`, `orders.points_discount` populated on insert; `total` formula extended.

- [ ] **Step 1: Add `points_redeemed` to the Zod schema**

In `lib/validations/order-create-payload.ts`, add to `createOrderPayloadSchema`:

```typescript
  points_redeemed: z
    .number({ error: () => 'Puntos a canjear no válidos' })
    .int('Los puntos deben ser un número entero')
    .min(0, 'Los puntos no pueden ser negativos')
    .multipleOf(100, 'Los puntos se canjean en múltiplos de 100')
    .optional()
    .default(0),
```

Add `points_redeemed: 'Puntos'` to the `FIELD_LABEL` map at the top of the file.

- [ ] **Step 2: Validate and persist in the order-create route**

In `app/api/orders/create/route.ts`, add the import:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server'
```

(it is likely already imported — check the existing import block first and only add if missing; `createServiceClient` is already imported).

Immediately after the existing coupon validation block (`if (payload.coupon_code) { ... }`) and before `const total = Math.max(0, subtotal + serverShippingFee - couponDiscount)`, add:

```typescript
    let pointsRedeemed = 0
    let pointsDiscount = 0
    if (payload.points_redeemed > 0) {
      const supabaseSession = await createServerSupabaseClient()
      const {
        data: { user: sessionUser },
      } = await supabaseSession.auth.getUser()

      if (!sessionUser) {
        return NextResponse.json({ error: 'Debes iniciar sesión para canjear puntos' }, { status: 401 })
      }

      const service1 = createServiceClient()
      const { data: loyalty } = await service1
        .from('loyalty_points')
        .select('balance')
        .eq('user_id', sessionUser.id)
        .maybeSingle()

      const validation = validateRedemptionAmount({
        points: payload.points_redeemed,
        balance: loyalty?.balance ?? 0,
        subtotal,
        couponDiscount,
      })

      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }

      pointsRedeemed = payload.points_redeemed
      pointsDiscount = validation.discountCents
    }
```

Add the import at the top:

```typescript
import { validateRedemptionAmount } from '@/lib/server/loyalty/points'
```

Change the total line to:

```typescript
    const total = Math.max(0, subtotal + serverShippingFee - couponDiscount - pointsDiscount)
```

In `insertPayloadBase`, add the two fields alongside the existing coupon fields:

```typescript
      coupon_code: couponCode,
      coupon_discount: couponDiscount,
      coupon_snapshot: couponSnapshot,
      points_redeemed: pointsRedeemed,
      points_discount: pointsDiscount,
      discount: 0,
```

In the final success response's `data` object, add `points_redeemed: pointsRedeemed, points_discount: pointsDiscount` next to the existing `coupon_discount`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Start the dev server (`npm run dev`), log in as a test user with a nonzero `loyalty_points.balance` (seed one via SQL if needed), place an order through checkout with a `points_redeemed` value, and confirm via `select points_redeemed, points_discount, total from orders order by created_at desc limit 1;` that the numbers match the expected formula.

- [ ] **Step 5: Commit**

```bash
git add lib/validations/order-create-payload.ts app/api/orders/create/route.ts
git commit -m "feat: accept points redemption in order creation"
```

---

### Task 9: Loyalty queries + API routes

**Files:**
- Create: `lib/supabase/queries/loyalty.ts`
- Create: `app/api/loyalty/status/route.ts`
- Create: `app/api/loyalty/redeem/validate/route.ts`
- Create: `app/api/loyalty/wheel/spin/route.ts`

**Interfaces:**
- Consumes: `validateRedemptionAmount` (Task 4), RPC `resolve_wheel_spin_atomic` (Task 2), `rateLimit`/`getClientIp` (`lib/server/rate-limit`, existing).
- Produces: `GET /api/loyalty/status`, `POST /api/loyalty/redeem/validate`, `POST /api/loyalty/wheel/spin` — consumed by `loyaltyStore.ts` (Task 10) and the frontend components (Tasks 12–14).

- [ ] **Step 1: Write the queries file**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export interface LoyaltyStatus {
  balance: number
  lifetime_points: number
  tier: string
  active_multiplier_expires_at: string | null
}

export async function getLoyaltyStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<LoyaltyStatus> {
  const { data, error } = await supabase
    .from('loyalty_points')
    .select('balance, lifetime_points, tier, active_multiplier_expires_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (
    data ?? { balance: 0, lifetime_points: 0, tier: 'curioso', active_multiplier_expires_at: null }
  )
}

export interface LoyaltyLedgerEntry {
  id: string
  delta: number
  reason: string
  order_id: string | null
  created_at: string
}

export async function getLedgerHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<LoyaltyLedgerEntry[]> {
  const { data, error } = await supabase
    .from('loyalty_ledger')
    .select('id, delta, reason, order_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 2: Write the status route**

```typescript
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getLoyaltyStatus, getLedgerHistory } from '@/lib/supabase/queries/loyalty'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const [status, history] = await Promise.all([
      getLoyaltyStatus(supabase, user.id),
      getLedgerHistory(supabase, user.id),
    ])

    return NextResponse.json({ data: { ...status, history } })
  } catch {
    return NextResponse.json({ error: 'Error al obtener el estado de lealtad' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Write the redemption validation route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { validateRedemptionAmount } from '@/lib/server/loyalty/points'
import { rateLimit, getClientIp } from '@/lib/server/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const rl = rateLimit(`loyalty-redeem-validate:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ valid: false, error: 'Demasiados intentos. Intenta en un momento.' }, { status: 429 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ valid: false, error: 'Debes iniciar sesión para canjear puntos' }, { status: 401 })
    }

    const body = await request.json()
    const points = Number(body?.points ?? 0)
    const subtotal = Number(body?.subtotal ?? 0)
    const couponDiscount = Number(body?.couponDiscount ?? 0)

    if (!Number.isInteger(points) || points < 0 || Number.isNaN(subtotal)) {
      return NextResponse.json({ valid: false, error: 'Datos inválidos' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data: loyalty } = await service
      .from('loyalty_points')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    const result = validateRedemptionAmount({
      points,
      balance: loyalty?.balance ?? 0,
      subtotal,
      couponDiscount,
    })

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ valid: true, discount_cents: result.discountCents })
  } catch {
    return NextResponse.json({ valid: false, error: 'No pudimos validar el canje de puntos' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Write the wheel spin route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/server/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const rl = rateLimit(`loyalty-wheel-spin:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 })
    }

    const body = await request.json()
    const cartSessionId = String(body?.cart_session_id ?? '').trim()
    const subtotal = Number(body?.subtotal ?? 0)

    if (!cartSessionId || !Number.isFinite(subtotal)) {
      return NextResponse.json({ ok: false, reason: 'invalid_input' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data, error } = await service.rpc('resolve_wheel_spin_atomic', {
      p_user_id: user.id,
      p_cart_session_id: cartSessionId,
      p_cart_subtotal_cents: Math.round(subtotal),
    })

    if (error) {
      console.error('[loyalty] resolve_wheel_spin_atomic error', error.message)
      return NextResponse.json({ ok: false, reason: 'server_error' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ ok: false, reason: 'server_error' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

With the dev server running and logged in as a test user:
```bash
curl -b <session-cookie> http://localhost:3500/api/loyalty/status
curl -b <session-cookie> -X POST http://localhost:3500/api/loyalty/wheel/spin \
  -H 'Content-Type: application/json' -d '{"cart_session_id":"manual-test","subtotal":40000}'
```
Expected: status returns `{ data: { balance, lifetime_points, tier, history: [...] } }`; spin returns `{ ok: true, prize_type, coupon_code }` on the first call and `{ ok: false, reason: 'already_spun' }` on a repeat with the same `cart_session_id`.

- [ ] **Step 7: Commit**

```bash
git add lib/supabase/queries/loyalty.ts app/api/loyalty
git commit -m "feat: add loyalty status, redemption validation, and wheel spin API routes"
```

---

### Task 10: `loyaltyStore` (zustand)

**Files:**
- Create: `lib/stores/loyaltyStore.ts`

**Interfaces:**
- Consumes: `GET /api/loyalty/status`, `POST /api/loyalty/wheel/spin` (Task 9), `fetchWithCredentials` (`lib/http/fetch-with-credentials`, existing).
- Produces: `useLoyaltyStore` — consumed by `LoyaltyWidget`, `LoyaltyTierBadge`, `GamificationWheel`, `CheckoutLoyaltyRedemption` (Tasks 11–14).

- [ ] **Step 1: Write the store**

```typescript
'use client'

import { create } from 'zustand'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'

export interface LoyaltyLedgerEntry {
  id: string
  delta: number
  reason: string
  order_id: string | null
  created_at: string
}

interface LoyaltyStore {
  balance: number
  lifetimePoints: number
  tier: string
  history: LoyaltyLedgerEntry[]
  loaded: boolean
  isLoading: boolean
  lastTierSeen: string | null
  fetchStatus: () => Promise<void>
  spinWheel: (cartSessionId: string, subtotalCents: number) => Promise<
    | { ok: true; prizeType: string; couponCode: string | null }
    | { ok: false; reason: string }
  >
}

export const useLoyaltyStore = create<LoyaltyStore>()((set, get) => ({
  balance: 0,
  lifetimePoints: 0,
  tier: 'curioso',
  history: [],
  loaded: false,
  isLoading: false,
  lastTierSeen: null,

  fetchStatus: async () => {
    if (get().isLoading) return
    set({ isLoading: true })
    try {
      const res = await fetchWithCredentials('/api/loyalty/status')
      if (!res.ok) {
        set({ isLoading: false, loaded: true })
        return
      }
      const json = await res.json()
      set({
        balance: json.data.balance,
        lifetimePoints: json.data.lifetime_points,
        tier: json.data.tier,
        history: json.data.history ?? [],
        loaded: true,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false, loaded: true })
    }
  },

  spinWheel: async (cartSessionId, subtotalCents) => {
    try {
      const res = await fetchWithCredentials('/api/loyalty/wheel/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart_session_id: cartSessionId, subtotal: subtotalCents }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        return { ok: false as const, reason: json.reason ?? 'server_error' }
      }
      return { ok: true as const, prizeType: json.prize_type, couponCode: json.coupon_code ?? null }
    } catch {
      return { ok: false as const, reason: 'network_error' }
    }
  },
}))
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/stores/loyaltyStore.ts
git commit -m "feat: add loyaltyStore for status and wheel-spin state"
```

---

### Task 11: `cartSessionId` in the cart store

**Files:**
- Modify: `lib/stores/cart.ts`

**Interfaces:**
- Produces: `cartSessionId: string` field on `useCartStore`, regenerated whenever the cart is cleared or was never set — consumed by `GamificationWheel` (Task 13).

- [ ] **Step 1: Add the field and regeneration logic**

In `lib/stores/cart.ts`, add to the `CartStore` interface:

```typescript
interface CartStore {
  items: CartItem[]
  cartSessionId: string
  // ...existing methods...
}
```

In the store body, add the field to initial state and regenerate it in `clearCart`:

```typescript
      items: [],
      cartSessionId: crypto.randomUUID(),
```

Find the existing `clearCart` implementation and add a new session id to its `set(...)` call:

```typescript
      clearCart: () => {
        clearShippingDraft()
        set({ items: [], cartSessionId: crypto.randomUUID() })
      },
```

(Match whatever the current `clearCart` body already does — it's shown calling `clearShippingDraft()` per the file's existing imports; keep that call and only add `cartSessionId` to the `set`.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/stores/cart.ts
git commit -m "feat: add cartSessionId for one-spin-per-cart wheel gating"
```

---

### Task 12: `LoyaltyTierBadge` component

**Files:**
- Create: `components/loyalty/LoyaltyTierBadge.tsx`

**Interfaces:**
- Consumes: `Badge` (`components/ui/badge`, existing).
- Produces: `<LoyaltyTierBadge tier={string} />` — consumed by `LoyaltyWidget` (Task 13).

- [ ] **Step 1: Write the component**

```typescript
import { Badge } from '@/components/ui/badge'

const TIER_LABELS: Record<string, string> = {
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/loyalty/LoyaltyTierBadge.tsx
git commit -m "feat: add LoyaltyTierBadge component"
```

---

### Task 13: `LoyaltyWidget` — passive floating button + drawer

**Files:**
- Create: `components/loyalty/LoyaltyWidget.tsx`

**Interfaces:**
- Consumes: `useLoyaltyStore` (Task 10), `useAuthStore` (existing), `LoyaltyTierBadge` (Task 12), `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` (`components/ui/sheet`, existing), `GET /api/profile/coupons` (existing route — reused as-is for the "cupones sin usar" list, no new endpoint needed).

- [ ] **Step 1: Write the component**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Gift, Sparkles } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAuthStore } from '@/lib/stores/auth'
import { useLoyaltyStore } from '@/lib/stores/loyaltyStore'
import { LoyaltyTierBadge } from './LoyaltyTierBadge'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'

const REASON_LABELS: Record<string, string> = {
  signup: 'Bono de bienvenida',
  purchase: 'Compra',
  redemption: 'Canje en pedido',
  refund_clawback: 'Ajuste por reembolso',
  refund_clawback_reversed: 'Ajuste revertido',
}

interface UserCoupon {
  id: string
  used_at: string | null
  coupon: { code: string; description: string | null }
}

export function LoyaltyWidget() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { balance, tier, history, loaded, fetchStatus } = useLoyaltyStore()
  const [open, setOpen] = useState(false)
  const [coupons, setCoupons] = useState<UserCoupon[]>([])

  useEffect(() => {
    if (isAuthenticated && !loaded) {
      fetchStatus()
    }
  }, [isAuthenticated, loaded, fetchStatus])

  useEffect(() => {
    if (!open) return
    fetchWithCredentials('/api/profile/coupons')
      .then((r) => r.json())
      .then((json) => setCoupons(json.data ?? []))
      .catch(() => setCoupons([]))
  }, [open])

  if (!isAuthenticated) return null

  const unusedCoupons = coupons.filter((c) => !c.used_at)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir mi programa de lealtad"
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/15 transition-transform hover:scale-105 motion-reduce:transition-none print:hidden"
      >
        <Gift className="h-6 w-6" />
        {unusedCoupons.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-rose-500" aria-hidden />
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col overflow-y-auto p-6">
          <SheetHeader className="p-0">
            <SheetTitle>Mi Nurei Coins</SheetTitle>
          </SheetHeader>

          <div className="mt-4 flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-2xl font-bold">{balance} pts</p>
              <p className="text-sm text-muted-foreground">Saldo canjeable</p>
            </div>
            <LoyaltyTierBadge tier={tier} />
          </div>

          {unusedCoupons.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
                <Sparkles className="h-4 w-4" /> Cupones sin usar
              </h3>
              <ul className="space-y-2">
                {unusedCoupons.map((c) => (
                  <li key={c.id} className="rounded-md border p-2 text-sm">
                    <span className="font-mono font-semibold">{c.coupon.code}</span>
                    {c.coupon.description && (
                      <p className="text-xs text-muted-foreground">{c.coupon.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex-1">
            <h3 className="mb-2 text-sm font-semibold">Historial</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no tienes movimientos.</p>
            ) : (
              <ul className="space-y-1">
                {history.map((entry) => (
                  <li key={entry.id} className="flex justify-between text-sm">
                    <span>{REASON_LABELS[entry.reason] ?? entry.reason}</span>
                    <span className={entry.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {entry.delta >= 0 ? '+' : ''}
                      {entry.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/loyalty/LoyaltyWidget.tsx
git commit -m "feat: add passive LoyaltyWidget floating button and drawer"
```

---

### Task 14: `GamificationWheel` component

**Files:**
- Create: `components/loyalty/GamificationWheel.tsx`

**Interfaces:**
- Consumes: `useCartStore` (existing, extended in Task 11), `useAuthStore` (existing), `useLoyaltyStore.spinWheel` (Task 10), `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` (`components/ui/dialog`, existing), `motion`/`AnimatePresence` (`framer-motion`, existing dependency).

- [ ] **Step 1: Write the component**

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/lib/stores/cart'
import { useAuthStore } from '@/lib/stores/auth'
import { useLoyaltyStore } from '@/lib/stores/loyaltyStore'

const WHEEL_THRESHOLD_CENTS = 39900

const PRIZE_LABELS: Record<string, string> = {
  no_prize: '¡Suerte para la próxima!',
  discount_pct_5: '5% de descuento',
  discount_pct_10: '10% de descuento',
  free_shipping: 'Envío gratis',
  points_multiplier_2x: 'Puntos x2 por 24 horas',
}

export function GamificationWheel() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const items = useCartStore((s) => s.items)
  const cartSessionId = useCartStore((s) => s.cartSessionId)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const spinWheel = useLoyaltyStore((s) => s.spinWheel)

  const [open, setOpen] = useState(false)
  const [dismissedSessionId, setDismissedSessionId] = useState<string | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ prizeType: string; couponCode: string | null } | null>(null)
  const hasAutoOpenedRef = useRef<string | null>(null)

  const subtotal = items.length > 0 ? getSubtotal() : 0

  useEffect(() => {
    if (!isAuthenticated) return
    if (subtotal < WHEEL_THRESHOLD_CENTS) return
    if (dismissedSessionId === cartSessionId) return
    if (hasAutoOpenedRef.current === cartSessionId) return

    hasAutoOpenedRef.current = cartSessionId
    setOpen(true)
    setResult(null)
  }, [isAuthenticated, subtotal, cartSessionId, dismissedSessionId])

  const handleClose = () => {
    setOpen(false)
    setDismissedSessionId(cartSessionId)
  }

  const handleSpin = async () => {
    setSpinning(true)
    const outcome = await spinWheel(cartSessionId, subtotal)
    // Keep the spin animation visible for a beat even if the network call is instant.
    await new Promise((resolve) => setTimeout(resolve, 1400))
    setSpinning(false)

    if (outcome.ok) {
      setResult({ prizeType: outcome.prizeType, couponCode: outcome.couponCode })
    } else {
      setResult({ prizeType: 'no_prize', couponCode: null })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle>¡Ruleta de Snacks!</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <motion.div
              animate={spinning ? { rotate: 360 * 4 } : { rotate: 0 }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className="flex h-32 w-32 items-center justify-center rounded-full border-8 border-primary/30 bg-gradient-to-br from-amber-200 to-rose-200 text-4xl"
            >
              🎡
            </motion.div>
            <p className="text-sm text-muted-foreground">
              Tu carrito califica para un giro gratis.
            </p>
            <Button onClick={handleSpin} disabled={spinning}>
              {spinning ? 'Girando...' : 'Girar la ruleta'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="text-5xl" aria-hidden>
              {result.prizeType === 'no_prize' ? '😅' : '🎉'}
            </span>
            <p className="text-lg font-semibold">{PRIZE_LABELS[result.prizeType]}</p>
            {result.couponCode && (
              <p className="text-sm text-muted-foreground">
                Código <span className="font-mono font-semibold">{result.couponCode}</span> guardado en tus cupones.
              </p>
            )}
            <Button variant="outline" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run the dev server, log in, add products until the cart subtotal crosses $399 MXN, and confirm: the dialog auto-opens exactly once; closing it without spinning and adding more items does not reopen it for the same cart; clicking "Girar" shows the spin animation for ~1.4s then a result; a second spin attempt in the same cart session is not offered again (the widget won't auto-reopen, and there's no other spin trigger in this cart session).

- [ ] **Step 4: Commit**

```bash
git add components/loyalty/GamificationWheel.tsx
git commit -m "feat: add GamificationWheel modal with cart-threshold trigger"
```

---

### Task 15: `CheckoutLoyaltyRedemption` + checkout integration

**Files:**
- Create: `components/loyalty/CheckoutLoyaltyRedemption.tsx`
- Modify: `app/(public)/checkout/page.tsx`

**Interfaces:**
- Consumes: `useLoyaltyStore` (Task 10), `useAuthStore` (existing), `formatPrice` (`lib/utils/format`, existing).
- Produces: `<CheckoutLoyaltyRedemption balance maxDiscountCents value onChange />` — a controlled range input.

- [ ] **Step 1: Write the component**

```typescript
'use client'

import { formatPrice } from '@/lib/utils/format'

interface Props {
  balance: number
  maxDiscountCents: number
  value: number
  onChange: (points: number) => void
}

export function CheckoutLoyaltyRedemption({ balance, maxDiscountCents, value, onChange }: Props) {
  if (balance < 100) return null

  const maxRedeemablePoints = Math.min(balance, Math.floor(maxDiscountCents / 10 / 100) * 100)
  if (maxRedeemablePoints < 100) return null

  const discountCents = value * 10

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">Canjear Nurei Coins</span>
        <span className="text-muted-foreground">{balance} pts disponibles</span>
      </div>
      <input
        type="range"
        min={0}
        max={maxRedeemablePoints}
        step={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
        aria-label="Puntos a canjear"
      />
      <div className="mt-1 flex justify-between text-sm">
        <span>{value} pts</span>
        <span className="font-semibold text-emerald-600">-{formatPrice(discountCents)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the checkout page**

In `app/(public)/checkout/page.tsx`:

Add imports:
```typescript
import { CheckoutLoyaltyRedemption } from '@/components/loyalty/CheckoutLoyaltyRedemption'
import { useLoyaltyStore } from '@/lib/stores/loyaltyStore'
import { useAuthStore } from '@/lib/stores/auth'
```

(check whether `useAuthStore` is already imported in this file before adding it again.)

Near the top of the component, alongside the existing `couponState` hook, add:

```typescript
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { balance: loyaltyBalance, fetchStatus: fetchLoyaltyStatus } = useLoyaltyStore()
  const [pointsRedeemed, setPointsRedeemed] = useState(0)

  useEffect(() => {
    if (isAuthenticated) fetchLoyaltyStatus()
  }, [isAuthenticated, fetchLoyaltyStatus])
```

Change the total calculation (currently `const total = Math.max(0, subtotal + shippingFee - effectiveCouponDiscount)`) to:

```typescript
  const pointsDiscount = pointsRedeemed * 10
  const total = Math.max(0, subtotal + shippingFee - effectiveCouponDiscount - pointsDiscount)
```

Reset `pointsRedeemed` if it would now exceed the new ceiling whenever `subtotal` or `effectiveCouponDiscount` changes (coupon applied/removed after the slider was already set):

```typescript
  useEffect(() => {
    const ceiling = Math.max(0, subtotal - effectiveCouponDiscount)
    if (pointsRedeemed * 10 > ceiling) {
      setPointsRedeemed(0)
    }
  }, [subtotal, effectiveCouponDiscount, pointsRedeemed])
```

Render the component near the existing coupon input block (find the JSX around the "Aplicar" coupon button, `couponState.appliedCode && (...)`), adding directly below it:

```typescript
                  {isAuthenticated && (
                    <CheckoutLoyaltyRedemption
                      balance={loyaltyBalance}
                      maxDiscountCents={Math.max(0, subtotal - effectiveCouponDiscount)}
                      value={pointsRedeemed}
                      onChange={setPointsRedeemed}
                    />
                  )}
```

Add `points_redeemed: pointsRedeemed` to the order-create payload (find the object literal that currently includes `coupon_code: couponState.appliedCode ?? undefined,` and add the field alongside it).

In the order confirmation summary block (near `<p>Descuento: -{formatPrice(orderConfirmation.coupon_discount)}</p>`), add a line shown only when points were redeemed:

```typescript
                        {orderConfirmation.points_discount > 0 && (
                          <p>Puntos canjeados: -{formatPrice(orderConfirmation.points_discount)}</p>
                        )}
```

Add `points_discount: number` to the local TypeScript type/interface that already declares `coupon_discount: number` for `orderConfirmation` (search this file for that interface — likely near the top with `subtotal`, `coupon_discount`, `total`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run the dev server, log in as a user with a nonzero points balance, go to checkout, confirm the slider appears, moving it updates the total in real time, and placing the order persists `points_redeemed`/`points_discount` correctly (cross-check with Task 8's manual verification).

- [ ] **Step 5: Commit**

```bash
git add components/loyalty/CheckoutLoyaltyRedemption.tsx "app/(public)/checkout/page.tsx"
git commit -m "feat: add points redemption slider to checkout"
```

---

### Task 16: Mount the widget and wheel in the public layout

**Files:**
- Modify: `app/(public)/layout.tsx`

**Interfaces:**
- Consumes: `LoyaltyWidget` (Task 13), `GamificationWheel` (Task 14).

- [ ] **Step 1: Add the imports and mount points**

```typescript
import { LoyaltyWidget } from '@/components/loyalty/LoyaltyWidget'
import { GamificationWheel } from '@/components/loyalty/GamificationWheel'
```

Add both components inside `<StoreCheckoutProvider>`, alongside the existing `<WhatsAppFloatingButton />`:

```typescript
        <WhatsAppFloatingButton />
        <LoyaltyWidget />
        <GamificationWheel />
```

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors, build succeeds.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, load any public page, confirm the WhatsApp button and the new loyalty floating button both render without overlapping (adjust `LoyaltyWidget`'s `bottom-24` offset in Task 13 if they collide on small screens), and that no wheel dialog appears until the cart threshold is met.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/layout.tsx"
git commit -m "feat: mount LoyaltyWidget and GamificationWheel in the public layout"
```

---

## Self-Review Notes

- **Spec coverage:** points by purchase (Task 8+6), points by signup (Task 1), 5 tiers with lifetime-based calculation and multipliers (Task 1/4), tier-up coupon rewards (Task 1), wheel with cart-threshold trigger and no-inventory prizes (Task 2/14), checkout point redemption acumulable with coupons (Task 8/15), refund clawback/restore (Task 3/6/7), anti-invasividad rules (Task 14: once-per-session auto-open; Task 13: passive button, no self-opening) — all covered.
- **Explicitly out of scope** (per the approved spec, unchanged): birthday points, social-share points, photo-review points, free shipping as a permanent tier perk, physical-inventory wheel prizes, the Leyenda-tier exclusive perk beyond the multiplier/gift already defined.
- **Deliberate implementation simplification** (spec allowed the mechanism to be decided at planning time): all wheel prizes except the 2x-points window are issued as ordinary coupons through the existing `coupons`/`user_coupons` tables and the existing checkout coupon-apply flow, rather than inventing a second discount-application pipeline. `free_shipping` is modeled as a fixed-amount coupon (`RULETA-ENVIO`) seeded with a placeholder value editable from `/admin/cupones` — flag this to the user before wider rollout in case the real standard shipping fee differs from the seeded 9900 centavos placeholder.
