-- ============================================
-- LOYALTY: Wheel of Snacks
-- ============================================

create table if not exists public.wheel_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cart_session_id text not null,
  prize_type text not null check (prize_type in ('no_prize', 'discount_pct_5', 'discount_pct_10', 'free_shipping', 'points_multiplier_2x')),
  coupon_code text,
  spun_at timestamptz not null default now(),
  unique (user_id, cart_session_id)
);

create index idx_wheel_spins_user on public.wheel_spins(user_id);

alter table public.wheel_spins enable row level security;

create policy "wheel_spins: users read own"
  on public.wheel_spins for select using (user_id = auth.uid());

-- Seed the wheel's coupon-backed prizes. RULETA-ENVIO's value is a
-- placeholder for the standard shipping fee — adjust it from /admin/cupones
-- if the real fee differs, no code change needed.
insert into public.coupons (code, type, value, min_order_amount, max_uses, is_active, description) values
  ('RULETA-5',     'percentage', 5,    0, null, true, 'Premio de la Ruleta de Snacks: 5% de descuento'),
  ('RULETA-10',    'percentage', 10,   0, null, true, 'Premio de la Ruleta de Snacks: 10% de descuento'),
  ('RULETA-ENVIO', 'fixed',      9900, 0, null, true, 'Premio de la Ruleta de Snacks: envío gratis')
on conflict (code) do nothing;

-- ─── resolve_wheel_spin_atomic ──────────────────────────────────────────────
-- One spin per (user, cart_session_id) — enforced by the unique index above,
-- not by an application-side check, so concurrent double-clicks can't win twice.
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
  v_roll         numeric;
  v_prize_type   text;
  v_coupon_code  text;
  v_coupon_id    uuid;
  v_spin_id      uuid;
begin
  if p_cart_subtotal_cents < 39900 then
    return jsonb_build_object('ok', false, 'reason', 'below_threshold');
  end if;

  v_roll := random();

  if v_roll < 0.35 then
    v_prize_type := 'no_prize';           v_coupon_code := null;
  elsif v_roll < 0.60 then
    v_prize_type := 'discount_pct_5';     v_coupon_code := 'RULETA-5';
  elsif v_roll < 0.80 then
    v_prize_type := 'discount_pct_10';    v_coupon_code := 'RULETA-10';
  elsif v_roll < 0.92 then
    v_prize_type := 'free_shipping';      v_coupon_code := 'RULETA-ENVIO';
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
