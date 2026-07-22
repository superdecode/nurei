-- ─── resolve_wheel_spin_atomic: prevent indefinite 2x multiplier renewal abuse ──
-- Corrective follow-up to 20260722121000_loyalty_wheel.sql (do not edit that file;
-- this repo's convention is to correct already-applied migrations with a new one,
-- e.g. 053_fix_refund_rpc_security_and_math.sql / 054_reverse_failed_refund.sql).
--
-- Bug: because cart_session_id is client-generated and regenerated freely (this
-- repo's cart is entirely client-side, so there is no server-side cart to validate
-- against), a user can spam the endpoint with fresh session ids and a fabricated
-- subtotal >= 39900 to draw unlimited spins. The points_multiplier_2x prize
-- unconditionally set active_multiplier_expires_at = now() + 24h on every win,
-- letting a spammer keep a permanent, indefinitely-renewed 2x points multiplier —
-- points-earning inflation. The other prizes are already bounded to one-per-user
-- by the user_coupons unique constraint and are unaffected by this fix.
--
-- Fix: if the user already has an active, unexpired multiplier at spin time,
-- downgrade a points_multiplier_2x roll to 'no_prize' instead of granting/renewing
-- the window. Win probabilities, the coupon-prize branches, the wheel_spins insert,
-- and the unique_violation handling are otherwise unchanged.

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
  v_roll                    numeric;
  v_prize_type              text;
  v_coupon_code             text;
  v_coupon_id               uuid;
  v_spin_id                 uuid;
  v_has_active_multiplier   boolean;
begin
  if p_cart_subtotal_cents < 39900 then
    return jsonb_build_object('ok', false, 'reason', 'below_threshold');
  end if;

  v_roll := random();

  select exists (
    select 1 from public.loyalty_points
    where user_id = p_user_id
      and active_multiplier_expires_at is not null
      and active_multiplier_expires_at > now()
  ) into v_has_active_multiplier;

  if v_roll < 0.35 then
    v_prize_type := 'no_prize';           v_coupon_code := null;
  elsif v_roll < 0.60 then
    v_prize_type := 'discount_pct_5';     v_coupon_code := 'RULETA-5';
  elsif v_roll < 0.80 then
    v_prize_type := 'discount_pct_10';    v_coupon_code := 'RULETA-10';
  elsif v_roll < 0.92 then
    v_prize_type := 'free_shipping';      v_coupon_code := 'RULETA-ENVIO';
  elsif v_has_active_multiplier then
    -- Would have been points_multiplier_2x, but the user already has an active,
    -- unexpired multiplier — downgrade to avoid indefinite renewal abuse.
    v_prize_type := 'no_prize';           v_coupon_code := null;
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
