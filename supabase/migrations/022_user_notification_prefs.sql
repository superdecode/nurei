-- Per-user notification preferences
alter table public.user_profiles
  add column if not exists notification_prefs jsonb not null
  default '{"sound_enabled":true,"browser_notifications":true,"email_on_new_order":true}';

-- Enable Supabase Realtime for the orders table (needed for instant notifications)
alter table public.orders replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
end$$;

-- Allow authenticated admin users to SELECT orders (for Realtime subscription)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'orders'
      and policyname = 'Admins can select orders'
  ) then
    execute $policy$
      create policy "Admins can select orders" on public.orders
        for select to authenticated
        using (
          exists (
            select 1 from public.user_profiles up
            where up.id = auth.uid() and up.role = 'admin'
          )
        );
    $policy$;
  end if;
end$$;
