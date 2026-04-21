# Affiliate Module — Design Spec
**Date:** 2026-04-20  
**App:** Nurei (Next.js + Supabase)  
**Status:** Approved

---

## 1. Overview

Add an affiliate/referral program module to Nurei that lets the admin create affiliate accounts, assign them personalized coupon codes and referral links, and pay them commissions on the sales they generate. Affiliates get a dedicated portal (`/affiliate`) to track their performance in detail.

The primary business goal is to leverage Instagram and TikTok affiliates who are not heavily monetized, giving them a competitive tool (a real dashboard + commissions) to promote Nurei products.

---

## 2. Scope

**In scope:**
- New `affiliate` role in the existing auth system
- Referral link tracking via cookie (30-day TTL)
- Coupon codes linked to individual affiliates
- Attribution hierarchy: coupon > cookie
- Per-affiliate commission rates (negotiated individually)
- Affiliate portal: detailed dashboard (clicks, orders, earnings, conversion rate, top products, payout history)
- Admin module: manage affiliates, set rates, assign coupons, record manual payouts

**Out of scope (initial release):**
- Automated payment disbursement (manual payouts only)
- Multi-level referrals
- Affiliate self-registration

---

## 3. Database Schema

### 3.1 Modified tables

**`user_profiles`**
```sql
-- Extend role CHECK constraint
role text not null default 'customer'
  check (role in ('customer', 'admin', 'affiliate'))
```

**`coupons`**
```sql
-- Add nullable FK to affiliate owner
affiliate_id uuid nullable references auth.users(id) on delete set null
```

### 3.2 New tables

**`affiliate_profiles`** — per-affiliate settings and balance
```sql
create table public.affiliate_profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  handle                   text not null unique,       -- public name e.g. @mariafood
  bio                      text,
  commission_coupon_pct    int  not null default 10    check (commission_coupon_pct between 0 and 100),
  commission_cookie_pct    int  not null default 5     check (commission_cookie_pct between 0 and 100),
  total_earned_cents       int  not null default 0,
  pending_payout_cents     int  not null default 0,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
```

**`referral_links`** — one unique link per affiliate
```sql
create table public.referral_links (
  id              uuid primary key default gen_random_uuid(),
  affiliate_id    uuid not null references auth.users(id) on delete cascade,
  slug            text not null unique,   -- e.g. "maria" → nurei.mx/?ref=maria
  clicks_count    int  not null default 0,
  created_at      timestamptz not null default now(),
  unique (affiliate_id)                  -- one link per affiliate
);
```

**`referral_clicks`** — individual click events
```sql
create table public.referral_clicks (
  id                uuid primary key default gen_random_uuid(),
  referral_link_id  uuid not null references public.referral_links(id) on delete cascade,
  session_id        text not null,        -- anonymous cookie id
  ip_hash           text,                 -- SHA-256 truncated, for fraud audit only
  converted         boolean not null default false,
  order_id          uuid references public.orders(id) on delete set null,
  clicked_at        timestamptz not null default now()
);

-- Dedup index: same session cannot count twice within 1h
create unique index idx_referral_clicks_dedup
  on public.referral_clicks (referral_link_id, session_id)
  where clicked_at > now() - interval '1 hour';
```

**`affiliate_attributions`** — one attribution record per order
```sql
create table public.affiliate_attributions (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null unique references public.orders(id) on delete cascade,
  affiliate_id            uuid not null references auth.users(id) on delete cascade,
  attribution_type        text not null check (attribution_type in ('coupon', 'cookie')),
  coupon_id               uuid references public.coupons(id) on delete set null,
  commission_pct          int  not null,  -- snapshot at time of order
  commission_amount_cents int  not null,
  payout_status           text not null default 'pending' check (payout_status in ('pending', 'paid')),
  paid_at                 timestamptz,
  created_at              timestamptz not null default now()
);
```

**`commission_payments`** — manual payout records
```sql
create table public.commission_payments (
  id                uuid primary key default gen_random_uuid(),
  affiliate_id      uuid not null references auth.users(id) on delete cascade,
  amount_cents      int  not null check (amount_cents > 0),
  period_from       date not null,
  period_to         date not null,
  attribution_ids   uuid[] not null default '{}',  -- orders covered
  notes             text,
  paid_by           uuid references auth.users(id) on delete set null,
  paid_at           timestamptz not null default now()
);
```

### 3.3 Row Level Security

```sql
-- affiliate_profiles
"Read own"   → id = auth.uid()
"Admin all"  → is_admin()

-- referral_links
"Read own"   → affiliate_id = auth.uid()
"Admin all"  → is_admin()

-- referral_clicks
"Affiliate read own"  → referral_link.affiliate_id = auth.uid()
"System insert"       → true  (via service_role in API route)
"Admin all"           → is_admin()

-- affiliate_attributions
"Read own"   → affiliate_id = auth.uid()
"Admin all"  → is_admin()

-- commission_payments
"Read own"   → affiliate_id = auth.uid()
"Admin all"  → is_admin()
```

---

## 4. Attribution Flow

