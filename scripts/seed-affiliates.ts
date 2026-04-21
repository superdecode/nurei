/**
 * Seed affiliate module tables with test data.
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   npx tsx scripts/seed-affiliates.ts
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Test affiliate definitions ──────────────────────────────────────────────

const TEST_AFFILIATES = [
  {
    email:    'mariafood@nurei.test',
    password: 'TestAfiliado2026!',
    handle:   'mariafood',
    slug:     'maria',
    bio:      'Foodie apasionada por la cocina asiática 🍜',
    commission_coupon_pct: 12,
    commission_cookie_pct: 6,
  },
  {
    email:    'tokyobites@nurei.test',
    password: 'TestAfiliado2026!',
    handle:   'tokyobites',
    slug:     'tokyo',
    bio:      'Recetas japonesas y Korean BBQ',
    commission_coupon_pct: 10,
    commission_cookie_pct: 5,
  },
  {
    email:    'ramenlover@nurei.test',
    password: 'TestAfiliado2026!',
    handle:   'ramenlover',
    slug:     'ramen',
    bio:      'El ramen es vida 🍥',
    commission_coupon_pct: 8,
    commission_cookie_pct: 4,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function upsertAffiliate(aff: typeof TEST_AFFILIATES[0]) {
  console.log(`\n👤  ${aff.handle} <${aff.email}>`)

  // 1) Auth user — create or get existing
  let userId: string

  const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = listData?.users?.find(u => u.email === aff.email)

  if (existing) {
    console.log('   auth user already exists, reusing')
    userId = existing.id
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: aff.email,
      password: aff.password,
      email_confirm: true,
    })
    if (error || !data.user) {
      console.error('   ❌  createUser:', error?.message)
      return null
    }
    userId = data.user.id
    console.log('   ✅  auth user created:', userId)
  }

  // 2) user_profiles — set role to affiliate
  await supabase
    .from('user_profiles')
    .update({ role: 'affiliate', full_name: aff.handle })
    .eq('id', userId)

  // 3) affiliate_profiles — upsert
  const { error: affErr } = await supabase
    .from('affiliate_profiles')
    .upsert({
      id: userId,
      handle: aff.handle,
      bio: aff.bio,
      commission_coupon_pct: aff.commission_coupon_pct,
      commission_cookie_pct: aff.commission_cookie_pct,
      total_earned_cents: 0,
      pending_payout_cents: 0,
      is_active: true,
    }, { onConflict: 'id' })

  if (affErr) {
    console.error('   ❌  affiliate_profiles:', affErr.message)
    return null
  }
  console.log('   ✅  affiliate_profiles upserted')

  // 4) referral_links — upsert
  const { data: link, error: linkErr } = await supabase
    .from('referral_links')
    .upsert({
      affiliate_id: userId,
      slug: aff.slug,
      clicks_count: randomBetween(80, 600),
    }, { onConflict: 'affiliate_id' })
    .select('id')
    .single()

  if (linkErr || !link) {
    // Slug might conflict with another affiliate's — fetch existing
    const { data: existingLink } = await supabase
      .from('referral_links')
      .select('id')
      .eq('affiliate_id', userId)
      .single()

    if (!existingLink) {
      console.error('   ❌  referral_links:', linkErr?.message)
      return null
    }
    console.log('   ⚠️   referral_link already exists, reusing')
    return { userId, linkId: existingLink.id }
  }

  console.log('   ✅  referral_link upserted')
  return { userId, linkId: link.id }
}

async function seedClicks(linkId: string, affiliateId: string) {
  // Insert a batch of historical clicks (dedup index only blocks same session within 1h)
  const clicks = Array.from({ length: randomBetween(30, 80) }, (_, i) => ({
    referral_link_id: linkId,
    session_id: `seed-session-${affiliateId.slice(0, 8)}-${i}`,
    ip_hash: 'seeded00000000a0',
    converted: i < 10, // first 10 are converted
    clicked_at: daysAgo(randomBetween(1, 60)),
  }))

  const { error } = await supabase.from('referral_clicks').upsert(clicks, {
    onConflict: 'id',
    ignoreDuplicates: true,
  })
  if (error) console.error('   ⚠️   referral_clicks partial:', error.message)
  else console.log(`   ✅  ${clicks.length} clicks seeded`)
}

async function seedAttributions(affiliateId: string, couponId: string | null) {
  // Check if already seeded
  const { count } = await supabase
    .from('affiliate_attributions')
    .select('id', { count: 'exact', head: true })
    .eq('affiliate_id', affiliateId)

  if ((count ?? 0) > 0) {
    console.log(`   ⚠️   attributions already seeded (${count}), skipping`)
    return
  }

  // We need valid order IDs — fetch a few real orders
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total, coupon_code')
    .limit(10)
    .order('created_at', { ascending: false })

  if (!orders?.length) {
    console.log('   ⚠️   no orders found to attribute — skipping attribution seed')
    return
  }

  const attribs = orders.slice(0, Math.min(6, orders.length)).map((o, i) => ({
    order_id: o.id,
    affiliate_id: affiliateId,
    attribution_type: i % 2 === 0 ? 'coupon' : 'cookie',
    coupon_id: i % 2 === 0 ? couponId : null,
    commission_pct: i % 2 === 0 ? 12 : 6,
    commission_amount_cents: Math.floor(o.total * (i % 2 === 0 ? 12 : 6) / 100),
    payout_status: i < 3 ? 'paid' : 'pending',
    paid_at: i < 3 ? daysAgo(randomBetween(5, 20)) : null,
    created_at: daysAgo(randomBetween(1, 45)),
  }))

  const { error } = await supabase
    .from('affiliate_attributions')
    .upsert(attribs, { onConflict: 'order_id', ignoreDuplicates: true })

  if (error) console.error('   ⚠️   attributions:', error.message)
  else {
    console.log(`   ✅  ${attribs.length} attributions seeded`)

    // Update pending balance
    const pendingCents = attribs
      .filter(a => a.payout_status === 'pending')
      .reduce((s, a) => s + a.commission_amount_cents, 0)

    const totalEarned = attribs.reduce((s, a) => s + a.commission_amount_cents, 0)

    await supabase
      .from('affiliate_profiles')
      .update({
        pending_payout_cents: pendingCents,
        total_earned_cents: totalEarned,
      })
      .eq('id', affiliateId)
  }
}

async function seedPayments(affiliateId: string) {
  const { count } = await supabase
    .from('commission_payments')
    .select('id', { count: 'exact', head: true })
    .eq('affiliate_id', affiliateId)

  if ((count ?? 0) > 0) {
    console.log(`   ⚠️   payments already seeded, skipping`)
    return
  }

  const { data: paidAttribs } = await supabase
    .from('affiliate_attributions')
    .select('id, commission_amount_cents')
    .eq('affiliate_id', affiliateId)
    .eq('payout_status', 'paid')

  if (!paidAttribs?.length) {
    console.log('   ⚠️   no paid attributions to record payment for, skipping')
    return
  }

  const total = paidAttribs.reduce((s, a) => s + a.commission_amount_cents, 0)
  const paidAt = daysAgo(10)

  const { error } = await supabase.from('commission_payments').insert({
    affiliate_id: affiliateId,
    amount_cents: total,
    period_from: daysAgo(45).slice(0, 10),
    period_to: daysAgo(11).slice(0, 10),
    attribution_ids: paidAttribs.map(a => a.id),
    notes: 'Pago inicial de prueba — seed data',
    paid_at: paidAt,
  })

  if (error) console.error('   ⚠️   commission_payments:', error.message)
  else console.log(`   ✅  payment record seeded (${total} centavos)`)
}

async function main() {
  console.log('🌱  Seeding affiliate module...\n')

  // Fetch a coupon to associate (optional)
  const { data: coupon } = await supabase
    .from('coupons')
    .select('id, code')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (coupon) {
    console.log(`📎  Using coupon ${coupon.code} for attribution examples`)
  } else {
    console.log('📎  No active coupons found — attributions will use cookie type only')
  }

  for (const affDef of TEST_AFFILIATES) {
    const result = await upsertAffiliate(affDef)
    if (!result) continue

    const { userId, linkId } = result

    await seedClicks(linkId, userId)
    await seedAttributions(userId, coupon?.id ?? null)
    await seedPayments(userId)
  }

  console.log('\n✅  Affiliate seed complete!')
  console.log('\n📋  Test accounts (password: TestAfiliado2026!):')
  for (const a of TEST_AFFILIATES) {
    console.log(`   ${a.email.padEnd(30)} → /affiliate/overview`)
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
