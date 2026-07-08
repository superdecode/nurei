-- The "guest tracking" policy used `using (true)`, which makes every row in
-- public.orders readable by anyone with the anon key (no auth, no token check).
-- Legitimate guest tracking already goes through lib/server/order-access.ts,
-- which uses the service-role client and verifies public_access_token or
-- user_id ownership in application code — this policy is redundant and unsafe.
drop policy if exists "Orders: read by id (guest tracking)" on public.orders;
