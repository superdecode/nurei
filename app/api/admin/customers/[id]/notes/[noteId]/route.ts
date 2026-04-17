import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { deleteCustomerNote } from '@/lib/supabase/queries/customers'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const { noteId } = await params
    const supabase = createServiceClient()
    await deleteCustomerNote(supabase, noteId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error eliminando nota'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
