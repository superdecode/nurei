-- 026: Affiliate payout status 'approved'
-- Flow: pending (attributed, order not yet confirmed by admin)
--       → approved (admin confirmed the order, commission valid)
--       → paid (payout processed)

-- 1. Extend the check constraint
alter table public.affiliate_attributions
  drop constraint if exists affiliate_attributions_payout_status_check;

alter table public.affiliate_attributions
  add constraint affiliate_attributions_payout_status_check
    check (payout_status in ('pending', 'approved', 'paid'));

-- 2. Update process_affiliate_payout_atomic to only pay out 'approved' attributions
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
  v_total_cents int;
  v_attr_ids    uuid[];
begin
  -- Lock and fetch only APPROVED attributions belonging to this affiliate
  select
    sum(commission_amount_cents)::int,
    array_agg(id)
  into v_total_cents, v_attr_ids
  from public.affiliate_attributions
  where id = any(p_attribution_ids)
    and affiliate_id = p_affiliate_id
    and payout_status = 'approved'
  for update;

  if v_total_cents is null or v_total_cents = 0 then
    return 0;
  end if;

  insert into public.commission_payments (
    affiliate_id, amount_cents, period_from, period_to,
    attribution_ids, notes, paid_by, paid_at
  ) values (
    p_affiliate_id, v_total_cents, p_period_from, p_period_to,
    v_attr_ids, p_notes, p_paid_by, now()
  );

  update public.affiliate_attributions
  set payout_status = 'paid', paid_at = now()
  where id = any(v_attr_ids);

  update public.affiliate_profiles
  set
    pending_payout_cents = greatest(0, pending_payout_cents - v_total_cents),
    total_earned_cents   = total_earned_cents + v_total_cents,
    updated_at           = now()
  where id = p_affiliate_id;

  return v_total_cents;
end;
$$;

-- 3. Helper: approve attribution when order is confirmed
create or replace function public.approve_attribution_for_order(p_order_id uuid)
returns void
language sql
security definer
as $$
  update public.affiliate_attributions
  set payout_status = 'approved'
  where order_id = p_order_id
    and payout_status = 'pending';
$$;
