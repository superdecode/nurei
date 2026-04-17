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
    const dbErr = err as { code?: string; message?: string; details?: string; hint?: string }
    console.error('[POST /api/admin/customers]', dbErr)

    if (dbErr?.code === '23505') {
      const detail = `${dbErr.details ?? ''} ${dbErr.message ?? ''}`.toLowerCase()
      if (detail.includes('email')) {
        return NextResponse.json({ error: 'Ya existe un cliente con ese email' }, { status: 409 })
      }
      if (detail.includes('phone')) {
        return NextResponse.json({ error: 'Ya existe un cliente con ese teléfono' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Ya existe un cliente con esos datos' }, { status: 409 })
    }
    if (dbErr?.code === '23502') {
      return NextResponse.json(
        { error: `Campo requerido faltante: ${dbErr.details ?? dbErr.message ?? ''}` },
        { status: 400 },
      )
    }
    if (dbErr?.code === '23514') {
      return NextResponse.json(
        { error: `Valor inválido: ${dbErr.details ?? dbErr.message ?? ''}` },
        { status: 400 },
      )
    }
    if (dbErr?.code === '42P01' || dbErr?.code === '42703') {
      return NextResponse.json(
        { error: `Error de esquema de base de datos (${dbErr.code}): ${dbErr.message ?? ''}. Revisa las migraciones.` },
        { status: 500 },
      )
    }

    const message = dbErr?.message || (err instanceof Error ? err.message : 'Error creando cliente')
    return NextResponse.json(
      { error: message, code: dbErr?.code, details: dbErr?.details, hint: dbErr?.hint },
      { status: 400 },
    )
  }
}
