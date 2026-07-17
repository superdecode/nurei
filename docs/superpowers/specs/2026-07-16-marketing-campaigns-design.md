# Marketing Campaigns Module — Design Spec

**Date:** 2026-07-16
**Status:** Approved by user, ready for implementation planning
**Scope:** v1 (Subsystem A only — see "Scope decomposition" below)

## 1. Background & Goal

nurei (Next.js 16 / Supabase e-commerce store for Asian snacks) has no marketing-content tooling today — only transactional order emails (`lib/email/`). The goal is to give the admin team a way to regularly create and send email campaigns to attract customers and, especially, increase repeat-purchase frequency, without reinventing infrastructure that already exists (customers, tags/segments, coupons, Resend transport, admin design system).

The reference implementation is muqui-web's marketing module (`src/modules/admin/pages/MarketingPage.jsx`, 1713 lines, plus `backend/src/routes/marketing.ts` / `services/marketing.ts`). It is feature-complete but monolithic, single-file, and stylistically disconnected from nurei's design system (different color tokens, no live-preview template thumbnails). This spec ports its useful ideas while fixing those issues and adapting to nurei's data model.

## 2. Scope decomposition

muqui's module is really three independent subsystems:

- **(A) Campaign creation & sending** — editor, templates, audience targeting, send, basic tracking.
- **(B) Deliverability compliance** — suppression list, one-click unsubscribe, bounce/complaint webhook handling, health alerts.
- **(C) Smart Campaigns** — rule-based automatic segmentation that drafts campaigns (lapsed customers, day-of-week affinity, etc).

**v1 of this spec covers (A) only.** (B) and (C) are deferred as their own future specs, not discarded — see §9 "Explicitly deferred."

