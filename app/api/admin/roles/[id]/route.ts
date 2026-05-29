import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { updateAdminRole, deleteAdminRole } from '@/lib/supabase/queries/adminRoles'
import { requireAdmin } from '@/lib/server/require-admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const { id } = await params
    const supabase = createServiceClient()
    const body = await request.json()
    const role = await updateAdminRole(supabase, id, body)
    return NextResponse.json({ data: role })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error updating role'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  try {
    const { id } = await params
    const supabase = createServiceClient()
    await deleteAdminRole(supabase, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error deleting role'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
