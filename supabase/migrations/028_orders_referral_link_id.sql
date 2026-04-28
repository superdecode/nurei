-- 028: Store referral_link_id on the order at creation time.
-- When a customer clicks an affiliate link, the referral cookie exists only in their
-- browser session. By the time an admin confirms a cash/OXXO order, that cookie is gone.
-- Saving the referral_link_id on the order lets us attribute commission at any point.

alter table public.orders
  add column if not exists referral_link_id uuid
    references public.referral_links(id)
    on delete set null;
