import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAddresses, createAddress } from '@/lib/supabase/queries/addresses'
import { z } from 'zod'

const addressSchema = z.object({
  label: z.string().default('Casa'),
  recipient_name: z.string().min(2),
  street: z.string().min(2),
  exterior_number: z.string().min(1),
  interior_number: z.string().nullable().optional(),
  colonia: z.string().min(2),
  city: z.string().min(2),
  state: z.string().min(2),
  zip_code: z.string().length(5),
  phone: z.string().min(10).max(15),
  instructions: z.string().max(300).nullable().optional(),
  is_default: z.boolean().default(false),
})

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const addresses = await getAddresses(supabase)
    return NextResponse.json({ data: addresses })
  } catch {
    return NextResponse.json({ error: 'Error al obtener direcciones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const parsed = addressSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message, details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const address = await createAddress(supabase, user.id, {
      ...parsed.data,
      interior_number: parsed.data.interior_number ?? null,
      instructions: parsed.data.instructions ?? null,
    })
    return NextResponse.json({ data: address }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear dirección' }, { status: 500 })
  }
}
