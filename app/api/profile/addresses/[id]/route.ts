import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateAddress, deleteAddress } from '@/lib/supabase/queries/addresses'
import { z } from 'zod'

const updateSchema = z.object({
  label: z.string().optional(),
  recipient_name: z.string().min(2).optional(),
  street: z.string().min(2).optional(),
  exterior_number: z.string().min(1).optional(),
  interior_number: z.string().nullable().optional(),
  colonia: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  state: z.string().min(2).optional(),
  zip_code: z.string().length(5).optional(),
  phone: z.string().min(10).optional(),
  instructions: z.string().nullable().optional(),
  is_default: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const address = await updateAddress(supabase, id, parsed.data)
    return NextResponse.json({ data: address })
  } catch {
    return NextResponse.json({ error: 'Error al actualizar dirección' }, { status: 500 })
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    await deleteAddress(supabase, id)
    return NextResponse.json({ data: { success: true } })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar dirección' }, { status: 500 })
  }
}
