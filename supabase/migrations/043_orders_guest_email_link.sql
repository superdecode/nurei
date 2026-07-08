-- Let a signed-in user see their own guest checkouts (placed under the same
-- email before they had an account), scoped to orders still awaiting payment.
-- Paid/delivered guest orders stay hidden since email ownership isn't verified
-- at signup — see lib/supabase/queries/userOrders.ts.
create policy "Orders: guest email match (pending only)" on public.orders
  for select using (
    user_id is null
    and payment_status = 'pending'
    and customer_email is not null
    and auth.email() is not null
    and lower(customer_email) = lower(auth.email())
  );