## 3. Key decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Channel | Email only, via existing Resend integration (no WhatsApp — no Business API infra exists yet) |
| Sending domain | `EMAIL_FROM` still points at Resend's sandbox (`onboarding@resend.dev`), no verified domain yet. **Not a build blocker** — module ships fully functional; production sends require verifying a domain (e.g. `nurei.mx`) in Resend first. Flagged as an operational prerequisite, not solved by this spec. |
| Template priorities | Bienvenida/primera compra, Recuperación de clientes inactivos (win-back), Promoción con cupón/temporada |
| Coupon integration | Reference-only — pick an existing active coupon from `/admin/cupones`, no coupon creation from within the campaign editor |
| Creation flow | "Template + inline edit" (option C) — NOT muqui's 3-column block editor, NOT a multi-screen wizard. Pick an illustrated template card → land on a 2-pane view (live preview + short essential-fields panel) → audience/send as a fixed bottom bar |
| Template card style | Mini live-preview thumbnails (real scaled-down render of the template's blocks), not icon+gradient — stays in sync automatically, feels more professional |
| Scheduling | Immediate send only. No "send later" — avoids needing a new cron/queue |
| Metrics | Basic per-campaign: recipients, sent, failed, opened, open rate — using existing `MetricCard`. No cross-campaign funnel/"best campaign" comparison in v1 |
| Color identity | Unlike muqui (different accent color per template — teal, rose, blue), all nurei templates share the **same brand palette** (amber `#FFC107` / black `#111827` / cream `#FFFBEB`) — templates vary in copy, imagery and tone, not in color scheme. This matches "respetar el diseño actual." |

## 4. User flow

1. Admin opens **Marketing** in the sidebar (new nav entry, after Cupones).
2. Overview screen: stat cards (total campaigns, drafts, sent, avg. open rate) + campaign list/table (status tabs: Todas/Borradores/Enviadas/Fallidas), reusing the exact card/table shell from `pedidos`/`inventario`.
3. **"Nueva campaña"** → template gallery: 3 illustrated cards (Bienvenida / Te extrañamos / Promo + cupón) + a 4th "En blanco" option. Each card shows a live miniature render of that template's default content.
4. Selecting a template drops the admin into the editor:
   - **Left/center:** live preview at real size (iframe or sandboxed div rendering the same content model that the email HTML renderer uses).
   - **Right:** short field panel — Nombre (internal), Asunto, Preheader, Título, Texto, Imagen (from media library), Botón CTA (texto + destino: Producto / Categoría / URL), and — only on the promo template — Cupón (dropdown of active coupons).
   - No block reordering, no per-block style knobs, no raw-HTML mode. This is the deliberate simplification vs. muqui.
5. **Bottom bar (always visible):** audience selector (segment checkboxes + tag multi-select, default "Todos con marketing activo") with a live recipient-count preview (debounced), **Guardar borrador**, **Enviar**.
6. Sending: validates required fields → confirmation modal showing recipient count ("no se puede deshacer") → dispatch.
7. Campaign list row → detail panel: metrics cards + recipient list with per-recipient sent/opened/failed badges (mirrors the `pedidos` detail-drawer pattern).

## 5. Data model

New Supabase tables (migration required — note muqui's own `marketing_campaigns` schema is **not** in its tracked migrations, so this is being modeled fresh, not copied from a missing file):

```sql
create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  preheader text,
  status text not null default 'draft' check (status in ('draft','sending','sent','failed')),
  template_key text check (template_key in ('bienvenida','winback','promo','blank')),
  content jsonb not null default '{}',   -- { heading, body, imageUrl, ctaLabel, ctaLink: {type,value}, couponCode }
  audience_segments text[] not null default '{}',  -- subset of customers.segment values, empty = all
  audience_tags text[] not null default '{}',
  coupon_code text references public.coupons(code) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

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
create index on public.marketing_campaign_recipients(campaign_id);
```

Metrics are computed from `marketing_campaign_recipients` (count by status, count with `opened_at is not null`) rather than a separate denormalized `metrics` column — one less place for numbers to drift.

Templates themselves are **not** database rows in v1 — the 3 starter templates are hardcoded config objects in `lib/marketing/templates.ts` (mirrors how muqui did it). Adding a 4th template later (e.g. a "lanzamiento/edición limitada" template — a natural fit given `products.is_featured`/`is_limited` already exist) is a code change, not a migration.

## 6. Audience targeting

Reuses the existing `customers` table directly — no new segmentation system:

- Segment checkboxes: `new / regular / vip / at_risk / lost` (never `blacklist`).
- Tag multi-select from `customers.tags`.
- Empty selection = "todos" (still subject to the hard filter below).
- **Hard, non-optional filter applied server-side on every send:** `accepts_email_marketing = true AND is_active = true AND segment <> 'blacklist'`. This is not exposed as a toggle — it's baked into the audience-resolution query, the same way the coupon engine already respects `customer_tags`.

## 7. Email rendering & sending

- New `lib/email/templates/campaign-email-html.ts`, following the exact pattern of `lib/email/templates/order-emails-html.ts` (hand-rolled HTML-table markup for email-client compatibility, `escapeHtml` helper, same brand constants `BRAND_BG`/`BRAND_AMBER`/`TEXT_DARK`/`TEXT_MUTED` — literally import/reuse those constants rather than re-declaring them).
- Send endpoint resolves audience → inserts `marketing_campaign_recipients` rows (status `queued`) → sends via `resend.emails.send()` in small concurrent batches (e.g. 5 at a time via `Promise.allSettled`) rather than muqui's fully sequential loop — meaningfully faster for larger lists without building a real queue.
- Each send updates the recipient row to `sent`/`failed`; when the loop finishes, campaign status becomes `sent` (or `failed` if 100% of sends failed, matching muqui's rule).
- **Open tracking**: 1×1 transparent GIF at `GET /api/marketing/track/open/[recipientId]` (public, unauthenticated by design — same as muqui), sets `opened_at`/increments `open_count`. Needed because "basic metrics" includes open rate.
- No unsubscribe link, no suppression-list check, no bounce webhook in v1 (see §9). **This means v1 must be used carefully** — every send should be to a deliberately curated audience since there's no automatic list hygiene yet.

## 8. File/route plan

```
app/admin/marketing/page.tsx                          — overview + campaign list (orchestrator, thin)
app/admin/marketing/[id]/page.tsx                      — campaign editor + detail (mode depends on status)
components/admin/marketing/CampaignsOverview.tsx       — stat cards + status-tab table
components/admin/marketing/TemplateGallery.tsx         — 4 template cards w/ live mini-preview
components/admin/marketing/CampaignFieldsPanel.tsx     — right-side essential-fields form
components/admin/marketing/CampaignPreview.tsx         — shared live preview renderer (used full-size in editor AND scaled-down in gallery cards)
components/admin/marketing/AudienceBar.tsx             — segment/tag picker + live count + save/send actions
components/admin/marketing/CtaLinkPicker.tsx           — Producto/Categoría/URL selector; extracts+generalizes the inline product-search pattern already in app/admin/cupones/page.tsx (search via /api/products?search=) rather than importing a shared component, since none exists yet
lib/marketing/templates.ts                             — 3 hardcoded starter template configs
lib/email/templates/campaign-email-html.ts             — server HTML renderer (reuses order-emails-html.ts brand constants)
lib/supabase/queries/marketing.ts                       — campaign CRUD + audience count query
app/api/admin/marketing/campaigns/route.ts              — GET (list), POST (create)
app/api/admin/marketing/campaigns/[id]/route.ts          — GET, PATCH, DELETE (draft-only, mirrors coupons/orders draft-only rule)
app/api/admin/marketing/campaigns/[id]/send/route.ts     — POST send
app/api/admin/marketing/audience-preview/route.ts        — POST, returns { count } for a given segment/tag filter
app/api/marketing/track/open/[recipientId]/route.ts      — public GET, 1x1 gif pixel
supabase/migrations/0NN_marketing_campaigns.sql          — new tables from §5
types/index.ts                                            — MarketingCampaign, CampaignRecipient, CampaignContent types; add 'marketing' to AdminModule
app/admin/layout.tsx                                       — add "Marketing" NAV_ITEMS entry (Megaphone icon, after Cupones)
```

This deliberately splits muqui's 1713-line single file into ~9 focused files (~150-350 lines each), matching nurei's existing convention (e.g. `pedidos` list/detail/print are already separate files) and the project's "many small files" coding standard.

## 9. Explicitly deferred (not part of this spec)

- **(B) Deliverability compliance** — suppression list, one-click unsubscribe (RFC 8058), bounce/complaint webhook, health alerts banner. Should be the very next phase once v1 proves useful, and arguably **before** any large-scale real send — the risk noted in §7 is real.
- **(C) Smart Campaigns** — rule-based auto-segmentation and draft generation (lapsed customers, day/product affinity). Natural fast-follow once v1's audience/template/send primitives exist to build on.
- WhatsApp as a second channel.
- Send scheduling ("send later").
- A/B testing, drip/sequence campaigns.
- Granular permission *enforcement* for the new `marketing` module — we'll add the `AdminModule` key and seed `admin_roles.permissions.marketing` for consistency with the existing (currently decorative/unenforced) permission model, but won't build new enforcement middleware, since none exists for any other module today either.

## 10. Known risks

- No unsubscribe/suppression means every send is manual-curation-only until Phase B ships — document this clearly in the admin UI itself (e.g. a small notice near "Enviar"), not just in this spec.
- No verified Resend sending domain yet — sends will silently fail to deliver to real customers until that's set up. Worth a pre-launch checklist item, not a code change.
- Sequential-ish batched sending (5 concurrent) has no backoff/retry — a large campaign hitting Resend rate limits will show as `failed` recipients with whatever error Resend returns; no automatic retry in v1.
