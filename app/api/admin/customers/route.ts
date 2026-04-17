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
      const flat = parsed.error.flatten()
      // Surface the first meaningful field error so the UI can show it
      const firstField = Object.entries(flat.fieldErrors).find(([, msgs]) => msgs && msgs.length > 0)
      const firstFormError = flat.formErrors[0]
      const errorMsg = firstField
        ? `${firstField[0]}: ${firstField[1]![0]}`
        : (firstFormError ?? 'Datos inválidos')
      return NextResponse.json(
        { error: errorMsg, details: flat },
        { status: 400 },
      )
    }
    const supabase = createServiceClient()
    const customer = await createCustomer(supabase, parsed.data)
    return NextResponse.json({ data: customer }, { status: 201 })
  } catch (err) {
    const maybeDbErr = err as { code?: string; message?: string; details?: string }
    if (maybeDbErr?.code === '23505') {
      const detail = `${maybeDbErr.details ?? ''} ${maybeDbErr.message ?? ''}`.toLowerCase()
      if (detail.includes('email')) {
        return NextResponse.json({ error: 'Ya existe un cliente con ese email' }, { status: 409 })
      }
      if (detail.includes('phone')) {
        return NextResponse.json({ error: 'Ya existe un cliente con ese teléfono' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Ya existe un cliente con esos datos' }, { status: 409 })
    }
    const message = err instanceof Error ? err.message : 'Error creando cliente'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
