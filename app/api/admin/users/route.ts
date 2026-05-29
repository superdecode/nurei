import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAllUsers, createAdminUser } from '@/lib/supabase/queries/adminUsers'
import { requireAdmin } from '@/lib/server/require-admin'

export async function GET() {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const supabase = createServiceClient()
    const users = await getAllUsers(supabase)
    return NextResponse.json({ data: users })
  } catch {
    return NextResponse.json({ data: [], error: 'Error fetching users' })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const supabase = createServiceClient()
    const body = await request.json()

    if (!body.email || !body.password || !body.full_name || !body.admin_role_id) {
      return NextResponse.json(
        { error: 'email, password, full_name y admin_role_id son requeridos' },
        { status: 400 }
      )
    }

    const user = await createAdminUser(supabase, body)
    return NextResponse.json({ data: user })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error creating user'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
