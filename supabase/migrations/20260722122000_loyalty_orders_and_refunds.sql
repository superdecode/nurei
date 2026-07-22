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
