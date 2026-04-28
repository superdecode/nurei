-- Guard: ensure payment_type and reference_number exist on commission_payments
-- (migration 029 may not have been applied to all environments)
ALTER TABLE public.commission_payments
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'transferencia'
    CHECK (payment_type IN ('efectivo', 'transferencia', 'otro'));

ALTER TABLE public.commission_payments
  ADD COLUMN IF NOT EXISTS reference_number text;

ALTER TABLE public.commission_payments
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commission_payments_affiliate_paid
  ON public.commission_payments(affiliate_id, paid_at DESC);
