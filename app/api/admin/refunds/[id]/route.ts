import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getRefundDetail } from '@/lib/supabase/queries/adminRefunds'
import { requireAdminPermission } from '@/lib/server/require-admin-permission'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminPermission('reembolsos', 'lectura')
  if (guard.error) return guard.error

  const { id } = await params
  const supabase = createServiceClient()
  const refund = await getRefundDetail(supabase, id)

  if (!refund) return NextResponse.json({ error: 'Reembolso no encontrado' }, { status: 404 })
  return NextResponse.json({ data: refund })
}
