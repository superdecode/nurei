import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import {
  deleteCustomerAddress,
  updateCustomerAddress,
} from '@/lib/supabase/queries/customers'
import { customerAddressSchema } from '@/lib/validations/customer'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> },
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const { addressId } = await params
    const body = await request.json()
    const parsed = customerAddressSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload inválido', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const supabase = createServiceClient()
    const data = await updateCustomerAddress(supabase, addressId, parsed.data)
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error actualizando dirección'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> },
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const { addressId } = await params
    const supabase = createServiceClient()
    await deleteCustomerAddress(supabase, addressId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error eliminando dirección'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
