/**
 * Create admin user in Supabase
 * Run: npx tsx scripts/create-admin.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotoxalbyvbppvgtdbee.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const ADMIN_EMAIL = 'quiron96@hotmail.com'
const ADMIN_PASSWORD = 'Nurei@Admin2026'

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required. Set it in .env.local or pass as env var.')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`Creating admin user: ${ADMIN_EMAIL}`)

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find(u => u.email === ADMIN_EMAIL)

  let userId: string

  if (existingUser) {
    console.log('User already exists, updating password...')
    const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    })
    if (error) { console.error('Error updating user:', error); process.exit(1) }
    userId = existingUser.id
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Admin Nurei' },
    })
    if (error || !data.user) { console.error('Error creating user:', error); process.exit(1) }
    userId = data.user.id
    console.log('User created:', userId)
  }

  // Ensure profile exists with admin role
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert({
      id: userId,
      full_name: 'Admin Nurei',
      role: 'admin',
    }, { onConflict: 'id' })

  if (profileError) {
    console.error('Error setting admin role:', profileError)
    process.exit(1)
  }

  console.log('\n✅ Admin user ready!')
  console.log(`   Email:    ${ADMIN_EMAIL}`)
  console.log(`   Password: ${ADMIN_PASSWORD}`)
  console.log('\n   Change the password after first login.')
}

main()
