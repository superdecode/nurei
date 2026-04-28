-- Add payment_type and reference_number columns to commission_payments
ALTER TABLE public.commission_payments
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'transferencia'
    CHECK (payment_type IN ('efectivo', 'transferencia', 'otro'));

ALTER TABLE public.commission_payments
  ADD COLUMN IF NOT EXISTS reference_number text;

-- Add index for faster lookups by affiliate + paid_at
CREATE INDEX IF NOT EXISTS idx_commission_payments_affiliate_paid
  ON public.commission_payments(affiliate_id, paid_at DESC);
