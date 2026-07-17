# Marketing Campaigns Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a v1 "Marketing" admin module for nurei — create, preview, and send templated email campaigns to segments of the existing `customers` table, with basic open-rate tracking.

**Architecture:** New Supabase tables (`marketing_campaigns`, `marketing_campaign_recipients`) behind a Next.js admin route (`app/admin/marketing`). Campaign content is a small typed JSON blob (heading/body/image/CTA/coupon), rendered both as a live React preview and as table-based HTML email via Resend. Audience resolution is a pure filter-builder over `customers` (segment/tags + hard-coded `accepts_email_marketing`/`is_active` guard). No new channel, no scheduler, no suppression list — see the design spec for what's deferred.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + service-role client), Resend, Tailwind v4, vitest for pure-logic unit tests (matching the project's existing `__tests__/` convention — no component/route test infra exists in this repo, so those layers get manual `curl`/browser verification steps instead, per existing project convention).

**Design spec:** `docs/superpowers/specs/2026-07-16-marketing-campaigns-design.md`

---

## Before You Start

All commands below assume the working directory is `/Users/quiron/CascadeProjects/nurei`. The dev server (if not already running) is started with:

```bash
npm run dev
```

It runs on **port 3500** (see `package.json` → `"dev": "... next dev --webpack -p 3500"`), not the Next.js default 3000.

Run the full test suite anytime with:

```bash
npm test
```

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/050_marketing_campaigns.sql`

- [ ] **Step 1: Write the migration**

```sql
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

-- Add the new 'marketing' permission key to existing admin roles, defaulting super_admin/admin to
-- 'total' and everyone else to 'sin_acceso'. Matches the AdminModule permission model already in use.
update public.admin_roles
set permissions = permissions || jsonb_build_object('marketing',
  case when name in ('super_admin', 'admin') then 'total' else 'sin_acceso' end)
