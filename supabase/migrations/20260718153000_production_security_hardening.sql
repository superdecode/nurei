-- Production security hardening: these objects are accessed exclusively by
-- route handlers using the service-role client or by database triggers. They
-- must not be callable directly through PostgREST's public RPC surface.

-- The weekly folio counter is an internal ledger table. The reservation RPC
-- already grants execution only to service_role; protect the table as well.
alter table public.order_weekly_folios enable row level security;
revoke all on table public.order_weekly_folios from anon, authenticated;

-- Customer aggregates are operational data, not a public analytics endpoint.
alter view public.customer_stats set (security_invoker = true);
revoke all on table public.customer_stats from anon, authenticated;

-- Lock the search path of SECURITY DEFINER routines to prevent object-shadowing.
alter function public.claim_coupon_atomic(text, uuid, text, text, integer, jsonb) set search_path = public;
alter function public.crm_reorder_deals(uuid, uuid, uuid[]) set search_path = public;
alter function public.get_auth_user_by_email(text) set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.increment_affiliate_pending(uuid, integer) set search_path = public;
alter function public.increment_referral_clicks(uuid) set search_path = public;
alter function public.recompute_customer_segment(uuid) set search_path = public;
alter function public.sync_customer_row_for_profile() set search_path = public;
alter function public.sync_customer_stats(uuid) set search_path = public;

-- The customer-statistics trigger can run for a guest checkout. Secure the
-- wrapper so it can safely call the internal SECURITY DEFINER recalculation
-- after EXECUTE is revoked from browser roles.
alter function public.handle_order_customer_change() security definer set search_path = public;

revoke all on function public.claim_coupon_atomic(text, uuid, text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.crm_reorder_deals(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.extract_order_items() from public, anon, authenticated;
revoke all on function public.get_auth_user_by_email(text) from public, anon, authenticated;
revoke all on function public.increment_affiliate_pending(uuid, integer) from public, anon, authenticated;
revoke all on function public.increment_referral_clicks(uuid) from public, anon, authenticated;
revoke all on function public.recompute_customer_segment(uuid) from public, anon, authenticated;
revoke all on function public.sync_customer_stats(uuid) from public, anon, authenticated;

grant execute on function public.claim_coupon_atomic(text, uuid, text, text, integer, jsonb) to service_role;
grant execute on function public.crm_reorder_deals(uuid, uuid, uuid[]) to service_role;
grant execute on function public.extract_order_items() to service_role;
grant execute on function public.get_auth_user_by_email(text) to service_role;
grant execute on function public.increment_affiliate_pending(uuid, integer) to service_role;
grant execute on function public.increment_referral_clicks(uuid) to service_role;
grant execute on function public.recompute_customer_segment(uuid) to service_role;
grant execute on function public.sync_customer_stats(uuid) to service_role;
