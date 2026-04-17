import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import {
  deleteCustomer,
  getCustomerById,
  setCustomerActive,
  updateCustomer,
} from '@/lib/supabase/queries/customers'
import { updateCustomerSchema } from '@/lib/validations/customer'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const { id } = await params
    const supabase = createServiceClient()
    const customer = await getCustomerById(supabase, id)
    if (!customer) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ data: customer })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error cargando cliente'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const { id } = await params
    const body = await request.json()
    const supabase = createServiceClient()

    // Fast path: toggle active
    if (typeof body.is_active === 'boolean' && Object.keys(body).length === 1) {
      await setCustomerActive(supabase, id, body.is_active)
      return NextResponse.json({ success: true })
    }

    const parsed = updateCustomerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload inválido', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const customer = await updateCustomer(supabase, id, parsed.data)
    return NextResponse.json({ data: customer })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error actualizando cliente'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const { id } = await params
    const supabase = createServiceClient()
    await deleteCustomer(supabase, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error eliminando cliente'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