where not (permissions ? 'marketing');
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: output ends with `Applying migration 050_marketing_campaigns.sql...` and no errors. If `supabase db push` prompts about drift from untracked remote changes (this project has some, per the design spec's note that muqui's own campaign tables were never tracked in migrations — that's muqui, not nurei, so this should apply cleanly), review the diff it shows before confirming.

- [ ] **Step 3: Verify the tables exist**

```bash
SUPA_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d'=' -f2)
SUPA_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d'=' -f2)
curl -s "$SUPA_URL/rest/v1/marketing_campaigns?select=id&limit=1" -H "apikey: $SUPA_KEY" -H "Authorization: Bearer $SUPA_KEY"
```

Expected: `[]` (empty array, not an error object).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/050_marketing_campaigns.sql
git commit -m "feat(marketing): add campaigns and recipients tables"
```

---

### Task 2: Shared types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add `'marketing'` to `AdminModule`**

Find this block (currently around line 41-44):

```ts
export type AdminModule =
  | 'dashboard' | 'pedidos' | 'productos' | 'categorias'
  | 'inventario' | 'cupones' | 'multimedia' | 'clientes'
  | 'usuarios' | 'roles' | 'configuracion' | 'analytics' | 'pagos' | 'afiliados'
```

Replace with:

```ts
export type AdminModule =
  | 'dashboard' | 'pedidos' | 'productos' | 'categorias'
  | 'inventario' | 'cupones' | 'multimedia' | 'clientes'
  | 'usuarios' | 'roles' | 'configuracion' | 'analytics' | 'pagos' | 'afiliados' | 'marketing'
```

- [ ] **Step 2: Add campaign types**

Append at the end of `types/index.ts`:

```ts
// ─── MARKETING CAMPAIGNS ────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'failed'
export type CampaignTemplateKey = 'bienvenida' | 'winback' | 'promo' | 'blank'
export type CtaLinkType = 'product' | 'category' | 'url'

export interface CampaignCtaLink {
  type: CtaLinkType
  value: string // product slug, category slug, or a raw http(s) URL
}

export interface CampaignContent {
  heading: string
  body: string
  imageUrl: string | null
  ctaLabel: string
  ctaLink: CampaignCtaLink | null
  couponCode: string | null
}

export interface MarketingCampaign {
  id: string
  name: string
  subject: string
  preheader: string | null
  status: CampaignStatus
  template_key: CampaignTemplateKey | null
  content: CampaignContent
  audience_segments: string[]
  audience_tags: string[]
  coupon_code: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  sent_at: string | null
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  customer_id: string | null
  email: string
  name: string | null
  status: 'queued' | 'sent' | 'failed'
  error_message: string | null
  sent_at: string | null
  opened_at: string | null
  open_count: number
}

export interface CampaignMetrics {
  recipients: number
  sent: number
  failed: number
  opened: number
  openRate: number // 0-100
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "types/index.ts"
```

Expected: no output (no errors reference this file).

- [ ] **Step 4: Commit**

```bash
git add types/index.ts
git commit -m "feat(marketing): add campaign types and marketing AdminModule key"
```

---

### Task 3: Template starter configs

**Files:**
- Create: `lib/marketing/templates.ts`
- Test: `__tests__/marketing/templates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/marketing/templates.test.ts
import { describe, it, expect } from 'vitest'
import { CAMPAIGN_TEMPLATES, getTemplate } from '../../lib/marketing/templates'

describe('getTemplate', () => {
  it('returns the bienvenida template with a heading and CTA', () => {
    const tpl = getTemplate('bienvenida')
    expect(tpl.templateKey).toBe('bienvenida')
    expect(tpl.name).toBe('Bienvenida')
    expect(tpl.subject.length).toBeGreaterThan(0)
    expect(tpl.content.heading.length).toBeGreaterThan(0)
    expect(tpl.content.ctaLabel.length).toBeGreaterThan(0)
  })

  it('returns the winback template', () => {
    const tpl = getTemplate('winback')
    expect(tpl.templateKey).toBe('winback')
  })

  it('returns the promo template with a couponCode placeholder of null', () => {
    const tpl = getTemplate('promo')
    expect(tpl.templateKey).toBe('promo')
    expect(tpl.content.couponCode).toBeNull()
  })

  it('returns a blank template with empty content', () => {
    const tpl = getTemplate('blank')
    expect(tpl.templateKey).toBe('blank')
    expect(tpl.content.heading).toBe('')
    expect(tpl.content.body).toBe('')
  })

  it('exposes exactly 4 templates in CAMPAIGN_TEMPLATES, in gallery order', () => {
    expect(CAMPAIGN_TEMPLATES.map((t) => t.templateKey)).toEqual([
      'bienvenida', 'winback', 'promo', 'blank',
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/marketing/templates.test.ts
```

Expected: FAIL — `Cannot find module '../../lib/marketing/templates'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/marketing/templates.ts
import type { CampaignContent, CampaignTemplateKey } from '@/types'

export interface CampaignTemplate {
  templateKey: CampaignTemplateKey
  name: string
  description: string
  subject: string
  preheader: string
  content: CampaignContent
}

const EMPTY_CONTENT: CampaignContent = {
  heading: '',
  body: '',
  imageUrl: null,
  ctaLabel: '',
  ctaLink: null,
  couponCode: null,
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    templateKey: 'bienvenida',
    name: 'Bienvenida',
    description: 'Para clientes nuevos — su primera compra.',
    subject: '¡Bienvenido a nurei! 🎉',
    preheader: 'Un regalito para tu primer pedido',
    content: {
      heading: '¡Qué gusto tenerte aquí!',
      body: 'Gracias por unirte a nurei. Explora nuestros snacks asiáticos favoritos y arma tu primer pedido — te va a encantar.',
      imageUrl: null,
      ctaLabel: 'Ver catálogo',
      ctaLink: { type: 'url', value: '/menu' },
      couponCode: null,
    },
  },
  {
    templateKey: 'winback',
    name: 'Te extrañamos',
    description: 'Para clientes que no compran hace tiempo.',
    subject: 'Te extrañamos por acá 🥺',
    preheader: 'Vuelve por tus snacks favoritos',
    content: {
      heading: 'Hace tiempo no te vemos',
      body: 'Han llegado sabores nuevos desde tu última visita. Dale un vistazo, seguro encuentras algo que te encante.',
      imageUrl: null,
      ctaLabel: 'Volver a la tienda',
      ctaLink: { type: 'url', value: '/menu' },
      couponCode: null,
    },
  },
  {
    templateKey: 'promo',
    name: 'Promo + cupón',
    description: 'Descuento o promoción de temporada.',
    subject: 'Oferta especial solo por tiempo limitado',
    preheader: 'No te lo pierdas',
    content: {
      heading: 'Una promo pensada para ti',
      body: 'Usa tu cupón en tu próxima compra antes de que se acabe.',
      imageUrl: null,
      ctaLabel: 'Comprar ahora',
      ctaLink: { type: 'url', value: '/menu' },
      couponCode: null,
    },
  },
  {
    templateKey: 'blank',
    name: 'En blanco',
    description: 'Empieza desde cero.',
    subject: '',
    preheader: '',
    content: { ...EMPTY_CONTENT },
  },
]

export function getTemplate(key: CampaignTemplateKey): CampaignTemplate {
  const found = CAMPAIGN_TEMPLATES.find((t) => t.templateKey === key)
  if (!found) throw new Error(`Unknown campaign template: ${key}`)
  return found
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/marketing/templates.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/marketing/templates.ts __tests__/marketing/templates.test.ts
git commit -m "feat(marketing): add campaign starter templates"
```

---

### Task 4: Campaign validation

**Files:**
- Create: `lib/marketing/validate-campaign.ts`
- Test: `__tests__/marketing/validate-campaign.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/marketing/validate-campaign.test.ts
import { describe, it, expect } from 'vitest'
import { validateCampaignDraft } from '../../lib/marketing/validate-campaign'
import type { CampaignContent } from '../../types'

const baseContent: CampaignContent = {
  heading: 'Hola',
  body: 'Cuerpo del mensaje',
  imageUrl: null,
  ctaLabel: 'Ir',
  ctaLink: { type: 'url', value: '/menu' },
  couponCode: null,
}

describe('validateCampaignDraft', () => {
  it('passes for a complete draft', () => {
    const result = validateCampaignDraft({
      name: 'Campaña de prueba',
      subject: 'Asunto',
      content: baseContent,
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('requires a name', () => {
    const result = validateCampaignDraft({ name: '', subject: 'Asunto', content: baseContent })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('El nombre de la campaña es requerido.')
  })

  it('requires a subject', () => {
    const result = validateCampaignDraft({ name: 'X', subject: '  ', content: baseContent })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('El asunto es requerido.')
  })

  it('requires heading or body to be non-empty', () => {
    const result = validateCampaignDraft({
      name: 'X', subject: 'Asunto',
      content: { ...baseContent, heading: '', body: '' },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Agrega un título o un texto al contenido.')
  })

  it('rejects a URL cta link that is not http(s)', () => {
    const result = validateCampaignDraft({
      name: 'X', subject: 'Asunto',
      content: { ...baseContent, ctaLink: { type: 'url', value: 'javascript:alert(1)' } },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('El enlace del botón debe ser una URL http(s) válida.')
  })

  it('accepts a product cta link without URL validation', () => {
    const result = validateCampaignDraft({
      name: 'X', subject: 'Asunto',
      content: { ...baseContent, ctaLink: { type: 'product', value: 'ramen-picante' } },
    })
    expect(result.valid).toBe(true)
  })

  it('collects multiple errors at once', () => {
    const result = validateCampaignDraft({ name: '', subject: '', content: { ...baseContent, heading: '', body: '' } })
    expect(result.errors.length).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/marketing/validate-campaign.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/marketing/validate-campaign.ts
import type { CampaignContent } from '@/types'

export interface CampaignDraftInput {
  name: string
  subject: string
  content: CampaignContent
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value, value.startsWith('/') ? 'https://placeholder.local' : undefined)
    return url.protocol === 'http:' || url.protocol === 'https:' || value.startsWith('/')
  } catch {
    return false
  }
}

export function validateCampaignDraft(input: CampaignDraftInput): ValidationResult {
  const errors: string[] = []

  if (!input.name.trim()) errors.push('El nombre de la campaña es requerido.')
  if (!input.subject.trim()) errors.push('El asunto es requerido.')
  if (!input.content.heading.trim() && !input.content.body.trim()) {
    errors.push('Agrega un título o un texto al contenido.')
  }

  const cta = input.content.ctaLink
  if (cta && cta.type === 'url' && !isValidHttpUrl(cta.value)) {
    errors.push('El enlace del botón debe ser una URL http(s) válida.')
  }

  return { valid: errors.length === 0, errors }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/marketing/validate-campaign.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/marketing/validate-campaign.ts __tests__/marketing/validate-campaign.test.ts
git commit -m "feat(marketing): add campaign draft validation"
```

---

### Task 5: Audience filter builder

**Files:**
- Create: `lib/marketing/audience-filter.ts`
- Test: `__tests__/marketing/audience-filter.test.ts`

This is a pure function that turns `{ segments, tags }` into the exact filter shape the Supabase query layer needs — kept separate from the DB call so it's unit-testable without a live database.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/marketing/audience-filter.test.ts
import { describe, it, expect } from 'vitest'
import { buildAudienceFilter } from '../../lib/marketing/audience-filter'

describe('buildAudienceFilter', () => {
  it('always includes the hard compliance guard', () => {
    const filter = buildAudienceFilter({ segments: [], tags: [] })
    expect(filter.acceptsEmailMarketing).toBe(true)
    expect(filter.isActive).toBe(true)
    expect(filter.excludeSegments).toContain('blacklist')
  })

  it('passes through requested segments unchanged', () => {
    const filter = buildAudienceFilter({ segments: ['vip', 'regular'], tags: [] })
    expect(filter.segments).toEqual(['vip', 'regular'])
  })

  it('drops blacklist even if explicitly requested', () => {
    const filter = buildAudienceFilter({ segments: ['vip', 'blacklist'], tags: [] })
    expect(filter.segments).toEqual(['vip'])
  })

  it('passes through tags unchanged', () => {
    const filter = buildAudienceFilter({ segments: [], tags: ['newsletter', 'vip-club'] })
    expect(filter.tags).toEqual(['newsletter', 'vip-club'])
  })

  it('deduplicates segments and tags', () => {
    const filter = buildAudienceFilter({ segments: ['vip', 'vip'], tags: ['a', 'a'] })
    expect(filter.segments).toEqual(['vip'])
    expect(filter.tags).toEqual(['a'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/marketing/audience-filter.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/marketing/audience-filter.ts

export interface AudienceFilterInput {
  segments: string[]
  tags: string[]
}

export interface AudienceFilter {
  segments: string[]
  tags: string[]
  excludeSegments: string[]
  acceptsEmailMarketing: true
  isActive: true
}

export function buildAudienceFilter(input: AudienceFilterInput): AudienceFilter {
  const segments = [...new Set(input.segments)].filter((s) => s !== 'blacklist')
  const tags = [...new Set(input.tags)]

  return {
    segments,
    tags,
    excludeSegments: ['blacklist'],
    acceptsEmailMarketing: true,
    isActive: true,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/marketing/audience-filter.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/marketing/audience-filter.ts __tests__/marketing/audience-filter.test.ts
git commit -m "feat(marketing): add audience filter builder"
```

---

### Task 6: Export shared email brand constants

**Files:**
- Modify: `lib/email/templates/order-emails-html.ts:25-30`

The campaign email renderer (Task 7) needs the same brand colors used in transactional emails. They currently exist but aren't exported.

- [ ] **Step 1: Export the constants**

Find (around line 25):

```ts
const BRAND_BG = '#FFFBEB'
const BRAND_AMBER = '#FFC107'
const TEXT_DARK = '#111827'
const TEXT_MUTED = '#6B7280'
const GREEN = '#10B981'
const CARD_BORDER = '#E5E7EB'
```

Replace with:

```ts
export const BRAND_BG = '#FFFBEB'
export const BRAND_AMBER = '#FFC107'
export const TEXT_DARK = '#111827'
export const TEXT_MUTED = '#6B7280'
export const GREEN = '#10B981'
export const CARD_BORDER = '#E5E7EB'
```

- [ ] **Step 2: Verify existing order-email tests/build still pass**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "order-emails-html"
npm test
```

Expected: no tsc output for that file; full `npm test` suite still passes (this is a pure additive `export` change, nothing consumes the old un-exported form differently).

- [ ] **Step 3: Commit**

```bash
git add lib/email/templates/order-emails-html.ts
git commit -m "refactor(email): export brand color constants for reuse in campaign emails"
```

---

### Task 7: Campaign email HTML renderer

**Files:**
- Create: `lib/email/templates/campaign-email-html.ts`
- Test: `__tests__/marketing/campaign-email-html.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/marketing/campaign-email-html.test.ts
import { describe, it, expect } from 'vitest'
import { renderCampaignEmailHtml } from '../../lib/email/templates/campaign-email-html'
import type { CampaignContent } from '../../types'

const content: CampaignContent = {
  heading: 'Hola <script>alert(1)</script>',
  body: 'Línea uno\nLínea dos',
  imageUrl: 'https://example.com/img.jpg',
  ctaLabel: 'Comprar',
  ctaLink: { type: 'url', value: 'https://nurei.mx/menu' },
  couponCode: 'PROMO20',
}

describe('renderCampaignEmailHtml', () => {
  it('escapes HTML in the heading', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('renders each body line as its own paragraph', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).toContain('Línea uno')
    expect(html).toContain('Línea dos')
  })

  it('includes the resolved CTA url and label', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).toContain('href="https://nurei.mx/menu"')
    expect(html).toContain('Comprar')
  })

  it('includes the image when present', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).toContain('https://example.com/img.jpg')
  })

  it('omits the image tag when imageUrl is null', () => {
    const html = renderCampaignEmailHtml({ content: { ...content, imageUrl: null }, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).not.toContain('<img')
  })

  it('shows the coupon code when present', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).toContain('PROMO20')
  })

  it('omits the coupon block when couponCode is null', () => {
    const html = renderCampaignEmailHtml({ content: { ...content, couponCode: null }, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).not.toContain('couponCode')
  })

  it('uses the shared brand amber color', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).toContain('#FFC107')
  })

  it('includes a hidden preheader when provided', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu', preheader: 'Vista previa del correo' })
    expect(html).toContain('Vista previa del correo')
    expect(html).toContain('display:none')
  })

  it('omits the preheader block when not provided', () => {
    const html = renderCampaignEmailHtml({ content, resolvedCtaUrl: 'https://nurei.mx/menu' })
    expect(html).not.toContain('display:none')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/marketing/campaign-email-html.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/email/templates/campaign-email-html.ts
import { escapeHtml } from '@/lib/email/escape-html'
import { BRAND_BG, BRAND_AMBER, TEXT_DARK, TEXT_MUTED, CARD_BORDER } from '@/lib/email/templates/order-emails-html'
import type { CampaignContent } from '@/types'

export interface CampaignEmailProps {
  content: CampaignContent
  /** The CTA link already resolved to an absolute URL (product/category slugs resolved upstream). */
  resolvedCtaUrl: string
  /** Absolute URL for the 1x1 open-tracking pixel; omitted (no img) when not provided, e.g. in previews. */
  trackingPixelUrl?: string
  /** Inbox preview text — rendered visually hidden right after <body>. Omitted when not provided. */
  preheader?: string
}

export function renderCampaignEmailHtml(p: CampaignEmailProps): string {
  const bodyParagraphs = p.content.body
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(
      (line) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${TEXT_DARK};">${escapeHtml(line)}</p>`
    )
    .join('')

  const imageBlock = p.content.imageUrl
    ? `<img src="${escapeHtml(p.content.imageUrl)}" alt="" style="width:100%;max-width:480px;border-radius:12px;display:block;margin:0 auto 16px;" />`
    : ''

  const couponBlock = p.content.couponCode
    ? `<div style="margin:16px 0;padding:12px 16px;border:2px dashed ${BRAND_AMBER};border-radius:10px;text-align:center;font-weight:bold;font-size:16px;color:${TEXT_DARK};letter-spacing:1px;">${escapeHtml(p.content.couponCode)}</div>`
    : ''

  const trackingPixel = p.trackingPixelUrl
    ? `<img src="${escapeHtml(p.trackingPixelUrl)}" width="1" height="1" alt="" style="display:none;" />`
    : ''

  const preheaderBlock = p.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(p.preheader)}</div>`
    : ''

  return `
<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:Arial,Helvetica,sans-serif;">
  ${preheaderBlock}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_BG};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;border:1px solid ${CARD_BORDER};overflow:hidden;">
          <tr>
            <td style="background:${BRAND_AMBER};padding:20px;text-align:center;">
              <span style="font-size:22px;font-weight:900;color:${TEXT_DARK};letter-spacing:-0.5px;">nurei</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <h1 style="margin:0 0 16px;font-size:22px;color:${TEXT_DARK};">${escapeHtml(p.content.heading)}</h1>
              ${imageBlock}
              ${bodyParagraphs}
              ${couponBlock}
              <div style="text-align:center;margin-top:20px;">
                <a href="${escapeHtml(p.resolvedCtaUrl)}" style="display:inline-block;background:${TEXT_DARK};color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:24px;font-weight:600;font-size:14px;">${escapeHtml(p.content.ctaLabel)}</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;text-align:center;border-top:1px solid ${CARD_BORDER};">
              <p style="margin:0;font-size:11px;color:${TEXT_MUTED};">nurei.mx</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${trackingPixel}
</body>
</html>`
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/marketing/campaign-email-html.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/email/templates/campaign-email-html.ts __tests__/marketing/campaign-email-html.test.ts
git commit -m "feat(marketing): add campaign email HTML renderer"
```

---

### Task 8: Marketing queries (CRUD + audience count + coupon list)

**Files:**
- Create: `lib/supabase/queries/marketing.ts`

No test file for this task — it's a thin Supabase-client wrapper (matching `lib/supabase/queries/adminOrders.ts`'s convention, which also has no dedicated unit tests since it requires a live DB connection). Verified manually via `curl` against the API routes built on top of it in Tasks 9-11.

- [ ] **Step 1: Write the queries**

```ts
// lib/supabase/queries/marketing.ts
import { SupabaseClient } from '@supabase/supabase-js'
import type { MarketingCampaign, CampaignStatus } from '@/types'
import type { AudienceFilter } from '@/lib/marketing/audience-filter'

export interface ListCampaignsOptions {
  status?: CampaignStatus
}

export async function listCampaigns(
  supabase: SupabaseClient,
  opts: ListCampaignsOptions = {}
): Promise<MarketingCampaign[]> {
  let query = supabase
    .from('marketing_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (opts.status) query = query.eq('status', opts.status)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as MarketingCampaign[]
}

export async function getCampaign(supabase: SupabaseClient, id: string): Promise<MarketingCampaign | null> {
  const { data, error } = await supabase.from('marketing_campaigns').select('*').eq('id', id).single()
  if (error) return null
  return data as MarketingCampaign
}

export interface CreateCampaignInput {
  name: string
  subject: string
  preheader: string | null
  template_key: MarketingCampaign['template_key']
  content: MarketingCampaign['content']
  audience_segments: string[]
  audience_tags: string[]
  coupon_code: string | null
  created_by: string
}

export async function createCampaign(supabase: SupabaseClient, input: CreateCampaignInput): Promise<MarketingCampaign> {
  const { data, error } = await supabase.from('marketing_campaigns').insert(input).select('*').single()
  if (error) throw new Error(error.message)
  return data as MarketingCampaign
}

export type UpdateCampaignInput = Partial<Omit<CreateCampaignInput, 'created_by'>>

/** Only draft campaigns may be updated or deleted — enforced here, mirrors the coupons/orders draft-only rule. */
export async function updateCampaign(
  supabase: SupabaseClient,
  id: string,
  input: UpdateCampaignInput
): Promise<MarketingCampaign> {
  const { data: existing, error: fetchError } = await supabase
    .from('marketing_campaigns')
    .select('status')
    .eq('id', id)
    .single()
  if (fetchError || !existing) throw new Error('Campaña no encontrada')
  if (existing.status !== 'draft') throw new Error('Solo se pueden editar campañas en borrador')

  const { data, error } = await supabase
    .from('marketing_campaigns')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as MarketingCampaign
}

export async function deleteCampaign(supabase: SupabaseClient, id: string): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('marketing_campaigns')
    .select('status')
    .eq('id', id)
    .single()
  if (fetchError || !existing) throw new Error('Campaña no encontrada')
  if (existing.status !== 'draft') throw new Error('Solo se pueden eliminar campañas en borrador')

  const { error } = await supabase.from('marketing_campaigns').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export interface AudienceCustomer {
  id: string
  email: string
  full_name: string | null
}

/** Resolves the actual list of customers matching a filter — used both for send and for the count preview. */
export async function resolveAudience(supabase: SupabaseClient, filter: AudienceFilter): Promise<AudienceCustomer[]> {
  let query = supabase
    .from('customers')
    .select('id, email, full_name')
    .eq('accepts_email_marketing', filter.acceptsEmailMarketing)
    .eq('is_active', filter.isActive)
    .not('segment', 'in', `(${filter.excludeSegments.join(',')})`)
    .not('email', 'is', null)

  if (filter.segments.length > 0) query = query.in('segment', filter.segments)
  if (filter.tags.length > 0) query = query.overlaps('tags', filter.tags)

  const { data, error } = await query.limit(5000)
  if (error) throw new Error(error.message)
  return (data ?? []) as AudienceCustomer[]
}

export interface ActiveCoupon {
  code: string
  discount_type: string
  value: number
  description: string | null
}

export async function listActiveCoupons(supabase: SupabaseClient): Promise<ActiveCoupon[]> {
  const { data, error } = await supabase
    .from('coupons')
    .select('code, discount_type, value, description')
    .eq('is_active', true)
    .eq('is_paused', false)
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []) as ActiveCoupon[]
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "queries/marketing.ts"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/queries/marketing.ts
git commit -m "feat(marketing): add campaign CRUD, audience, and coupon queries"
```

---

### Task 9: API routes — campaigns list/create, detail/update/delete

**Files:**
- Create: `app/api/admin/marketing/campaigns/route.ts`
- Create: `app/api/admin/marketing/campaigns/[id]/route.ts`

- [ ] **Step 1: Write the list/create route**

```ts
// app/api/admin/marketing/campaigns/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { listCampaigns, createCampaign } from '@/lib/supabase/queries/marketing'
import { validateCampaignDraft } from '@/lib/marketing/validate-campaign'
import type { CampaignStatus } from '@/types'

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as CampaignStatus | null
    const campaigns = await listCampaigns(supabase, { status: status ?? undefined })
    return NextResponse.json({ data: campaigns })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al listar campañas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const body = await request.json()
    const content = body.content ?? {
      heading: '', body: '', imageUrl: null, ctaLabel: '', ctaLink: null, couponCode: null,
    }

    const validation = validateCampaignDraft({
      name: String(body.name ?? ''),
      subject: String(body.subject ?? ''),
      content,
    })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join(' ') }, { status: 400 })
    }

    const supabase = createServiceClient()
    const campaign = await createCampaign(supabase, {
      name: body.name,
      subject: body.subject,
      preheader: body.preheader ?? null,
      template_key: body.template_key ?? null,
      content,
      audience_segments: body.audience_segments ?? [],
      audience_tags: body.audience_tags ?? [],
      coupon_code: body.coupon_code ?? null,
      created_by: guard.userId,
    })
    return NextResponse.json({ data: campaign }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear campaña'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Write the detail/update/delete route**

```ts
// app/api/admin/marketing/campaigns/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { getCampaign, updateCampaign, deleteCampaign } from '@/lib/supabase/queries/marketing'
import { validateCampaignDraft } from '@/lib/marketing/validate-campaign'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { id } = await params
  const supabase = createServiceClient()
  const campaign = await getCampaign(supabase, id)
  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  return NextResponse.json({ data: campaign })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { id } = await params
  try {
    const body = await request.json()

    if (body.name !== undefined || body.subject !== undefined || body.content !== undefined) {
      const supabase = createServiceClient()
      const current = await getCampaign(supabase, id)
      if (!current) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

      const validation = validateCampaignDraft({
        name: body.name ?? current.name,
        subject: body.subject ?? current.subject,
        content: body.content ?? current.content,
      })
      if (!validation.valid) {
        return NextResponse.json({ error: validation.errors.join(' ') }, { status: 400 })
      }
    }

    const supabase = createServiceClient()
    const campaign = await updateCampaign(supabase, id, body)
    return NextResponse.json({ data: campaign })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al actualizar campaña'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { id } = await params
  try {
    const supabase = createServiceClient()
    await deleteCampaign(supabase, id)
    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al eliminar campaña'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "marketing/campaigns"
```

Expected: no output.

- [ ] **Step 4: Manual verification against the dev server**

```bash
npm run dev > /tmp/nurei-dev.log 2>&1 &
disown
sleep 6
curl -s http://localhost:3500/api/admin/marketing/campaigns -w "\nHTTP %{http_code}\n"
```

Expected: `{"error":"No autenticado"}` with `HTTP 401` (route exists and is properly auth-gated — full authenticated verification happens in Task 18 once the UI can log in and drive it).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/marketing/campaigns/route.ts "app/api/admin/marketing/campaigns/[id]/route.ts"
git commit -m "feat(marketing): add campaign list/create/detail/update/delete API routes"
```

---

### Task 10: API routes — audience preview and send

**Files:**
- Create: `app/api/admin/marketing/audience-preview/route.ts`
- Create: `app/api/admin/marketing/campaigns/[id]/send/route.ts`

- [ ] **Step 1: Write the audience-preview route**

```ts
// app/api/admin/marketing/audience-preview/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { buildAudienceFilter } from '@/lib/marketing/audience-filter'
import { resolveAudience } from '@/lib/supabase/queries/marketing'

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const body = await request.json()
    const filter = buildAudienceFilter({
      segments: body.segments ?? [],
      tags: body.tags ?? [],
    })
    const supabase = createServiceClient()
    const audience = await resolveAudience(supabase, filter)
    return NextResponse.json({ data: { count: audience.length } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al calcular audiencia'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Write the resolve-CTA-link helper (used by send)**

```ts
// lib/marketing/resolve-cta-link.ts
import { SupabaseClient } from '@supabase/supabase-js'
import type { CampaignCtaLink } from '@/types'

/** Turns a product/category/url CTA link into an absolute nurei.mx URL for the sent email. */
export async function resolveCtaUrl(
  supabase: SupabaseClient,
  link: CampaignCtaLink | null,
  appUrl: string
): Promise<string> {
  if (!link) return appUrl

  if (link.type === 'url') {
    return link.value.startsWith('http') ? link.value : `${appUrl}${link.value}`
  }

  if (link.type === 'product') {
    const { data } = await supabase.from('products').select('slug').eq('slug', link.value).single()
    return data ? `${appUrl}/producto/${data.slug}` : appUrl
  }

  // category
  const { data } = await supabase.from('categories').select('slug').eq('slug', link.value).single()
  return data ? `${appUrl}/menu?categoria=${data.slug}` : `${appUrl}/menu`
}
```

- [ ] **Step 3: Write the send route**

```ts
// app/api/admin/marketing/campaigns/[id]/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { getCampaign } from '@/lib/supabase/queries/marketing'
import { buildAudienceFilter } from '@/lib/marketing/audience-filter'
import { resolveAudience } from '@/lib/supabase/queries/marketing'
import { resolveCtaUrl } from '@/lib/marketing/resolve-cta-link'
import { renderCampaignEmailHtml } from '@/lib/email/templates/campaign-email-html'

const BATCH_SIZE = 5

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { id } = await params

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY no configurado' }, { status: 503 })

  const supabase = createServiceClient()
  const campaign = await getCampaign(supabase, id)
  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  if (campaign.status !== 'draft') {
    return NextResponse.json({ error: 'Esta campaña ya fue enviada o está en proceso' }, { status: 400 })
  }

  const filter = buildAudienceFilter({ segments: campaign.audience_segments, tags: campaign.audience_tags })
  const audience = await resolveAudience(supabase, filter)
  if (audience.length === 0) {
    return NextResponse.json({ error: 'No hay destinatarios para esta audiencia' }, { status: 400 })
  }

  await supabase.from('marketing_campaigns').update({ status: 'sending' }).eq('id', id)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3500'
  const resolvedCtaUrl = await resolveCtaUrl(supabase, campaign.content.ctaLink, appUrl)

  const { data: recipientRows, error: insertError } = await supabase
    .from('marketing_campaign_recipients')
    .insert(audience.map((c) => ({
      campaign_id: id, customer_id: c.id, email: c.email, name: c.full_name, status: 'queued',
    })))
    .select('id, email, customer_id')

  if (insertError || !recipientRows) {
    await supabase.from('marketing_campaigns').update({ status: 'failed' }).eq('id', id)
    return NextResponse.json({ error: insertError?.message ?? 'Error al preparar destinatarios' }, { status: 500 })
  }

  const resend = new Resend(apiKey)
  const from = process.env.EMAIL_FROM ?? 'nurei <onboarding@resend.dev>'
  let sentCount = 0
  let failedCount = 0

  for (let i = 0; i < recipientRows.length; i += BATCH_SIZE) {
    const batch = recipientRows.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map((recipient) => {
        const trackingPixelUrl = `${appUrl}/api/marketing/track/open/${recipient.id}`
        const html = renderCampaignEmailHtml({
          content: campaign.content, resolvedCtaUrl, trackingPixelUrl,
          preheader: campaign.preheader ?? undefined,
        })
        return resend.emails.send({ from, to: [recipient.email], subject: campaign.subject, html })
      })
    )

    for (let j = 0; j < results.length; j++) {
      const recipient = batch[j]
      const result = results[j]
      if (result.status === 'fulfilled' && !result.value.error) {
        sentCount++
        await supabase.from('marketing_campaign_recipients')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', recipient.id)
      } else {
        failedCount++
        const errorMessage = result.status === 'rejected'
          ? String(result.reason)
          : (result.value.error?.message ?? 'Error desconocido')
        await supabase.from('marketing_campaign_recipients')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', recipient.id)
      }
    }
  }

  const finalStatus = sentCount === 0 ? 'failed' : 'sent'
  await supabase.from('marketing_campaigns')
    .update({ status: finalStatus, sent_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ data: { status: finalStatus, sent: sentCount, failed: failedCount } })
}
```

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "audience-preview|campaigns/\[id\]/send|resolve-cta-link"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/marketing/audience-preview/route.ts "app/api/admin/marketing/campaigns/[id]/send/route.ts" lib/marketing/resolve-cta-link.ts
git commit -m "feat(marketing): add audience preview and campaign send routes"
```

---

### Task 11: Open-tracking pixel

**Files:**
- Create: `app/api/marketing/track/open/[recipientId]/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/marketing/track/open/[recipientId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// 1x1 transparent GIF, base64-encoded.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7', 'base64')

export async function GET(request: NextRequest, { params }: { params: Promise<{ recipientId: string }> }) {
  const { recipientId } = await params
  try {
    const supabase = createServiceClient()
    const { data: recipient } = await supabase
      .from('marketing_campaign_recipients')
      .select('open_count, opened_at')
      .eq('id', recipientId)
      .single()

    if (recipient) {
      await supabase
        .from('marketing_campaign_recipients')
        .update({
          open_count: (recipient.open_count ?? 0) + 1,
          opened_at: recipient.opened_at ?? new Date().toISOString(),
        })
        .eq('id', recipientId)
    }
  } catch {
    // Never fail the pixel response — tracking is best-effort.
  }

  return new NextResponse(PIXEL, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
  })
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "track/open"
```

Expected: no output.

- [ ] **Step 3: Manual verification**

```bash
curl -s -o /dev/null -w "HTTP %{http_code} | Content-Type: %{content_type}\n" \
  "http://localhost:3500/api/marketing/track/open/00000000-0000-0000-0000-000000000000"
```

Expected: `HTTP 200 | Content-Type: image/gif` (the route always returns the pixel even for an unknown recipient id — verified in Step 1's `try/catch`).

- [ ] **Step 4: Commit**

```bash
git add "app/api/marketing/track/open/[recipientId]/route.ts"
git commit -m "feat(marketing): add open-tracking pixel endpoint"
```

---

### Task 12: `CampaignPreview` component

**Files:**
- Create: `components/admin/marketing/CampaignPreview.tsx`

This is the React approximation of `renderCampaignEmailHtml` — used both full-size in the editor and scaled down inside template gallery cards (Task 13). It's a visual component, not pure logic, so it gets a manual browser-verification step in Task 18 rather than a unit test — matching how the rest of the admin panel's React components are verified in this codebase (no component-testing infra exists here, per the design spec's research).

- [ ] **Step 1: Write the component**

```tsx
// components/admin/marketing/CampaignPreview.tsx
'use client'

import type { CampaignContent } from '@/types'

interface CampaignPreviewProps {
  content: CampaignContent
  scale?: 'full' | 'mini'
}

export function CampaignPreview({ content, scale = 'full' }: CampaignPreviewProps) {
  const isMini = scale === 'mini'

  return (
    <div
      className="bg-[#FFFBEB] rounded-2xl overflow-hidden"
      style={isMini ? { fontSize: '6px', padding: '8px' } : { padding: '24px' }}
    >
      <div
        className="bg-[#FFC107] rounded-lg flex items-center justify-center font-black text-[#111827]"
        style={{ height: isMini ? 20 : 48, fontSize: isMini ? 8 : 18 }}
      >
        nurei
      </div>

      <div className={isMini ? 'mt-2 space-y-1' : 'mt-5 space-y-3'}>
        <h3
          className="font-bold text-[#111827] break-words"
          style={{ fontSize: isMini ? 8 : 20 }}
        >
          {content.heading || 'Título de la campaña'}
        </h3>

        {content.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.imageUrl}
            alt=""
            className="w-full rounded-lg object-cover"
            style={{ height: isMini ? 24 : 180 }}
          />
        )}

        <p
          className="text-gray-700 whitespace-pre-line break-words"
          style={{ fontSize: isMini ? 6 : 14 }}
        >
          {content.body || 'El texto de tu campaña aparece aquí.'}
        </p>

        {content.couponCode && (
          <div
            className="border-2 border-dashed border-[#FFC107] rounded-lg text-center font-bold text-[#111827]"
            style={{ padding: isMini ? '2px' : '10px', fontSize: isMini ? 6 : 14 }}
          >
            {content.couponCode}
          </div>
        )}

        {content.ctaLabel && (
          <div className="flex justify-center" style={{ marginTop: isMini ? 4 : 16 }}>
            <div
              className="bg-[#111827] text-white rounded-full font-semibold"
              style={{ padding: isMini ? '2px 8px' : '10px 24px', fontSize: isMini ? 6 : 13 }}
            >
              {content.ctaLabel}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "CampaignPreview"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/admin/marketing/CampaignPreview.tsx
git commit -m "feat(marketing): add campaign live preview component"
```

---

### Task 13: `TemplateGallery` component

**Files:**
- Create: `components/admin/marketing/TemplateGallery.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/admin/marketing/TemplateGallery.tsx
'use client'

import { Plus } from 'lucide-react'
import { CAMPAIGN_TEMPLATES } from '@/lib/marketing/templates'
import { CampaignPreview } from '@/components/admin/marketing/CampaignPreview'
import type { CampaignTemplateKey } from '@/types'

interface TemplateGalleryProps {
  onSelect: (key: CampaignTemplateKey) => void
}

export function TemplateGallery({ onSelect }: TemplateGalleryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {CAMPAIGN_TEMPLATES.filter((t) => t.templateKey !== 'blank').map((template) => (
        <button
          key={template.templateKey}
          type="button"
          onClick={() => onSelect(template.templateKey)}
          className="text-left rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden hover:border-primary-cyan hover:shadow-md transition"
        >
          <div className="h-28 overflow-hidden">
            <CampaignPreview content={template.content} scale="mini" />
          </div>
          <div className="p-3">
            <p className="text-sm font-semibold text-gray-900">{template.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{template.description}</p>
          </div>
        </button>
      ))}

      <button
        type="button"
        onClick={() => onSelect('blank')}
        className="rounded-2xl border-2 border-dashed border-gray-200 bg-white flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary-cyan hover:text-primary-dark transition min-h-[160px]"
      >
        <Plus className="w-6 h-6" />
        <span className="text-sm font-medium">En blanco</span>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "TemplateGallery"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/admin/marketing/TemplateGallery.tsx
git commit -m "feat(marketing): add template gallery with live mini-previews"
```

---

### Task 14: `CtaLinkPicker` and `CampaignFieldsPanel` components

**Files:**
- Create: `components/admin/marketing/CtaLinkPicker.tsx`
- Create: `components/admin/marketing/CampaignFieldsPanel.tsx`

`CtaLinkPicker` generalizes the inline product-search pattern already used in `app/admin/cupones/page.tsx` (fetches `/api/products?search=`) rather than importing a shared component, since none exists in the codebase yet (confirmed during planning research).

- [ ] **Step 1: Write `CtaLinkPicker`**

```tsx
// components/admin/marketing/CtaLinkPicker.tsx
'use client'

import { useEffect, useState } from 'react'
import type { CampaignCtaLink, Category } from '@/types'

interface ProductOption {
  id: string
  name: string
  slug: string
}

interface CtaLinkPickerProps {
  value: CampaignCtaLink | null
  onChange: (link: CampaignCtaLink | null) => void
}

export function CtaLinkPicker({ value, onChange }: CtaLinkPickerProps) {
  const [type, setType] = useState<CampaignCtaLink['type']>(value?.type ?? 'url')
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<ProductOption[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    if (type !== 'product') return
    const timeout = setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((json) => setProducts((json.data?.products ?? []).slice(0, 20)))
        .catch(() => setProducts([]))
    }, 300)
    return () => clearTimeout(timeout)
  }, [type, query])

  useEffect(() => {
    if (type !== 'category') return
    fetch('/api/admin/categories')
      .then((r) => r.json())
      .then((json) => setCategories(json.data ?? []))
      .catch(() => setCategories([]))
  }, [type])

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {(['url', 'product', 'category'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setType(t); onChange(null) }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              type === t ? 'bg-primary-dark text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t === 'url' ? 'URL' : t === 'product' ? 'Producto' : 'Categoría'}
          </button>
        ))}
      </div>

      {type === 'url' && (
        <input
          type="text"
          value={value?.value ?? ''}
          onChange={(e) => onChange({ type: 'url', value: e.target.value })}
          placeholder="/menu o https://..."
          className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm"
        />
      )}

      {type === 'product' && (
        <div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm"
          />
          {products.length > 0 && (
            <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-100">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onChange({ type: 'product', value: p.slug }); setQuery(p.name) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                    value?.value === p.slug ? 'bg-amber-50 font-semibold' : ''
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {type === 'category' && (
        <select
          value={value?.value ?? ''}
          onChange={(e) => onChange(e.target.value ? { type: 'category', value: e.target.value } : null)}
          className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm"
        >
          <option value="">Selecciona una categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `CampaignFieldsPanel`**

```tsx
// components/admin/marketing/CampaignFieldsPanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { CtaLinkPicker } from '@/components/admin/marketing/CtaLinkPicker'
import type { CampaignContent, CampaignTemplateKey } from '@/types'

interface CouponOption {
  code: string
  discount_type: string
  value: number
}

interface CampaignFieldsPanelProps {
  name: string
  subject: string
  preheader: string
  content: CampaignContent
  templateKey: CampaignTemplateKey
  onNameChange: (name: string) => void
  onSubjectChange: (subject: string) => void
  onPreheaderChange: (preheader: string) => void
  onContentChange: (content: CampaignContent) => void
}

export function CampaignFieldsPanel({
  name, subject, preheader, content, templateKey,
  onNameChange, onSubjectChange, onPreheaderChange, onContentChange,
}: CampaignFieldsPanelProps) {
  const [coupons, setCoupons] = useState<CouponOption[]>([])
  const [mediaOpen, setMediaOpen] = useState(false)
  const [media, setMedia] = useState<Array<{ id: string; url: string }>>([])

  useEffect(() => {
    if (templateKey !== 'promo') return
    fetch('/api/admin/marketing/coupons')
      .then((r) => r.json())
      .then((json) => setCoupons(json.data ?? []))
      .catch(() => setCoupons([]))
  }, [templateKey])

  useEffect(() => {
    if (!mediaOpen) return
    fetch('/api/admin/media')
      .then((r) => r.json())
      .then((json) => setMedia(json.data ?? []))
      .catch(() => setMedia([]))
  }, [mediaOpen])

  const update = (patch: Partial<CampaignContent>) => onContentChange({ ...content, ...patch })

  return (
    <div className="space-y-4 text-sm">
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre (interno)</label>
        <input value={name} onChange={(e) => onNameChange(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-gray-200" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Asunto</label>
        <input value={subject} onChange={(e) => onSubjectChange(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-gray-200" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Preheader <span className="font-normal text-gray-400">(texto de vista previa en el inbox)</span></label>
        <input value={preheader} onChange={(e) => onPreheaderChange(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-gray-200" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Título</label>
        <input value={content.heading} onChange={(e) => update({ heading: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-gray-200" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Texto</label>
        <textarea value={content.body} onChange={(e) => update({ body: e.target.value })} rows={4} className="w-full px-3 py-2 rounded-lg border border-gray-200" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Imagen</label>
        {content.imageUrl ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={content.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
            <button type="button" onClick={() => update({ imageUrl: null })} className="text-xs text-red-600 hover:underline">Quitar</button>
          </div>
        ) : (
          <button type="button" onClick={() => setMediaOpen(true)} className="h-9 px-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium">
            Elegir de galería
          </button>
        )}
        {mediaOpen && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-100 grid grid-cols-4 gap-1 p-1">
            {media.map((m) => (
              <button key={m.id} type="button" onClick={() => { update({ imageUrl: m.url }); setMediaOpen(false) }} className="aspect-square rounded overflow-hidden border border-gray-200 hover:border-primary-cyan">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Botón CTA</label>
        <input
          value={content.ctaLabel}
          onChange={(e) => update({ ctaLabel: e.target.value })}
          placeholder="Texto del botón"
          className="w-full h-9 px-3 rounded-lg border border-gray-200 mb-2"
        />
        <CtaLinkPicker value={content.ctaLink} onChange={(ctaLink) => update({ ctaLink })} />
      </div>

      {templateKey === 'promo' && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Cupón</label>
          <select
            value={content.couponCode ?? ''}
            onChange={(e) => update({ couponCode: e.target.value || null })}
            className="w-full h-9 px-3 rounded-lg border border-gray-200"
          >
            <option value="">Sin cupón</option>
            {coupons.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.discount_type === 'percentage' ? `${c.value}%` : `$${(c.value / 100).toFixed(2)}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add the small coupons-list route this panel depends on**

```ts
// app/api/admin/marketing/coupons/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { listActiveCoupons } from '@/lib/supabase/queries/marketing'

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const supabase = createServiceClient()
    const coupons = await listActiveCoupons(supabase)
    return NextResponse.json({ data: coupons })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al listar cupones'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "CtaLinkPicker|CampaignFieldsPanel|marketing/coupons"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add components/admin/marketing/CtaLinkPicker.tsx components/admin/marketing/CampaignFieldsPanel.tsx app/api/admin/marketing/coupons/route.ts
git commit -m "feat(marketing): add CTA link picker and essential-fields panel"
```

---

### Task 15: `AudienceBar` component

**Files:**
- Create: `components/admin/marketing/AudienceBar.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/admin/marketing/AudienceBar.tsx
'use client'

import { useEffect, useState } from 'react'

const SEGMENTS = [
  { value: 'new', label: 'Nuevos' },
  { value: 'regular', label: 'Regulares' },
  { value: 'vip', label: 'VIP' },
  { value: 'at_risk', label: 'En riesgo' },
  { value: 'lost', label: 'Perdidos' },
]

interface AudienceBarProps {
  segments: string[]
  tags: string[]
  onSegmentsChange: (segments: string[]) => void
  onSaveDraft: () => void
  onSend: () => void
  saving: boolean
  sending: boolean
}

export function AudienceBar({ segments, tags, onSegmentsChange, onSaveDraft, onSend, saving, sending }: AudienceBarProps) {
  const [count, setCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)

  useEffect(() => {
    setLoadingCount(true)
    const timeout = setTimeout(() => {
      fetch('/api/admin/marketing/audience-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments, tags }),
      })
        .then((r) => r.json())
        .then((json) => setCount(json.data?.count ?? 0))
        .catch(() => setCount(null))
        .finally(() => setLoadingCount(false))
    }, 350)
    return () => clearTimeout(timeout)
  }, [segments, tags])

  const toggleSegment = (value: string) => {
    onSegmentsChange(segments.includes(value) ? segments.filter((s) => s !== value) : [...segments, value])
  }

  return (
    <div className="sticky bottom-0 rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-1.5">
        {SEGMENTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => toggleSegment(s.value)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
              segments.includes(s.value) ? 'bg-primary-dark text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-500 ml-auto">
        {loadingCount ? 'Calculando…' : count === null ? '—' : (
          <span><span className="font-bold text-gray-900">{count.toLocaleString('es-MX')}</span> destinatarios</span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saving}
          className="h-9 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar borrador'}
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={sending || !count}
          className="h-9 px-4 rounded-xl bg-primary-dark text-white text-sm font-semibold hover:bg-primary-dark/90 disabled:opacity-60"
        >
          {sending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "AudienceBar"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/admin/marketing/AudienceBar.tsx
git commit -m "feat(marketing): add audience segment picker with live count"
```

---

### Task 16: `CampaignsOverview` component

**Files:**
- Create: `components/admin/marketing/CampaignsOverview.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/admin/marketing/CampaignsOverview.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Mail, Send, FileEdit, TrendingUp } from 'lucide-react'
import { MetricCard } from '@/components/admin/analytics/MetricCard'
import { formatDate } from '@/lib/utils/format'
import type { MarketingCampaign, CampaignStatus } from '@/types'

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Borrador', sending: 'Enviando', sent: 'Enviada', failed: 'Fallida',
}

const TABS: Array<{ value: CampaignStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'draft', label: 'Borradores' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'failed', label: 'Fallidas' },
]

export function CampaignsOverview() {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<CampaignStatus | 'all'>('all')

  useEffect(() => {
    setLoading(true)
    const qs = tab === 'all' ? '' : `?status=${tab}`
    fetch(`/api/admin/marketing/campaigns${qs}`)
      .then((r) => r.json())
      .then((json) => setCampaigns(json.data ?? []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false))
  }, [tab])

  const draftCount = campaigns.filter((c) => c.status === 'draft').length
  const sentCount = campaigns.filter((c) => c.status === 'sent').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Marketing</h1>
        <Link href="/admin/marketing/nueva" className="h-9 px-4 rounded-xl bg-primary-dark text-white text-sm font-semibold hover:bg-primary-dark/90 flex items-center">
          Nueva campaña
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Campañas" value={String(campaigns.length)} icon={Mail} loading={loading} />
        <MetricCard label="Borradores" value={String(draftCount)} icon={FileEdit} loading={loading} />
        <MetricCard label="Enviadas" value={String(sentCount)} icon={Send} loading={loading} />
        <MetricCard label="Tasa de apertura" value="—" sublabel="por campaña, ver detalle" icon={TrendingUp} loading={loading} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm px-2 py-2 flex gap-1.5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${
              tab === t.value ? 'bg-primary-dark text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-400">Cargando…</div>
        ) : campaigns.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">No hay campañas todavía.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Estatus</th>
                <th className="px-4 py-3">Creada</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/marketing/${c.id}`} className="font-medium text-gray-900 hover:underline">{c.name}</Link>
                    <p className="text-xs text-gray-400">{c.subject}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{STATUS_LABELS[c.status]}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "CampaignsOverview"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/admin/marketing/CampaignsOverview.tsx
git commit -m "feat(marketing): add campaigns overview with stats and status tabs"
```

---

### Task 17: Wire up the admin pages

**Files:**
- Create: `app/admin/marketing/page.tsx`
- Create: `app/admin/marketing/[id]/page.tsx`

`[id]/page.tsx` handles both "editing a draft" (when `id` is an existing campaign) and "creating a new one" (when the overview's "Nueva campaña" link points at a literal `/admin/marketing/nueva`, handled as a special id).

- [ ] **Step 1: Write the overview page**

```tsx
// app/admin/marketing/page.tsx
import { CampaignsOverview } from '@/components/admin/marketing/CampaignsOverview'

export default function MarketingPage() {
  return <CampaignsOverview />
}
```

- [ ] **Step 2: Write the editor/detail page**

```tsx
// app/admin/marketing/[id]/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TemplateGallery } from '@/components/admin/marketing/TemplateGallery'
import { CampaignFieldsPanel } from '@/components/admin/marketing/CampaignFieldsPanel'
import { CampaignPreview } from '@/components/admin/marketing/CampaignPreview'
import { AudienceBar } from '@/components/admin/marketing/AudienceBar'
import { getTemplate } from '@/lib/marketing/templates'
import type { CampaignContent, CampaignTemplateKey, MarketingCampaign } from '@/types'

const EMPTY_CONTENT: CampaignContent = {
  heading: '', body: '', imageUrl: null, ctaLabel: '', ctaLink: null, couponCode: null,
}

export default function CampaignEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'nueva'
  const router = useRouter()

  const [loading, setLoading] = useState(!isNew)
  const [campaignId, setCampaignId] = useState<string | null>(isNew ? null : id)
  const [templateKey, setTemplateKey] = useState<CampaignTemplateKey | null>(null)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState('')
  const [content, setContent] = useState<CampaignContent>(EMPTY_CONTENT)
  const [segments, setSegments] = useState<string[]>([])
  const [tags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (isNew) return
    fetch(`/api/admin/marketing/campaigns/${id}`)
      .then((r) => r.json())
      .then((json) => {
        const campaign = json.data as MarketingCampaign
        setCampaignId(campaign.id)
        setTemplateKey(campaign.template_key)
        setName(campaign.name)
        setSubject(campaign.subject)
        setPreheader(campaign.preheader ?? '')
        setContent(campaign.content)
        setSegments(campaign.audience_segments)
      })
      .catch(() => toast.error('No se pudo cargar la campaña'))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const selectTemplate = (key: CampaignTemplateKey) => {
    const tpl = getTemplate(key)
    setTemplateKey(key)
    setName(tpl.name)
    setSubject(tpl.subject)
    setPreheader(tpl.preheader)
    setContent(tpl.content)
  }

  const persist = async (status?: 'draft'): Promise<string | null> => {
    const payload = {
      name, subject, preheader, content, template_key: templateKey,
      audience_segments: segments, audience_tags: tags,
      coupon_code: content.couponCode,
    }

    if (campaignId) {
      const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return null }
      return campaignId
    }

    const res = await fetch('/api/admin/marketing/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Error al crear campaña'); return null }
    setCampaignId(json.data.id)
    return json.data.id
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    const savedId = await persist('draft')
    setSaving(false)
    if (savedId) {
      toast.success('Borrador guardado')
      if (isNew) router.replace(`/admin/marketing/${savedId}`)
    }
  }

  const handleSend = async () => {
    setSending(true)
    const savedId = await persist()
    if (!savedId) { setSending(false); return }

    const res = await fetch(`/api/admin/marketing/campaigns/${savedId}/send`, { method: 'POST' })
    const json = await res.json()
    setSending(false)
    if (!res.ok) { toast.error(json.error ?? 'Error al enviar'); return }
    toast.success(`Campaña enviada — ${json.data.sent} entregados, ${json.data.failed} fallidos`)
    router.push('/admin/marketing')
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando…</div>

  if (!templateKey) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Elige una plantilla</h1>
        <TemplateGallery onSelect={selectTemplate} />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20">
      <h1 className="text-xl font-bold text-gray-900">{isNew && !campaignId ? 'Nueva campaña' : name || 'Editar campaña'}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <CampaignPreview content={content} />
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <CampaignFieldsPanel
            name={name}
            subject={subject}
            preheader={preheader}
            content={content}
            templateKey={templateKey}
            onNameChange={setName}
            onSubjectChange={setSubject}
            onPreheaderChange={setPreheader}
            onContentChange={setContent}
          />
        </div>
      </div>
      <AudienceBar
        segments={segments}
        tags={tags}
        onSegmentsChange={setSegments}
        onSaveDraft={handleSaveDraft}
        onSend={handleSend}
        saving={saving}
        sending={sending}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "admin/marketing"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/admin/marketing/page.tsx "app/admin/marketing/[id]/page.tsx"
git commit -m "feat(marketing): wire up campaign overview and editor pages"
```

---

### Task 18: Admin nav entry

**Files:**
- Modify: `app/admin/layout.tsx:27-41`

- [ ] **Step 1: Add the icon import**

Find (around line 7-11):

```ts
import {
  LayoutDashboard, Package, BarChart3, LogOut, ShoppingBag, FolderTree,
  Image as ImageIcon, Settings, Menu, X, ChevronRight, Ticket,
  Users, CreditCard, Loader2, Mail, Lock, Eye, EyeOff, Boxes, UserCheck, Users2,
  KanbanSquare,
} from 'lucide-react'
```

Replace with:

```ts
import {
  LayoutDashboard, Package, BarChart3, LogOut, ShoppingBag, FolderTree,
  Image as ImageIcon, Settings, Menu, X, ChevronRight, Ticket,
  Users, CreditCard, Loader2, Mail, Lock, Eye, EyeOff, Boxes, UserCheck, Users2,
  KanbanSquare, Megaphone,
} from 'lucide-react'
```

- [ ] **Step 2: Add the nav item**

Find:

```ts
  { href: '/admin/cupones', label: 'Cupones', icon: Ticket },
  { href: '/admin/affiliates', label: 'Afiliados', icon: Users2 },
```

Replace with:

```ts
  { href: '/admin/cupones', label: 'Cupones', icon: Ticket },
  { href: '/admin/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/admin/affiliates', label: 'Afiliados', icon: Users2 },
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "admin/layout.tsx"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat(marketing): add Marketing entry to admin sidebar"
```

---

### Task 19: End-to-end manual verification

No new files — this task drives the whole feature through a real browser session against the dev server, the way every other fix in this project has been verified this session (curl + puppeteer-core against the already-installed system Chrome).

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all suites pass, including the ~25 new marketing tests from Tasks 3-7.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev > /tmp/nurei-dev.log 2>&1 &
disown
sleep 6
tail -20 /tmp/nurei-dev.log
```

Expected: `✓ Ready` with no compile errors.

- [ ] **Step 3: Smoke-test the auth-gated API routes**

```bash
curl -s http://localhost:3500/api/admin/marketing/campaigns -w "\nHTTP %{http_code}\n"
curl -s -X POST http://localhost:3500/api/admin/marketing/audience-preview -w "\nHTTP %{http_code}\n"
curl -s http://localhost:3500/api/admin/marketing/coupons -w "\nHTTP %{http_code}\n"
```

Expected: all three return `{"error":"No autenticado"}` with `HTTP 401` — confirms routing and auth guard are wired correctly.

- [ ] **Step 4: Verify the open-tracking pixel is public**

```bash
curl -s -o /dev/null -w "HTTP %{http_code} | %{content_type}\n" \
  "http://localhost:3500/api/marketing/track/open/00000000-0000-0000-0000-000000000000"
```

Expected: `HTTP 200 | image/gif` (no auth required, per design).

- [ ] **Step 5: Full browser walkthrough with an authenticated admin session**

Since this repo's admin auth is real Supabase Auth (no test-account seed found during earlier research in this session — see prior conversation), this step must be done by a human with an actual admin login, not automated with the service-role key (impersonating a real user account is out of scope for automated verification). Ask the project owner to:

1. Log into `/admin` normally.
2. Open `/admin/marketing` — confirm the sidebar shows "Marketing" and the overview loads with 4 stat cards and an empty campaign table.
3. Click "Nueva campaña" → confirm the 4 template cards render with live mini-previews (not broken images/blank boxes).
4. Pick "Bienvenida" → confirm the 2-pane editor loads with the preview on the left already showing the template's default heading/body/CTA.
5. Edit the heading and confirm the live preview updates immediately.
6. Click "Elegir de galería" on the Imagen field → confirm it lists real media library images and selecting one updates the preview.
7. Toggle a segment checkbox in the bottom bar → confirm the recipient count updates after ~350ms.
8. Click "Guardar borrador" → confirm a success toast and that the campaign now appears in `/admin/marketing`'s "Borradores" tab.
9. Re-open the draft, pick the "Promo + cupón" template flow separately (new campaign) and confirm the Cupón dropdown appears and lists real active coupons from `/admin/cupones`.
10. **Do not click "Enviar" against real customers** unless the Resend sending domain has been verified (per the design spec's §10 risk) — sending to a tiny, deliberately-curated test segment (e.g. tag the tester's own customer record with a throwaway tag and target only that tag) is the safe way to confirm the send path end-to-end.

- [ ] **Step 6: Report back**

Summarize which of Step 5's 10 checks passed/failed, with screenshots or error messages for anything that didn't work, before considering this plan complete.

---

## Summary of what's NOT in this plan (by design)

Per the design spec, the following are explicitly out of scope and were not planned here: unsubscribe/suppression list, bounce/complaint webhook handling, Smart Campaigns automation, WhatsApp channel, send scheduling, A/B testing, and enforcement of the `marketing` permission key (it's seeded and typed for consistency, but — matching every other module in this codebase today — nothing blocks access based on it beyond the coarse `role = 'admin'` check in `requireAdmin()`).
