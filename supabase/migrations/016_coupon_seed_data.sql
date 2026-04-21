-- ============================================
-- 016: COUPON SEED DATA (SAFE UPSERT STYLE)
-- ============================================

insert into public.coupons (
  code,
  type,
  discount_type,
  value,
  min_order_amount,
  max_uses,
  max_uses_per_customer,
  is_active,
  is_paused,
  scope_type,
  scope_category_slugs,
  scope_product_ids,
  customer_tags,
  description
)
select
  'WELCOME10',
  'percentage',
  'percentage',
  10,
  0,
  500,
  1,
  true,
  false,
  'global',
  array[]::text[],
  array[]::uuid[],
  array[]::text[],
  'Cupón de bienvenida 10%'
where not exists (
  select 1 from public.coupons where code = 'WELCOME10'
);

insert into public.coupons (
  code,
  type,
  discount_type,
  value,
  min_order_amount,
  max_uses,
  max_uses_per_customer,
  is_active,
  is_paused,
  scope_type,
  scope_category_slugs,
  scope_product_ids,
  customer_tags,
  description
)
select
  'ENVIOFREE',
  'fixed',
  'fixed',
  9900,
  39900,
  300,
  1,
  true,
  false,
  'global',
  array[]::text[],
  array[]::uuid[],
  array[]::text[],
  'Descuento fijo para cubrir envío en compras mayores a 399 MXN'
where not exists (
  select 1 from public.coupons where code = 'ENVIOFREE'
);
