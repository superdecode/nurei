-- All writes to these tables are performed by trusted route handlers or
-- database triggers with the service-role client. Leaving INSERT policies
-- open let anyone with the public anon key pollute operational data or issue
-- arbitrary notifications/coupons directly through PostgREST.

drop policy if exists "Notifications: system insert" on public.notifications;
drop policy if exists "public_insert_errors" on public.page_load_errors;
drop policy if exists "public_insert_vitals" on public.page_performance_events;
drop policy if exists "Product views: anyone insert" on public.product_views;
drop policy if exists "User coupons: system insert" on public.user_coupons;

-- The media bucket is public, so object URLs remain readable without an RLS
-- listing policy. Removing this policy prevents enumeration of every upload.
drop policy if exists "Media: public read" on storage.objects;
