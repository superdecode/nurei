import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAdminRoles, createAdminRole } from '@/lib/supabase/queries/adminRoles'

export async function GET() {
  try {
    const supabase = createServiceClient()
    const roles = await getAdminRoles(supabase)
    return NextResponse.json({ data: roles })
  } catch {
    return NextResponse.json({ data: [], error: 'Error fetching roles' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()
    const role = await createAdminRole(supabase, body)
    return NextResponse.json({ data: role })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error creating role'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
