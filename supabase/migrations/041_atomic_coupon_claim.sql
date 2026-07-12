-- Atomic coupon claim: validates usage limit and registers in a single transaction
-- Prevents race conditions where concurrent requests bypass max_uses checks
CREATE OR REPLACE FUNCTION public.claim_coupon_atomic(
  p_code          text,
  p_order_id      uuid,
  p_customer_email text,
  p_customer_phone text,
  p_discount_cents integer,
  p_snapshot      jsonb DEFAULT '{}'
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

  -- Register usage
  INSERT INTO public.coupon_usages (
    coupon_id,
    order_id,
    customer_email,
    customer_phone,
    discount_amount,
    snapshot
  ) VALUES (
    v_coupon.id,
    p_order_id,
    p_customer_email,
    p_customer_phone,
    p_discount_cents,
    p_snapshot
  );

  -- Increment counter atomically
  UPDATE public.coupons
  SET used_count = used_count + 1
  WHERE id = v_coupon.id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_coupon_atomic TO service_role;
