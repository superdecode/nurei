-- ============================================
-- 024: AFFILIATE SECURITY FIXES
-- ============================================

-- 0. Helper: look up an auth user by email without paginated listUsers
create or replace function public.get_auth_user_by_email(p_email text)
returns table(id uuid, email text)
language sql
security definer
as $$
  select id, email::text from auth.users where lower(email) = lower(p_email) limit 1;
$$;

-- 1. Fix dedup index: remove partial condition so the same session
--    cannot be counted twice even after converting.
drop index if exists public.idx_referral_clicks_dedup;

create unique index if not exists idx_referral_clicks_dedup
  on public.referral_clicks (referral_link_id, session_id);

-- 2. Atomic attribution: INSERT + pending balance increment in one transaction.
--    Returns 'inserted' | 'duplicate' | 'order_invalid'.
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
  -- Check order is real and paid
  select exists(
    select 1 from public.orders where id = p_order_id and status = 'paid'
  ) into v_exists;

  if not v_exists then
    return 'order_invalid';
  end if;

  -- Attempt insert; on duplicate order_id silently skip
  insert into public.affiliate_attributions (
    order_id, affiliate_id, attribution_type, coupon_id, coupon_code,
    commission_pct, commission_amount_cents
  ) values (
    p_order_id, p_affiliate_id, p_attribution_type, p_coupon_id, p_coupon_code,
    p_commission_pct, p_commission_cents
  )
  on conflict (order_id) do nothing;

  -- Only increment if row was inserted (i.e. not a duplicate)
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

-- 3. Atomic payout: mark attributions paid + decrement pending + increment total
--    in one transaction. Returns the amount actually paid out.
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
  -- Lock and fetch only pending attributions belonging to this affiliate
  select
    sum(commission_amount_cents)::int,
    array_agg(id)
  into v_total_cents, v_attr_ids
  from public.affiliate_attributions
  where id = any(p_attribution_ids)
    and affiliate_id = p_affiliate_id
    and payout_status = 'pending'
  for update;

  if v_total_cents is null or v_total_cents = 0 then
    return 0;
  end if;

  -- Insert payment record
  insert into public.commission_payments (
    affiliate_id, amount_cents, period_from, period_to,
    attribution_ids, notes, paid_by, paid_at
  ) values (
    p_affiliate_id, v_total_cents, p_period_from, p_period_to,
    v_attr_ids, p_notes, p_paid_by, now()
  );

  -- Mark attributions as paid
  update public.affiliate_attributions
  set payout_status = 'paid', paid_at = now()
  where id = any(v_attr_ids);

  -- Atomically decrement pending and increment total
  update public.affiliate_profiles
  set
    pending_payout_cents = greatest(0, pending_payout_cents - v_total_cents),
    total_earned_cents   = total_earned_cents + v_total_cents,
    updated_at           = now()
  where id = p_affiliate_id;

  return v_total_cents;
end;
$$;
