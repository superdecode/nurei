-- ============================================
-- 054: REVERSE A FAILED ASYNC STRIPE REFUND
-- ============================================
-- Final-review finding: process_order_refund_atomic applies ledger effects
-- (refunded_amount_cents, payment_status, order.status, affiliate commission
-- clawback) immediately when a refund is created, but a Stripe refund can be
-- created in a non-final state (pending) and later resolve to 'failed'
-- (rare for card refunds, which usually settle synchronously, but real for
-- some funding sources). The existing webhook only patched order_refunds.status
-- in that case — the order/commission ledger stayed wrong. This migration adds
-- an automatic reversal path.
--
-- orders.status is lossy on the forward path: process_order_refund_atomic
-- overwrites it to 'refunded' with no memory of what it was before (delivered,
-- shipped, etc). Add pre_refund_status so a reversal can restore the exact
-- prior value instead of guessing.

alter table public.orders add column if not exists pre_refund_status text;
alter table public.order_refunds add column if not exists reversed_at timestamptz;

-- ─── process_order_refund_atomic: record the real initial Stripe status ───
-- (was hardcoded to 'succeeded' regardless of what Stripe actually returned)
-- and remember pre_refund_status before overwriting orders.status.
--
-- CRITICAL (database-reviewer, pre-apply): `create or replace function` only
-- replaces a function whose argument type list is identical. Appending a new
-- parameter — even with a default — creates a SECOND, coexisting overload
-- instead of replacing the 053-era 7-arg version. Every existing caller
-- (lib/server/process-refund.ts, calling with the original 7 args) would then
-- fail with "function is not unique" on every single refund. Drop the old
-- signature explicitly first so this migration actually replaces it.
drop function if exists public.process_order_refund_atomic(uuid, bigint, text, text, text, text, uuid);

create or replace function public.process_order_refund_atomic(
  p_order_id          uuid,
  p_amount_cents      bigint,
  p_reason            text,
  p_refund_method     text,
  p_stripe_refund_id  text,
  p_notes             text,
  p_processed_by      uuid,
  p_initial_status    text default 'succeeded'
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
  if p_stripe_refund_id is not null then
    select id into v_existing_id from public.order_refunds where stripe_refund_id = p_stripe_refund_id;
    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  select id, total, subtotal, coupon_discount, refunded_amount_cents, status
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
    p_order_id, p_amount_cents, p_reason, p_refund_method, p_stripe_refund_id, p_notes, p_processed_by,
    p_initial_status
  )
  returning id into v_refund_id;

  v_new_refunded := v_order.refunded_amount_cents + p_amount_cents;
  v_new_payment_status := case when v_new_refunded >= v_order.total then 'refunded' else 'partially_refunded' end;

  update public.orders
  set refunded_amount_cents = v_new_refunded,
      payment_status = v_new_payment_status,
      pre_refund_status = case when v_new_payment_status = 'refunded' and status <> 'refunded' then status else pre_refund_status end,
      status = case when v_new_payment_status = 'refunded' then 'refunded' else status end,
      refunded_at = case when v_new_payment_status = 'refunded' then now() else refunded_at end,
      updated_at = now()
  where id = p_order_id;

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

