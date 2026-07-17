# Marketing Tracking Integrations — Design Spec
**Date:** 2026-07-17
**App:** Nurei (Next.js + Supabase + Stripe)
**Status:** Approved

---

## Problem

Nurei has a rich internal analytics dashboard (`app/admin/analytics/*`: revenue, funnel, cohorts, performance/seo, performance/vitals) but zero external tracking integrations. There is no way to measure Meta Ads campaign performance, no Google Analytics, no session-replay tooling (Clarity), and no way to attribute purchases back to ad campaigns. `next.config.ts`'s CSP currently only allows Stripe and Vercel Analytics script/connect sources, which would block any of these scripts if added without updating it.

This spec covers: cookie consent, Google Analytics 4, Meta Pixel + Conversions API (CAPI), and Microsoft Clarity. SEO/indexing (sitemap, robots.txt, Search Console, structured data) is intentionally out of scope — it will be a separate spec after this one, since it doesn't share the consent-gated script-loading architecture that ties the four items above together.

Firebase and DNS were raised in the original request but are excluded: Firebase has no clear use case here (Supabase already covers backend/DB, Vercel covers hosting), and DNS changes require access to the domain registrar that the assistant does not have.

No external accounts (Meta Business, GA4 property, Clarity project) exist yet. This spec implements the code with empty/placeholder env vars — each integration self-disables when its var is unset, following the existing pattern used for Stripe/Twilio/Mapbox in `.env.example`. Account creation steps are documented separately for the user to follow.

## Architecture

A central `lib/tracking/` module owns consent state and per-platform event helpers. GA4 and Clarity scripts are only injected into the DOM after the user accepts consent (via `next/script`, loaded conditionally). Meta Pixel (browser) is gated the same way. Meta Conversions API (server) is NOT gated by browser consent — it runs from the Stripe webhook, independent of ad blockers or Safari ITP, and exists specifically to recover purchase attribution lost to client-side blocking. This is standard practice for Meta CAPI and is why `Purchase` is dual-tracked (pixel + CAPI) with a shared `event_id` for deduplication in Ads Manager.

No Google Tag Manager — scripts are added directly in code, matching the project's existing preference for git-versioned, redeploy-driven changes (confirmed with user; Meta CAPI needs custom server code regardless, so GTM wouldn't remove that work).

## 1. Cookie Consent

Simple binary consent (Accept / Reject), not granular by category. Covers analytics + marketing as one bucket. "Necessary" cookies (session, cart) already work without consent and are unaffected.

- `components/consent/ConsentBanner.tsx` — bottom banner, "Aceptar" / "Rechazar" buttons, dismisses on either choice.
- `components/consent/ConsentProvider.tsx` — React Context exposing `{ consent: 'accepted' | 'rejected' | 'pending', accept(), reject() }`. Wraps the public layout.
- Persisted in cookie `_nurei_consent` (12 month expiry), read on the server for SSR-safe initial state (avoids flash of banner if already decided) and on the client for reactivity.
- `hasConsent` gates the rendering of the GA4/Clarity/Meta Pixel `<Script>` tags — when `false` or `pending`, they simply don't render.

## 2. Google Analytics 4

