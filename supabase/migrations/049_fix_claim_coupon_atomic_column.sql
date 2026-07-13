-- 049: Fix + harden claim_coupon_atomic.
--
-- Two problems fixed here:
--  1. The function inserted into a non-existent column `snapshot`. The coupon_usages
--     table (migration 014) defines the column as `applied_snapshot`. The mismatch made
--     the RPC throw on EVERY call; the caller swallowed the error, so coupon usages were
--     never recorded and coupons.used_count never incremented — leaving both max_uses and
--     max_uses_per_customer silently unenforced (redemption-abuse vector).
--  2. Usage is now claimed at PAYMENT confirmation instead of order creation, and the same
--     order can reach confirmation via multiple paths (Stripe webhook, admin confirm) plus
--     retries. Added an idempotency guard: a second claim for the same order_id is a no-op
--     that returns 'already_claimed' (no double increment).

CREATE OR REPLACE FUNCTION public.claim_coupon_atomic(
  p_code           text,
  p_order_id       uuid,
  p_customer_email text,
  p_customer_phone text,
  p_discount_cents integer,
  p_snapshot       jsonb DEFAULT '{}'
) RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_coupon RECORD;
  v_per_customer_count integer;
BEGIN
  -- Lock the coupon row for the duration of this transaction
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE upper(code) = upper(p_code)
    AND is_active = true
    AND (is_paused IS NULL OR is_paused = false)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- Idempotency: if this order already claimed the coupon, do nothing.
  -- Serialized by the FOR UPDATE lock above, so concurrent claims for the
  -- same order cannot both pass this check.
  IF EXISTS (
    SELECT 1 FROM public.coupon_usages
    WHERE order_id = p_order_id AND coupon_id = v_coupon.id
  ) THEN
    RETURN 'already_claimed';
  END IF;

  -- Check expiry
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RETURN 'expired';
  END IF;

  -- Check global usage limit
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN 'exhausted';
  END IF;

  -- Check per-customer usage limit
  IF v_coupon.max_uses_per_customer IS NOT NULL THEN
    SELECT count(*) INTO v_per_customer_count
    FROM public.coupon_usages
    WHERE coupon_id = v_coupon.id
      AND (
        (p_customer_email IS NOT NULL AND customer_email = p_customer_email)
        OR
        (p_customer_phone IS NOT NULL AND customer_phone = p_customer_phone)
      );

    IF v_per_customer_count >= v_coupon.max_uses_per_customer THEN
      RETURN 'per_customer_limit';
    END IF;
  END IF;

  -- Register usage (correct column: applied_snapshot)
  INSERT INTO public.coupon_usages (
    coupon_id,
    order_id,
    customer_email,
    customer_phone,
    discount_amount,
    applied_snapshot
  ) VALUES (
    v_coupon.id,
    p_order_id,
    p_customer_email,
    p_customer_phone,
    coalesce(p_discount_cents, 0),
    coalesce(p_snapshot, '{}'::jsonb)
  );

  -- Increment counter atomically
  UPDATE public.coupons
  SET used_count = coalesce(used_count, 0) + 1
  WHERE id = v_coupon.id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_coupon_atomic TO service_role;

-- Guard against duplicate usage rows for the same (coupon, order) at the DB level too.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_usages_coupon_order
  ON public.coupon_usages (coupon_id, order_id)
  WHERE order_id IS NOT NULL;
