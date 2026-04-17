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

    // Handle auth update
    if (body.email || body.password) {
      const authUpdates: { email?: string; password?: string } = {}
      if (body.email) authUpdates.email = body.email
      if (body.password) authUpdates.password = body.password

      const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdates)
      if (authError) throw authError
    }

    const { email: _email, password: _password, ...profileUpdates } = body
    void _email; void _password
    const user = await updateUserProfile(supabase, id, profileUpdates)
    return NextResponse.json({ data: user })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error updating user'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    // 1) Delete the auth user (this cascades to user_profiles via FK on delete)
    const { error: authErr } = await supabase.auth.admin.deleteUser(id)
    if (authErr) {
      // If the auth user was already gone, fall through to profile cleanup
      if (!/user.*not.*found/i.test(authErr.message)) {
        throw authErr
      }
    }

    // 2) Best-effort cleanup of the profile row (no-op if cascade already removed it)
    await supabase.from('user_profiles').delete().eq('id', id)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error deleting user'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
