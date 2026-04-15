import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { updateUserProfile, toggleUserActive } from '@/lib/supabase/queries/adminUsers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()
    const body = await request.json()

    // Handle toggle active separately
    if (body.is_active !== undefined && Object.keys(body).length === 1) {
      await toggleUserActive(supabase, id, body.is_active)
      return NextResponse.json({ success: true })
    }

    const user = await updateUserProfile(supabase, id, body)
    return NextResponse.json({ data: user })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error updating user'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
