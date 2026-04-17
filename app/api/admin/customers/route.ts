import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/server/require-admin'
import {
  listCustomers,
  createCustomer,
} from '@/lib/supabase/queries/customers'
import {
  createCustomerSchema,
  customerListQuerySchema,
} from '@/lib/validations/customer'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const parsed = customerListQuerySchema.safeParse(Object.fromEntries(searchParams.entries()))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const supabase = createServiceClient()
    const result = await listCustomers(supabase, parsed.data)
    return NextResponse.json({
      data: result.data,
      meta: { total: result.total, page: result.page, limit: result.limit },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error listando clientes'
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()
    const parsed = createCustomerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload inválido', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const supabase = createServiceClient()
    const customer = await createCustomer(supabase, parsed.data)
    return NextResponse.json({ data: customer }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error creando cliente'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
