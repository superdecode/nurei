-- ============================================
-- 009: Separate storefront customers from internal admin users
-- - CRM `customers` rows only for profiles with role = customer
-- - Admins (role = admin) must not appear in Clientes
-- ============================================

-- 1) Remove auth.users trigger that created a customer for every signup (including admins)
drop trigger if exists trg_auth_user_to_customer on auth.users;
drop function if exists public.ensure_customer_from_user();

-- 2) Sync customer row from user_profiles.role (source of truth for internal vs storefront)
create or replace function public.sync_customer_row_for_profile()
returns trigger as $$
declare
  uemail text;
begin
  if new.role = 'admin' then
    delete from public.customers where user_id = new.id;
    return new;
  end if;

  if new.role <> 'customer' then
    return new;
  end if;

  select email into uemail from auth.users where id = new.id;
  if uemail is null or length(trim(uemail)) = 0 then
    return new;
  end if;

  insert into public.customers (user_id, email, source)
  values (new.id, lower(trim(uemail)), 'web')
  on conflict (user_id) do update set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_profile_sync_customer on public.user_profiles;
create trigger trg_profile_sync_customer
  after insert or update of role on public.user_profiles
  for each row execute function public.sync_customer_row_for_profile();

-- 3) Data cleanup: remove CRM rows tied to internal admins
delete from public.customers c
using public.user_profiles up
where c.user_id = up.id
  and up.role = 'admin';

-- 4) Ensure storefront users (customer role) still have a linked row after trigger change
insert into public.customers (user_id, email, source)
select up.id, lower(trim(u.email)), 'web'
from public.user_profiles up
join auth.users u on u.id = up.id
left join public.customers c on c.user_id = up.id
where up.role = 'customer'
  and c.id is null
  and u.email is not null
  and length(trim(u.email)) > 0
on conflict (user_id) do nothing;

-- 5) Stats view: exclude any row still linked to an admin profile (defense in depth)
create or replace view public.customer_stats as
select
  count(*)::int                                                           as total,
  count(*) filter (where is_active)::int                                   as active,
  count(*) filter (where segment = 'vip')::int                             as vip,
  count(*) filter (where segment = 'new')::int                             as new_count,
  count(*) filter (where segment = 'at_risk')::int                         as at_risk,
  count(*) filter (where segment = 'lost')::int                            as lost,
  count(*) filter (where customer_type = 'business')::int                  as business,
  count(*) filter (where accepts_marketing)::int                           as marketable,
  coalesce(sum(total_spent_cents), 0)::bigint                              as gmv_cents,
  coalesce(avg(total_spent_cents) filter (where completed_orders_count > 0), 0)::int as avg_ltv_cents,
  count(*) filter (where created_at > now() - interval '30 days')::int     as new_last_30d
from public.customers c
where c.user_id is null
   or not exists (
     select 1 from public.user_profiles up
     where up.id = c.user_id and up.role = 'admin'
   );

grant select on public.customer_stats to anon, authenticated;
