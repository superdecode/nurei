-- ============================================
-- 014: AFFILIATE RLS POLICIES
-- ============================================

alter table public.affiliate_profiles   enable row level security;
alter table public.referral_links       enable row level security;
alter table public.referral_clicks      enable row level security;
alter table public.affiliate_attributions enable row level security;
alter table public.commission_payments  enable row level security;

-- ─── AFFILIATE PROFILES ──────────────────────
create policy "Affiliate profiles: read own"
  on public.affiliate_profiles for select using (id = auth.uid());

create policy "Affiliate profiles: update own"
  on public.affiliate_profiles for update using (id = auth.uid());

create policy "Affiliate profiles: admin all"
  on public.affiliate_profiles for all using (public.is_admin());

-- ─── REFERRAL LINKS ──────────────────────────
create policy "Referral links: affiliate read own"
  on public.referral_links for select using (affiliate_id = auth.uid());

create policy "Referral links: admin all"
  on public.referral_links for all using (public.is_admin());

-- ─── REFERRAL CLICKS ─────────────────────────
create policy "Referral clicks: system insert"
  on public.referral_clicks for insert with check (true);

create policy "Referral clicks: affiliate read own via link"
  on public.referral_clicks for select using (
    exists (
      select 1 from public.referral_links rl
      where rl.id = referral_link_id and rl.affiliate_id = auth.uid()
    )
  );

create policy "Referral clicks: admin all"
  on public.referral_clicks for all using (public.is_admin());

-- ─── AFFILIATE ATTRIBUTIONS ──────────────────
create policy "Attributions: affiliate read own"
  on public.affiliate_attributions for select using (affiliate_id = auth.uid());

create policy "Attributions: system insert"
  on public.affiliate_attributions for insert with check (true);

create policy "Attributions: admin all"
  on public.affiliate_attributions for all using (public.is_admin());

-- ─── COMMISSION PAYMENTS ─────────────────────
create policy "Commission payments: affiliate read own"
  on public.commission_payments for select using (affiliate_id = auth.uid());

create policy "Commission payments: admin all"
  on public.commission_payments for all using (public.is_admin());