```
1. CLICK
   GET nurei.mx/?ref=<slug>
   → POST /api/referral/click  (slug, session_id, ip_hash)
   → Insert referral_clicks (deduplicated by session+link within 1h)
   → Increment referral_links.clicks_count
   → Set cookie _nurei_ref=<referral_link_id>  (30 days, SameSite=Lax)

2. CHECKOUT — attribution resolution (priority order)
   a. Does the applied coupon have an affiliate_id?
      YES → attribution_type = 'coupon', commission_pct = affiliate.commission_coupon_pct
   b. Does cookie _nurei_ref exist and is < 30 days old?
      YES → attribution_type = 'cookie', commission_pct = affiliate.commission_cookie_pct
   c. Neither → no attribution, order is unaffiliated

3. ORDER CONFIRMED (payment_status = 'paid')
   → Create affiliate_attributions
   → commission_amount_cents = order.total * commission_pct / 100
   → Mark referral_clicks.converted = true  (if cookie path)
   → affiliate_profiles.pending_payout_cents += commission_amount_cents

4. ADMIN PAYS AFFILIATE
   → Admin selects pending attributions and records payment
   → Create commission_payments
   → affiliate_attributions.payout_status = 'paid'
   → affiliate_profiles.pending_payout_cents -= amount_cents
   → affiliate_profiles.total_earned_cents += amount_cents
```

### Cookie rules
- Name: `_nurei_ref`
- TTL: 30 days
- HttpOnly: false (must be readable at checkout)
- SameSite: Lax
- Last-click wins: new click from a different affiliate overwrites the cookie

---

## 5. Routes & File Structure

```
app/
├── affiliate/
│   ├── layout.tsx              ← Guard: role must be 'affiliate'
│   ├── page.tsx                ← Redirect → /affiliate/overview
│   ├── overview/page.tsx       ← KPIs + weekly chart + top products
│   ├── ventas/page.tsx         ← Attributed orders table with filters
│   ├── pagos/page.tsx          ← Payout history
│   └── perfil/page.tsx         ← Handle, bio, payment contact info
│
├── api/
│   ├── referral/
│   │   └── click/route.ts      ← POST: record click + set cookie
│   └── checkout/
│       └── attribution/route.ts ← Called on order confirm: resolve + record attribution
│
└── admin/
    └── affiliates/
        ├── page.tsx             ← Affiliates list: handle, orders/month, pending payout, rates
        ├── [id]/page.tsx        ← Profile: edit rates, assign coupon, orders table
        └── pagos/page.tsx       ← Pending payouts across all affiliates, record payment

lib/
└── affiliate/
    ├── attribution.ts           ← Pure function: resolve attribution from coupon + cookie
    ├── commission.ts            ← Pure function: calculate commission amount
    └── cookie.ts                ← set / get / clear _nurei_ref cookie
```

---

## 6. Affiliate Dashboard — Content Detail

### `/affiliate/overview`
- **KPI cards:** Total earned (MXN) · Pending payout · Total orders attributed · Total link clicks · Conversion rate (clicks → orders)
- **Chart:** Weekly attributed sales (last 8 weeks) — bar chart
- **Top 3 products:** Product name + units sold via this affiliate

### `/affiliate/ventas`
- **Table columns:** Date · Short order ID · Order total · Attribution type (badge: Coupon / Cookie) · Commission % · Commission amount · Payout status (Pending / Paid)
- **Filters:** Date range · Attribution type · Payout status

### `/affiliate/pagos`
- **Table:** Payment date · Period covered · Amount · Orders included (expandable) · Notes

### `/affiliate/perfil`
- Editable: handle (display only, not editable once set), bio, payment contact info (CLABE / PayPal / notes)

---

## 7. Admin Module — `/admin/affiliates`

### List view
| Handle | Active | Orders (30d) | Pending payout | Coupon | Coupon rate | Cookie rate | Actions |
|--------|--------|-------------|----------------|--------|-------------|-------------|---------|

### Detail view (`/admin/affiliates/[id]`)
- Edit commission rates (coupon % and cookie %)
- Assign or create a coupon linked to this affiliate
- Toggle active/inactive
- Full attributed orders table
- Button: "Register payout" → opens modal to select pending orders and record payment

### Payouts view (`/admin/affiliates/pagos`)
- Grouped by affiliate: pending amount + list of unpaid orders
- "Pay" action per affiliate → records commission_payments, updates balances

---

## 8. Anti-fraud & Data Protection

- Click deduplication: same `session_id` + `referral_link_id` within 1 hour → rejected
- `ip_hash`: SHA-256 of IP (truncated to 16 chars), stored for audit only — raw IP never persisted
- Commissions calculated only on `payment_status = 'paid'` orders
- Refunded orders (`payment_status = 'refunded'`) → commission reverted automatically

---

## 9. Migration Plan

```
012_affiliate_role.sql          ← Extend user_profiles.role CHECK + coupons.affiliate_id
013_affiliate_tables.sql        ← Create all 5 new tables + indexes
014_affiliate_rls.sql           ← RLS policies for all new tables
```

---

## 10. Success Criteria

- Admin can create an affiliate account, set rates, and assign a coupon in under 2 minutes
- Affiliate clicks their referral link → cookie planted → order placed → commission appears in their dashboard within 60 seconds of payment confirmation
- Coupon attribution takes priority over cookie attribution in all cases
- Affiliate dashboard shows correct conversion rate, top products, and pending payout balance
- Admin can record a manual payout and the affiliate's pending balance updates immediately