- `lib/tracking/ga4.ts` — typed helper: `trackViewItem`, `trackAddToCart`, `trackBeginCheckout`, `trackPurchase`. Each wraps `window.gtag('event', ...)` with the GA4 standard ecommerce event schema (`items[]`, `value`, `currency`, `transaction_id` for purchase).
- Script injection: `<Script src="https://www.googletagmanager.com/gtag/js?id=..." strategy="afterInteractive" />` in `app/(public)/layout.tsx`, rendered only when consent is accepted and `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is set.
- Call sites (existing files, additive changes only):
  - `app/(public)/producto/[slug]/ProductDetailClient.tsx` — `trackViewItem` on mount
  - `lib/hooks/useAddToCartFlight.ts` — `trackAddToCart` on successful add
  - `app/(public)/checkout/page.tsx` — `trackBeginCheckout` on entering the payment step
  - `app/(public)/pedido/[id]/page.tsx` — `trackPurchase` when `success=true`, using order `total`/`items`/`id`

## 3. Meta Pixel + Conversions API

**Browser (Pixel):**
- `lib/tracking/meta-pixel.ts` — helper: `trackPageView`, `trackViewContent`, `trackAddToCart`, `trackInitiateCheckout`. Same call sites as GA4 above (minus purchase, which is CAPI-only on the client to avoid double-counting — pixel purchase fires too, but server CAPI is authoritative for the dedup event_id).
- Script injected the same way as GA4, gated by consent + `NEXT_PUBLIC_META_PIXEL_ID`.

**Server (Conversions API):**
- `lib/server/meta-capi.ts` — calls Meta Graph API (`/​{pixel_id}/events`) with `access_token` from `META_CONVERSIONS_API_TOKEN`. Hashes PII fields (email, phone) with SHA-256 per Meta's requirements before sending.
- Fired from `app/api/webhooks/stripe/route.ts`, inside the existing `checkout.session.completed` case, alongside the current affiliate-attribution and coupon-claim calls (`void`-fired, non-blocking, same pattern already used there).
- **Attribution capture:** a small first-party script in the public layout reads `fbclid` from the URL and Meta's own `_fbp`/`_fbc` cookies (set automatically by the Pixel script) — no new cookie needed for `_fbp`/`_fbc`, only `fbclid` needs capturing into a first-party cookie since Meta doesn't set one from the URL param automatically.
- `app/api/payment/create-checkout/route.ts` reads `_fbp`, `_fbc`, and the captured `fbclid` cookie exactly like it already reads `_nurei_ref` (line 63), and adds them to `session.metadata` alongside `referral_link_id`.
- `app/api/webhooks/stripe/route.ts` reads these from `session.metadata` and passes them to `meta-capi.ts` as `fbp`/`fbc`/click-id match parameters, plus `client_ip_address`/`client_user_agent` if available from the original request (best-effort; Stripe webhook requests don't carry the customer's IP, so this comes from what was captured at checkout-creation time via `request.headers.get('x-forwarded-for')`, stored in metadata too).
- `event_id` is a deterministic value derived from `order_id` (e.g. `purchase_${orderId}`), used identically by both the client pixel purchase event and the server CAPI purchase event, so Meta dedupes them.

## 4. Microsoft Clarity

- `lib/tracking/clarity.ts` — thin wrapper: `identifyUser(userId)` (optional, for logged-in users) using `window.clarity('identify', ...)`.
- Script injected the same consent-gated way, using `NEXT_PUBLIC_CLARITY_PROJECT_ID`. No custom events needed — Clarity auto-records session replay and heatmaps.

## 5. Configuration

New vars added to `.env.example` (all blank; each integration no-ops when its var is missing):

```
# Google Analytics 4 (opcional — deja vacío para desactivar)
NEXT_PUBLIC_GA4_MEASUREMENT_ID=

# Meta Pixel + Conversions API (opcional — deja vacío para desactivar)
NEXT_PUBLIC_META_PIXEL_ID=
META_CONVERSIONS_API_TOKEN=

# Microsoft Clarity (opcional — deja vacío para desactivar)
NEXT_PUBLIC_CLARITY_PROJECT_ID=
```

`next.config.ts` CSP additions:
- `script-src`: add `https://www.googletagmanager.com https://connect.facebook.net https://www.clarity.ms`
- `connect-src`: add `https://www.google-analytics.com https://www.facebook.com https://www.clarity.ms`
- `img-src` already allows `https:` broadly, no change needed (Meta/GA4 tracking pixels use image beacons in some fallback paths)

## Error Handling

- Every tracking call (`ga4.ts`, `meta-pixel.ts`, `clarity.ts`) is wrapped so a missing `window.gtag`/`window.fbq`/`window.clarity` (script blocked, ad blocker, consent rejected) fails silently — tracking must never break the actual purchase/browsing flow.
- `meta-capi.ts` failures are caught and logged server-side (not thrown) in the webhook handler, matching the existing `void ... .catch(() => {})` pattern used for affiliate attribution and coupon claiming — a failed marketing-attribution call must never fail order confirmation.

## Testing

- Unit tests for `lib/tracking/ga4.ts`, `meta-pixel.ts`, `clarity.ts`: verify correct event shape passed to mocked `window.gtag`/`fbq`/`clarity`, and silent no-op when the global is undefined.
- Unit test for `lib/server/meta-capi.ts`: verify PII hashing (SHA-256), verify request body shape, verify it no-ops when `META_CONVERSIONS_API_TOKEN` is unset.
- Integration test for the consent cookie round-trip (`ConsentProvider` sets cookie, script gating reads it correctly on next render).
- No E2E test for actual delivery to Meta/GA4 (external services, no test credentials) — verified manually post-deploy using Meta Events Manager's Test Events tool and GA4 DebugView, documented as a manual QA step in the implementation plan.

## Out of Scope

- SEO/indexing (sitemap, robots.txt, Search Console, structured data) — separate spec, next.
- Firebase/FCM — no identified use case.
- DNS configuration — outside assistant's access; would require a separate conversation once the user specifies their DNS provider.
- Granular (per-category) consent — using simple accept/reject per user decision.
- Google Tag Manager — using direct script injection per user decision.