revoke execute on function public.process_order_refund_atomic(uuid, bigint, text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.process_order_refund_atomic(uuid, bigint, text, text, text, text, uuid, text) to service_role;

-- ─── reverse_failed_refund_atomic: undo a refund whose Stripe status later ───
-- ─── resolved to 'failed' (called from the Stripe webhook, not the app) ────
create or replace function public.reverse_failed_refund_atomic(p_stripe_refund_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund          record;
  v_order           record;
  v_attr            record;
  v_commission_base numeric;
  v_fraction        numeric;
  v_adjustment      bigint;
  v_new_refunded    bigint;
  v_new_payment_status text;
begin
  select * into v_refund from public.order_refunds where stripe_refund_id = p_stripe_refund_id for update;
  if v_refund.id is null then
    raise exception 'refund_not_found';
  end if;

  -- Idempotent: a refund already marked failed was already reversed.
  if v_refund.status = 'failed' then
    return;
  end if;

  select id, total, subtotal, coupon_discount, refunded_amount_cents, status, pre_refund_status
  into v_order
  from public.orders
  where id = v_refund.order_id
  for update;

  v_new_refunded := greatest(0, v_order.refunded_amount_cents - v_refund.amount_cents);
  v_new_payment_status := case when v_new_refunded <= 0 then 'paid' else 'partially_refunded' end;

  update public.orders
  set refunded_amount_cents = v_new_refunded,
      payment_status = v_new_payment_status,
      status = case when v_order.status = 'refunded' then coalesce(v_order.pre_refund_status, 'delivered') else v_order.status end,
      pre_refund_status = case when v_order.status = 'refunded' then null else v_order.pre_refund_status end,
      refunded_at = case when v_new_payment_status <> 'refunded' then null else refunded_at end,
      updated_at = now()
  where id = v_order.id;

  select * into v_attr from public.affiliate_attributions where order_id = v_refund.order_id for update;

  if v_attr.id is not null then
    v_commission_base := greatest(coalesce(v_order.subtotal, 0) - coalesce(v_order.coupon_discount, 0), 1);
    v_fraction := least(1, v_refund.amount_cents::numeric / v_commission_base);
    v_adjustment := floor(v_attr.commission_amount_cents * v_fraction);

    -- IMPORTANT (database-reviewer, pre-apply): payout_status is a single label
    -- that can be pushed to 'reversed'/'clawback_pending' by MULTIPLE refunds on
    -- the same order (053 explicitly added support for a second refund reaching
    -- the same attribution). Reversing ONE of those refunds must not blindly
    -- restore 'approved'/'paid' — it must recheck whether the OTHER refund(s)
    -- still fully consume the commission, using the same invariant the forward
    -- path uses (commission_amount_cents - remaining_adjustment <= 0).
    if v_attr.payout_status = 'reversed' then
      update public.affiliate_attributions
      set refund_adjustment_cents = greatest(0, refund_adjustment_cents - v_adjustment),
          payout_status = case
            when (commission_amount_cents - greatest(0, refund_adjustment_cents - v_adjustment)) <= 0 then 'reversed'
            else 'approved'
          end
      where id = v_attr.id;

      update public.affiliate_profiles
      set pending_payout_cents = pending_payout_cents + v_adjustment,
          updated_at = now()
      where id = v_attr.affiliate_id;

    elsif v_attr.payout_status in ('pending', 'approved') then
      update public.affiliate_attributions
      set refund_adjustment_cents = greatest(0, refund_adjustment_cents - v_adjustment)
      where id = v_attr.id;

      update public.affiliate_profiles
      set pending_payout_cents = pending_payout_cents + v_adjustment,
          updated_at = now()
      where id = v_attr.affiliate_id;

    elsif v_attr.payout_status = 'clawback_pending' then
      update public.affiliate_attributions
      set refund_adjustment_cents = greatest(0, refund_adjustment_cents - v_adjustment),
          payout_status = case
            when greatest(0, refund_adjustment_cents - v_adjustment) <= 0 then 'paid'
            else 'clawback_pending'
          end
      where id = v_attr.id;

      update public.affiliate_profiles
      set total_earned_cents = total_earned_cents + v_adjustment,
          clawback_debt_cents = greatest(0, clawback_debt_cents - v_adjustment),
          updated_at = now()
      where id = v_attr.affiliate_id;
    end if;
  end if;

  update public.order_refunds
  set status = 'failed', reversed_at = now()
  where id = v_refund.id;

  insert into public.order_updates (order_id, status, message, updated_by, metadata)
  values (
    v_refund.order_id,
    v_new_payment_status,
    format('El reembolso de $%s MXN falló en Stripe y fue revertido automáticamente', to_char(v_refund.amount_cents / 100.0, 'FM999999990.00')),
    'stripe_webhook',
    jsonb_build_object('type', 'refund_reversed', 'amount_cents', v_refund.amount_cents, 'refund_id', v_refund.id)
  );
end;
$$;

revoke execute on function public.reverse_failed_refund_atomic(text) from public, anon, authenticated;
grant execute on function public.reverse_failed_refund_atomic(text) to service_role;

-- ─── process_affiliate_payout_atomic: accept payment_type/reference_number ───
-- so the live payout route (app/api/admin/affiliates/[id]/payments/route.ts)
-- can call this atomic, row-locked RPC instead of its own non-atomic
-- read-modify-write sequence, without losing the payment_type/reference_number
-- fields that route already records.
-- Same overload hazard as above: drop the 053-era 6-arg signature first.
drop function if exists public.process_affiliate_payout_atomic(uuid, uuid[], date, date, uuid, text);

create or replace function public.process_affiliate_payout_atomic(
  p_affiliate_id      uuid,
  p_attribution_ids   uuid[],
  p_period_from       date,
  p_period_to         date,
  p_paid_by           uuid,
  p_notes             text,
  p_payment_type      text default 'transferencia',
  p_reference_number  text default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
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
    attribution_ids, notes, paid_by, paid_at, payment_type, reference_number
  ) values (
    p_affiliate_id, v_net_payable, p_period_from, p_period_to,
    v_attr_ids,
    case when v_clawback_debt > 0
      then coalesce(p_notes || ' — ', '') || format('Se descontaron $%s MXN de deuda por reembolso previo.', to_char(least(v_total_cents, v_clawback_debt) / 100.0, 'FM999999990.00'))
      else p_notes
    end,
    p_paid_by, now(), p_payment_type, p_reference_number
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

revoke execute on function public.process_affiliate_payout_atomic(uuid, uuid[], date, date, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.process_affiliate_payout_atomic(uuid, uuid[], date, date, uuid, text, text, text) to service_role;
