-- 050_marketing_campaigns.sql
-- Marketing campaigns v1: campaign creation/send/basic-tracking only.
-- Deliverability compliance (suppression/unsubscribe) and Smart Campaigns
-- automation are explicitly deferred — see docs/superpowers/specs/2026-07-16-marketing-campaigns-design.md

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  preheader text,
  status text not null default 'draft' check (status in ('draft','sending','sent','failed')),
  template_key text check (template_key in ('bienvenida','winback','promo','blank')),
  content jsonb not null default '{}',
  audience_segments text[] not null default '{}',
  audience_tags text[] not null default '{}',
  coupon_code text references public.coupons(code) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index idx_marketing_campaigns_status on public.marketing_campaigns(status);
create index idx_marketing_campaigns_created_at on public.marketing_campaigns(created_at desc);

create table public.marketing_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  email text not null,
  name text,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  error_message text,
  sent_at timestamptz,
  opened_at timestamptz,
  open_count int not null default 0
);

create index idx_marketing_campaign_recipients_campaign on public.marketing_campaign_recipients(campaign_id);

create trigger set_marketing_campaigns_updated_at before update on public.marketing_campaigns
  for each row execute function public.handle_updated_at();

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_recipients enable row level security;

-- Admin-only via service-role client (same pattern as orders/coupons) — no public policy needed;
-- the app never queries these tables with the anon/user client.
create policy "Marketing campaigns: admin read/write" on public.marketing_campaigns
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Marketing recipients: admin read/write" on public.marketing_campaign_recipients
  for all using (public.is_admin()) with check (public.is_admin());

-- Add the new 'marketing' permission key to existing admin roles, defaulting the top-tier
-- admin roles to 'total' and everyone else to 'sin_acceso'. Matches the AdminModule permission
-- model already in use.
--
-- NOTE: role rows are matched by existing permission level, not by role name. Migration 004
-- seeds roles named 'super_admin'/'admin', but admin_roles.name is editable via the admin UI
-- (see lib/supabase/queries/adminRoles.ts updateAdminRole) and has since been renamed in
-- production (to 'Admin' / 'Super Admin'). The 'roles' permission ('total' = can manage other
-- admin roles) is a stable proxy for "top-tier admin" that survives renames.
update public.admin_roles
set permissions = permissions || jsonb_build_object('marketing',
  case when permissions->>'roles' = 'total' then 'total' else 'sin_acceso' end)
where not (permissions ? 'marketing');
