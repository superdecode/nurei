-- ============================================
-- LOYALTY: idempotency guard for clawback
-- ============================================
-- Adds idempotency guard to reverse_loyalty_points_for_refund_atomic to prevent
-- double-deduction if called twice for the same refund. Mirrors the pattern used
-- in restore_loyalty_points_for_reversed_refund_atomic (migration 20260722122000).

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
  v_refund   record;
  v_order    record;
  v_earned   integer;
  v_base     numeric;
  v_fraction numeric;
  v_clawback integer;
begin
  -- ─── Idempotency guard: check if already processed for this refund ───
  select id, points_clawback into v_refund
  from public.order_refunds where id = p_refund_id for update;

  if coalesce(v_refund.points_clawback, 0) > 0 then
    -- Already processed for this refund — no-op
    return;
  end if;

  -- ─── Proceed with clawback calculation and application ───
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
