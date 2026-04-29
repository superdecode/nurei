-- ============================================
-- 032: ANALYTICS - ORDER REFUNDS TABLE
-- ============================================

-- ============================================
-- ORDER REFUNDS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  reason text,
  refunded_at timestamptz NOT NULL DEFAULT now(),
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  refund_method text CHECK (refund_method IN ('stripe', 'cash', 'bank_transfer', 'other')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_refunds_order ON public.order_refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_refunded_at ON public.order_refunds(refunded_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_refunds_processed_by ON public.order_refunds(processed_by);

-- ============================================
-- ORDER ITEMS TABLE (extracted from orders.items jsonb)
-- ============================================

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents >= 0),
  total_cents bigint NOT NULL CHECK (total_cents >= 0),
  cost_estimate_cents bigint DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created ON public.order_items(created_at DESC);

-- ============================================
-- FUNCTION: Extract order items from jsonb to order_items table
-- ============================================

CREATE OR REPLACE FUNCTION public.extract_order_items()
RETURNS void AS $$
DECLARE
  order_record RECORD;
  item_record jsonb;
BEGIN
  FOR order_record IN
    SELECT id, items FROM public.orders
    WHERE items IS NOT NULL AND jsonb_array_length(items) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.order_items WHERE order_id = orders.id
    )
  LOOP
    FOR i IN 0..jsonb_array_length(order_record.items)-1 LOOP
      item_record := order_record.items->i;
      
      INSERT INTO public.order_items (
        order_id,
        product_id,
        product_name,
        quantity,
        unit_price_cents,
        total_cents,
        cost_estimate_cents
      )
      VALUES (
        order_record.id,
        (item_record->>'productId')::uuid,
        item_record->>'name',
        COALESCE((item_record->>'quantity')::int, 1),
        COALESCE((item_record->>'price')::bigint, 0),
        COALESCE((item_record->>'total')::bigint, 0),
        0
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute extraction for existing orders
SELECT public.extract_order_items();

-- ============================================
-- TRIGGER: Automatically extract order items on insert/update
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_order_items_trigger()
RETURNS trigger AS $$
BEGIN
  -- Delete existing items for this order
  DELETE FROM public.order_items WHERE order_id = NEW.id;
  
  -- Insert new items from jsonb
  IF NEW.items IS NOT NULL AND jsonb_array_length(NEW.items) > 0 THEN
    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price_cents,
      total_cents
    )
    SELECT
      NEW.id,
      (item->>'productId')::uuid,
      item->>'name',
      COALESCE((item->>'quantity')::int, 1),
      COALESCE((item->>'price')::bigint, 0),
      COALESCE((item->>'total')::bigint, 0)
    FROM jsonb_array_elements(NEW.items) AS item;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_extract_order_items
  AFTER INSERT OR UPDATE OF items ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_items_trigger();
