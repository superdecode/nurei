-- ============================================
-- 053: FIX REFUND RPC SECURITY + MATH (post-hoc database-reviewer findings)
-- ============================================
-- 051_refund_system.sql / 052_fix_reembolsos_permission_seed.sql were already
-- applied to production. A database-reviewer pass on the applied migrations
-- found real Critical/Important issues before any app code was wired up to
-- call these functions (verified live: zero refunds have ever been processed
-- through process_order_refund_atomic). Fixed here as a corrective migration
-- rather than editing 051/052, which are historical record of what actually ran.

-- ─── CRITICAL #1: money-moving RPCs are EXECUTE-able by anon/authenticated ───
-- This project's schema-level default privileges grant EXECUTE on new functions
-- to anon/authenticated/service_role. These functions are security definer with
-- no internal auth check and were never explicitly locked down. Revoke public
-- access; only the server-side service-role client should ever call them.
revoke execute on function public.process_order_refund_atomic(uuid, bigint, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.process_order_refund_atomic(uuid, bigint, text, text, text, text, uuid) to service_role;

revoke execute on function public.process_affiliate_payout_atomic(uuid, uuid[], date, date, uuid, text) from public, anon, authenticated;
grant execute on function public.process_affiliate_payout_atomic(uuid, uuid[], date, date, uuid, text) to service_role;

revoke execute on function public.record_attribution_atomic(uuid, uuid, text, uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.record_attribution_atomic(uuid, uuid, text, uuid, text, int, int) to service_role;

revoke execute on function public.approve_attribution_for_order(uuid) from public, anon, authenticated;
grant execute on function public.approve_attribution_for_order(uuid) to service_role;

-- ─── CRITICAL #2: no idempotency protection — a retried call double-refunds ───
alter table public.order_refunds
  add constraint order_refunds_stripe_refund_id_unique unique (stripe_refund_id);

-- (unique constraints allow multiple NULLs in Postgres, so manual/non-Stripe
-- refunds — which pass stripe_refund_id = null — are unaffected.)

-- ─── CRITICAL #3 + IMPORTANT #4: fix commission-fraction base and add the ───
-- ─── missing clawback_pending branch for a second refund on the same order ───
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
set search_path = public, pg_temp
as $$
declare
  v_order          record;
  v_attr           record;
  v_new_refunded   bigint;
  v_new_payment_status text;
  v_refund_id      uuid;
  v_commission_base numeric;
  v_fraction       numeric;
  v_adjustment     bigint;
  v_existing_id    uuid;
begin
  -- Idempotency: a retried call with the same Stripe refund id returns the
  -- original refund id instead of double-applying the refund.
  if p_stripe_refund_id is not null then
    select id into v_existing_id from public.order_refunds where stripe_refund_id = p_stripe_refund_id;
    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  select id, total, subtotal, coupon_discount, refunded_amount_cents
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

  -- Proportional affiliate commission adjustment (no-op if the order has no attribution).
  -- Fraction is computed against the same base the commission was originally computed on
  -- (subtotal - coupon_discount, matching lib/server/affiliate-attribution.ts — commission
  -- is never paid on shipping), not orders.total, and capped at 1 so a refund amount that
  -- exceeds the commissionable base (e.g. because shipping was also refunded) never claws
  -- back more than 100% of the commission.
  select * into v_attr from public.affiliate_attributions where order_id = p_order_id for update;

  if v_attr.id is not null then
    v_commission_base := greatest(coalesce(v_order.subtotal, 0) - coalesce(v_order.coupon_discount, 0), 1);
    v_fraction := least(1, p_amount_cents::numeric / v_commission_base);
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

    elsif v_attr.payout_status in ('paid', 'clawback_pending') then
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

-- ─── MINOR #9: security definer functions should pin search_path ───────────
alter function public.process_affiliate_payout_atomic(uuid, uuid[], date, date, uuid, text) set search_path = public, pg_temp;
