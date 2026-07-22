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
