/**
 * Apply pending Supabase migrations via Management API.
 *
 * 1. Get your Personal Access Token at https://supabase.com/dashboard/account/tokens
 * 2. Run: SUPABASE_ACCESS_TOKEN=sbp_xxx npx tsx scripts/apply-migrations.ts
 */

import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PROJECT_REF = 'jotoxalbyvbppvgtdbee'
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''

if (!ACCESS_TOKEN) {
  console.error('❌  SUPABASE_ACCESS_TOKEN is required.')
  console.error('   Get yours at: https://supabase.com/dashboard/account/tokens')
  console.error('   Run: SUPABASE_ACCESS_TOKEN=sbp_xxx npx tsx scripts/apply-migrations.ts')
  process.exit(1)
}

const MIGRATIONS_DIR = join(__dirname, '../supabase/migrations')

// Ordered migrations to apply
const PENDING_MIGRATIONS = [
  '006_customers.sql',
  '007_products_shipping_weight.sql',
  '008_categories_position.sql',
  '011_set_updated_at_function.sql',
  '012_affiliate_role.sql',
  '013_affiliate_tables.sql',
  '014_coupons_robust_rules.sql',
  '015_affiliate_rls.sql',
  '017_affiliate_enhancements.sql',
  '017_affiliate_payment_notif.sql',
  '018_affiliate_phone_name.sql',
  '019_orders_payment_column.sql',
  '020_orders_coupon_snapshot_guard.sql',
  '021_orders_checkout_columns_guard.sql',
  '022_user_notification_prefs.sql',
  '023_user_notification_prefs_guard.sql',
  '024_affiliate_security_fixes.sql', // defines record_attribution_atomic RPC
  '025_orders_shipping_method.sql',
]

async function runSql(query: string, label: string): Promise<void> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body}`)
  }

  const data = await res.json() as unknown
  console.log(`   ✅  ${label}`, typeof data === 'object' ? '' : data)
}

async function main() {
  console.log(`🔧  Applying migrations to project ${PROJECT_REF}\n`)

  for (const filename of PENDING_MIGRATIONS) {
    const filePath = join(MIGRATIONS_DIR, filename)
    console.log(`📄  ${filename}`)

    let sql: string
    try {
      sql = await readFile(filePath, 'utf-8')
    } catch {
      console.error(`   ❌  File not found: ${filePath}`)
      continue
    }

    try {
      await runSql(sql, 'applied')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Ignore "already exists" errors (idempotent migrations use IF NOT EXISTS)
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log(`   ⚠️   Already applied (skipped)`)
      } else {
        console.error(`   ❌  Error: ${msg}`)
      }
    }

    console.log()
  }

  console.log('✅  Done.')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
