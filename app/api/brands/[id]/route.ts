import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if ('error' in admin) return admin.error

  try {
    const { id } = await params
    const supabase = createServiceClient()
    const { error } = await supabase.from('brands').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error eliminando marca'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
