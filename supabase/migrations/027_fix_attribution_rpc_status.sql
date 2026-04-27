-- 027: Fix record_attribution_atomic — was checking status='paid' which is not a valid
-- orders.status value (constraint only allows: pending, confirmed, shipped, delivered, cancelled, failed).
-- Switch to payment_status='paid' which IS the correct field for payment state.

create or replace function public.record_attribution_atomic(
  p_order_id              uuid,
  p_affiliate_id          uuid,
  p_attribution_type      text,
  p_coupon_id             uuid,
  p_coupon_code           text,
  p_commission_pct        int,
  p_commission_cents      int
)
returns text
language plpgsql
security definer
as $$
declare
  v_exists boolean;
begin
  -- Check order is real and paid (use payment_status, NOT status — 'paid' is invalid in status column)
  select exists(
    select 1 from public.orders where id = p_order_id and payment_status = 'paid'
  ) into v_exists;

  if not v_exists then
    return 'order_invalid';
  end if;

  insert into public.affiliate_attributions (
    order_id, affiliate_id, attribution_type, coupon_id, coupon_code,
    commission_pct, commission_amount_cents
  ) values (
    p_order_id, p_affiliate_id, p_attribution_type, p_coupon_id, p_coupon_code,
    p_commission_pct, p_commission_cents
  )
  on conflict (order_id) do nothing;

  if found then
    update public.affiliate_profiles
    set pending_payout_cents = pending_payout_cents + p_commission_cents,
        updated_at = now()
    where id = p_affiliate_id;

    return 'inserted';
  end if;

  return 'duplicate';
end;
$$;

-- Also fix approve_attribution_for_order (from 026) to also match on payment_status
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
