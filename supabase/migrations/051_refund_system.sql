-- ============================================
-- 051: REFUND SYSTEM
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
