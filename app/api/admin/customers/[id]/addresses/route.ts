import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import {
  createCustomerAddress,
  listCustomerAddresses,
} from '@/lib/supabase/queries/customers'
import { customerAddressSchema } from '@/lib/validations/customer'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const { id } = await params
    const supabase = createServiceClient()
    const data = await listCustomerAddresses(supabase, id)
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error listando direcciones'
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = customerAddressSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload inválido', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const supabase = createServiceClient()
    const data = await createCustomerAddress(supabase, id, parsed.data)
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error creando dirección'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
